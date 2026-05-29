import Link from "next/link";
import { deleteVehicleAction } from "@/app/_actions/vehicles";
import { Prisma } from "@/app/generated/prisma/client";
import { ClickableRow } from "@/app/_components/clickable-row";
import {
  FilterSelect,
  ResetFilters,
  SearchBox,
} from "@/app/_components/list-filters";
import {
  EmptyState,
  PageHeader,
  PrimaryLinkButton,
} from "@/app/_components/page-header";
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
  searchParams: Promise<{ q?: string; assigned?: string }>;
}) {
  const user = await requireUser();
  if (!canView(user, "vehicles")) redirect("/dashboard");
  const canAdd = canCreate(user, "vehicles");
  const canRemove = canDelete(user, "vehicles");

  const { q = "", assigned = "" } = await searchParams;
  const where: Prisma.VehicleWhereInput = { tenantId: user.tenantId };
  if (q) {
    where.OR = [
      { plate: { contains: q, mode: "insensitive" } },
      { make: { contains: q, mode: "insensitive" } },
      { model: { contains: q, mode: "insensitive" } },
      { vin: { contains: q, mode: "insensitive" } },
      { customer: { fullName: { contains: q, mode: "insensitive" } } },
      { customer: { phone: { contains: q } } },
    ];
  }
  if (assigned === "yes") where.customerId = { not: null };
  else if (assigned === "no") where.customerId = null;

  const vehicles = await prisma.vehicle.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      customer: { select: { id: true, fullName: true, phone: true } },
      _count: { select: { serviceOrders: true } },
    },
  });

  return (
    <div className="p-6 sm:p-8 max-full flex-1 flex flex-col min-h-0 w-full">
      <PageHeader
        title="Машинууд"
        description="Үйлчлүүлэгчдийн машин, бүртгэлийн мэдээлэл"
        actions={
          canAdd ? (
            <PrimaryLinkButton href="/dashboard/vehicles/new">
              Машин нэмэх
            </PrimaryLinkButton>
          ) : null
        }
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          marginBottom: "1rem",
        }}
      >
        <SearchBox placeholder="Дугаар, марк, эзэмшигчээр хайх" />
        <FilterSelect
          paramName="assigned"
          placeholder="Эзэмшигч"
          options={[
            { value: "yes", label: "Эзэмшигчтэй" },
            { value: "no", label: "Эзэмшигчгүй" },
          ]}
        />
        <ResetFilters paramNames={["q", "assigned"]} />
      </div>

      {vehicles.length === 0 ? (
        <EmptyState
          title={q || assigned ? "Машин олдсонгүй" : "Машин алга"}
          description={
            q || assigned
              ? "Шүүлтүүрээ цэвэрлэж дахин үзнэ үү."
              : "Эхний машинаа бүртгэж эхлээрэй."
          }
          cta={
            canAdd ? (
              <PrimaryLinkButton href="/dashboard/vehicles/new">
                Эхний машин нэмэх
              </PrimaryLinkButton>
            ) : null
          }
        />
      ) : (
        <div className="glass rounded-2xl overflow-hidden flex-1 min-h-0 flex flex-col">
          <div className="overflow-auto flex-1 min-h-0">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr className="border-b border-white/[0.06]">
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
                      className="text-left text-xs text-white/30 font-medium px-5 py-3"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vehicles.map((v) => (
                  <ClickableRow
                    key={v.id}
                    href={`/dashboard/vehicles/${v.id}`}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500/30 to-blue-500/30 flex items-center justify-center text-lg shrink-0">
                          🚗
                        </div>
                        <div>
                          <div className="text-sm font-medium text-white/90">
                            {v.make} {v.model}
                          </div>
                          <div className="text-xs text-white/30">
                            {v.year ? `${v.year} он` : "—"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm font-mono font-medium text-white/80">
                        {v.plate}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm">
                      {v.customer ? (
                        <Link
                          href={`/dashboard/customers/${v.customer.id}`}
                          className="text-white/70 hover:text-violet-300 transition-colors"
                        >
                          {v.customer.fullName}
                          <span className="text-white/30 text-xs ml-1">
                            · {v.customer.phone}
                          </span>
                        </Link>
                      ) : (
                        <span className="text-white/30">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-sm text-white/50">
                      {v.mileage != null
                        ? `${v.mileage.toLocaleString("mn-MN")} км`
                        : "—"}
                    </td>
                    <td className="px-5 py-4 text-sm text-white/60">
                      {v._count.serviceOrders}
                    </td>
                    <td className="px-5 py-4">
                      {canRemove ? (
                        <div className="flex items-center justify-end">
                          <form action={deleteVehicleAction}>
                            <input type="hidden" name="id" value={v.id} />
                            <button
                              type="submit"
                              className="text-xs text-red-400 hover:text-red-300 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-red-500/10"
                            >
                              Устгах
                            </button>
                          </form>
                        </div>
                      ) : null}
                    </td>
                  </ClickableRow>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
