import Link from "next/link";
import { deleteVehicleAction } from "@/app/_actions/vehicles";
import { Prisma } from "@/app/generated/prisma/client";
import { ClickableRow } from "@/app/_components/clickable-row";
import {
  FilterSelect,
  ResetFilters,
  SearchBox,
} from "@/app/_components/list-filters";
import { EmptyState } from "@/app/_components/page-header";
import { AddLinkButton, StatCell, StatGrid } from "@/app/_components/landing-ops-ui";
import { Pagination } from "@/app/_components/pagination";
import { CarIcon } from "@/app/_components/landing-icons";
import {
  RowActionsMenu,
  RowMenuFormItem,
} from "@/app/_components/row-actions";
import { buildMeta, getPageInfo } from "@/lib/pagination";
import { customerLabel } from "@/lib/customers";
import { POSTPAID_BADGE, POSTPAID_LABEL } from "@/lib/orders";
import { requireUser } from "@/lib/auth";
import { canCreate, canDelete, canView } from "@/lib/auth/roles";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Машинууд",
};

export default async function VehiclesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    assigned?: string;
    postpaid?: string;
    page?: string;
  }>;
}) {
  const user = await requireUser();
  if (!canView(user, "vehicles")) redirect("/dashboard");
  const canAdd = canCreate(user, "vehicles");
  const canRemove = canDelete(user, "vehicles");

  const {
    q = "",
    assigned = "",
    postpaid = "",
    page: pageParam,
  } = await searchParams;
  // Тенантын "машинууд" = TenantVehicle link-үүд (global Vehicle руу заана).
  const where: Prisma.TenantVehicleWhereInput = { tenantId: user.tenantId };
  if (q) {
    where.OR = [
      { vehicle: { plate: { contains: q, mode: "insensitive" } } },
      { vehicle: { make: { contains: q, mode: "insensitive" } } },
      { vehicle: { model: { contains: q, mode: "insensitive" } } },
      { vehicle: { vin: { contains: q, mode: "insensitive" } } },
      { customer: { fullName: { contains: q, mode: "insensitive" } } },
      { customer: { phone: { contains: q } } },
    ];
  }
  if (assigned === "yes") where.customerId = { not: null };
  else if (assigned === "no") where.customerId = null;
  if (postpaid === "yes") where.isPostpaid = true;
  else if (postpaid === "no") where.isPostpaid = false;

  const { page, pageSize, skip, take } = getPageInfo(pageParam);
  const [links, total, totalVehicles, assignedVehicles, postpaidVehicles] =
    await Promise.all([
      prisma.tenantVehicle.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
        select: {
          isPostpaid: true,
          customer: { select: { id: true, fullName: true, phone: true } },
          vehicle: {
            select: {
              id: true,
              plate: true,
              make: true,
              model: true,
              year: true,
              mileage: true,
            },
          },
        },
      }),
      prisma.tenantVehicle.count({ where }),
      prisma.tenantVehicle.count({ where: { tenantId: user.tenantId } }),
      prisma.tenantVehicle.count({
        where: { tenantId: user.tenantId, customerId: { not: null } },
      }),
      prisma.tenantVehicle.count({
        where: { tenantId: user.tenantId, isPostpaid: true },
      }),
    ]);
  const meta = buildMeta(total, page, pageSize);

  // Захиалгын тоог ЭНЭ tenant-аар хязгаарлаж тоолно (global vehicle нийт
  // tenant-ийн захиалгыг агуулдаг тул шууд _count ашиглах нь буруу).
  const vehicleIds = links.map((l) => l.vehicle.id);
  const orderCounts = vehicleIds.length
    ? await prisma.serviceOrder.groupBy({
        by: ["vehicleId"],
        where: { tenantId: user.tenantId, vehicleId: { in: vehicleIds } },
        _count: { _all: true },
      })
    : [];
  const orderCountMap = new Map(
    orderCounts.map((o) => [o.vehicleId, o._count._all]),
  );

  const vehicles = links.map((l) => ({
    id: l.vehicle.id,
    plate: l.vehicle.plate,
    make: l.vehicle.make,
    model: l.vehicle.model,
    year: l.vehicle.year,
    mileage: l.vehicle.mileage,
    isPostpaid: l.isPostpaid,
    customer: l.customer,
    _count: { serviceOrders: orderCountMap.get(l.vehicle.id) ?? 0 },
  }));

  return (
    <div className="p-4 sm:p-6 max-w-full flex-1 flex flex-col min-h-0 w-full">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--oc-ink)]">Машинууд</h1>
          <p className="text-sm text-[var(--oc-muted3)] mt-1">
            Үйлчлүүлэгчдийн машин, бүртгэлийн мэдээлэл · {totalVehicles} машин
          </p>
        </div>
        {canAdd ? (
          <AddLinkButton href="/dashboard/vehicles/new">Машин нэмэх</AddLinkButton>
        ) : null}
      </div>

      <StatGrid cols={3}>
        <StatCell label="Нийт машин" value={totalVehicles} />
        <StatCell label="Эзэмшигчтэй" value={assignedVehicles} tone="ok" />
        <StatCell label="Дараа төлбөрт" value={postpaidVehicles} tone="accent" />
      </StatGrid>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <SearchBox placeholder="Дугаар, марк, эзэмшигчээр хайх" />
        <FilterSelect
          paramName="assigned"
          placeholder="Эзэмшигч"
          options={[
            { value: "yes", label: "Эзэмшигчтэй" },
            { value: "no", label: "Эзэмшигчгүй" },
          ]}
        />
        <FilterSelect
          paramName="postpaid"
          placeholder="Төлбөрийн нөхцөл"
          options={[
            { value: "yes", label: "Дараа төлбөрт" },
            { value: "no", label: "Энгийн" },
          ]}
        />
        <ResetFilters paramNames={["q", "assigned", "postpaid"]} />
      </div>

      {vehicles.length === 0 ? (
        <EmptyState
          title={q || assigned || postpaid ? "Машин олдсонгүй" : "Машин алга"}
          description={
            q || assigned || postpaid
              ? "Шүүлтүүрээ цэвэрлэж дахин үзнэ үү."
              : "Эхний машинаа бүртгэж эхлээрэй."
          }
          cta={
            canAdd ? (
              <AddLinkButton href="/dashboard/vehicles/new">Эхний машин нэмэх</AddLinkButton>
            ) : null
          }
        />
      ) : (
        <div className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] overflow-hidden flex-1 min-h-0 flex flex-col">
          <div className="overflow-auto flex-1 min-h-0">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr className="border-b border-[var(--oc-line)]">
                  {[
                    "Машин",
                    "Дугаар",
                    "Эзэмшигч",
                    "Гүйлт",
                    "Захиалга",
                    "",
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-left font-plex-mono text-[10.5px] uppercase tracking-[0.08em] text-[var(--oc-muted3)] font-medium px-5 py-3"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--oc-line)]">
                {vehicles.map((v) => (
                  <ClickableRow
                    key={v.id}
                    href={`/dashboard/vehicles/${v.id}`}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg border border-[var(--oc-line)] bg-[var(--oc-panel2)] flex items-center justify-center text-[var(--oc-ink2)] shrink-0">
                          <CarIcon />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-[var(--oc-ink)]">
                            {v.make} {v.model}
                          </div>
                          <div className="text-xs text-[var(--oc-muted3)]">
                            {v.year ? `${v.year} он` : "—"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-plex-mono text-sm font-medium text-[var(--oc-ink2)]">
                        {v.plate}
                      </span>
                      {v.isPostpaid ? (
                        <span
                          className={`ml-2 inline-block align-middle font-plex-mono text-[10px] px-1.5 py-0.5 rounded-full ${POSTPAID_BADGE}`}
                        >
                          {POSTPAID_LABEL}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-5 py-4 text-sm">
                      {v.customer ? (
                        <Link
                          href={`/dashboard/customers/${v.customer.id}`}
                          className="text-[var(--oc-muted2)] hover:text-[var(--oc-accent)] transition-colors"
                        >
                          {customerLabel(v.customer)}
                          <span className="text-[var(--oc-muted3)] text-xs ml-1">
                            · {v.customer.phone}
                          </span>
                        </Link>
                      ) : (
                        <span className="text-[var(--oc-muted4)]">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 font-plex-mono text-sm text-[var(--oc-muted2)]">
                      {v.mileage != null
                        ? `${v.mileage.toLocaleString("mn-MN")} км`
                        : "—"}
                    </td>
                    <td className="px-5 py-4 font-plex-mono text-sm text-[var(--oc-ink2)]">
                      {v._count.serviceOrders}
                    </td>
                    <td className="px-5 py-4">
                      {canRemove ? (
                        <RowActionsMenu>
                          <RowMenuFormItem
                            action={deleteVehicleAction}
                            hidden={{ id: v.id }}
                            confirmMessage={`${v.plate} машиныг устгах уу?`}
                            destructive
                          >
                            Устгах
                          </RowMenuFormItem>
                        </RowActionsMenu>
                      ) : null}
                    </td>
                  </ClickableRow>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-t border-[var(--oc-line)] font-plex-mono text-xs text-[var(--oc-muted3)]">
            <span>
              {vehicles.length} / {total} харагдаж байна
            </span>
          </div>
          <Pagination
            page={meta.page}
            totalPages={meta.totalPages}
            total={meta.total}
            params={{ q, assigned, postpaid }}
          />
        </div>
      )}
    </div>
  );
}
