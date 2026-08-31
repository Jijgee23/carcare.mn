import Link from "next/link";
import { deleteServiceAction } from "@/app/_actions/services";
import { ClickableRow } from "@/app/_components/clickable-row";
import { AddLinkButton, Chip } from "@/app/_components/landing-ops-ui";
import { EmptyState } from "@/app/_components/page-header";
import { Pagination } from "@/app/_components/pagination";
import { buildMeta, getPageInfo } from "@/lib/pagination";
import { requireUser } from "@/lib/auth";
import { canCreate, canDelete, canView } from "@/lib/auth/roles";
import { redirect } from "next/navigation";
import { formatTugrik } from "@/lib/orders";
import { prisma } from "@/lib/prisma";
import {
  STOCK_LABEL,
  SERVICE_KIND_DESCRIPTION,
  SERVICE_KIND_LABEL,
  SERVICE_KIND_SLUG,
  type ServiceKind,
  type StockLevel,
  formatDuration,
  formatStock,
  stockLevel,
} from "@/lib/services";

const STOCK_TONE: Record<StockLevel, "danger" | "warn" | "ok"> = {
  out: "danger",
  low: "warn",
  ok: "ok",
};

export async function ServiceList({
  type,
  pageParam,
}: {
  type: ServiceKind;
  pageParam?: string;
}) {
  const user = await requireUser();
  if (!canView(user, "services")) redirect("/dashboard");
  const canAdd = canCreate(user, "services");
  const canRemove = canDelete(user, "services");

  const where = { tenantId: user.tenantId, type };
  const { page, pageSize, skip, take } = getPageInfo(pageParam);
  const [services, total] = await Promise.all([
    prisma.service.findMany({
      where,
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      skip,
      take,
      include: {
        _count: { select: { items: true } },
        unit: { select: { name: true } },
        durationUnit: { select: { name: true } },
        category: { select: { name: true } },
      },
    }),
    prisma.service.count({ where }),
  ]);
  const meta = buildMeta(total, page, pageSize);

  const newHref = `/dashboard/services/new?type=${SERVICE_KIND_SLUG[type]}`;
  const isGoods = type === "GOODS";

  return (
    <div className="p-4 sm:p-6 max-w-full flex-1 flex flex-col min-h-0 w-full">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--oc-ink)]">
            {SERVICE_KIND_LABEL[type]}
          </h1>
          <p className="text-sm text-[var(--oc-muted3)] mt-1">
            {SERVICE_KIND_DESCRIPTION[type]}
          </p>
        </div>
        {canAdd ? <AddLinkButton href={newHref}>Нэмэх</AddLinkButton> : null}
      </div>

      {services.length === 0 ? (
        <EmptyState
          title={`${SERVICE_KIND_LABEL[type]} бүртгээгүй байна`}
          description="Шинээр нэмж эхлээрэй."
          cta={canAdd ? <AddLinkButton href={newHref}>Эхний нэмэх</AddLinkButton> : null}
        />
      ) : (
        <div className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] overflow-hidden flex-1 min-h-0 flex flex-col">
          <div className="overflow-auto flex-1 min-h-0">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr className="border-b border-[var(--oc-line)]">
                  {(isGoods
                    ? ["Код", "Нэр", "Ангилал", "Үлдэгдэл", "Өртөг", "Үнэ", "Статус", "Үйлдэл"]
                    : ["Код", "Нэр", "Ангилал", "Хугацаа", "Үнэ", "Хэрэглэсэн", "Төлөв", "Үйлдэл"]
                  ).map((h) => (
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
                {services.map((svc) => {
                  const stockNum = svc.stock
                    ? Number.parseFloat(svc.stock.toString())
                    : 0;
                  const level = isGoods ? stockLevel(stockNum) : null;
                  return (
                    <ClickableRow
                      key={svc.id}
                      href={`/dashboard/services/${svc.id}`}
                    >
                      <td className="px-5 py-4 font-plex-mono text-xs text-[var(--oc-muted2)]">
                        {svc.code ?? "—"}
                      </td>
                      <td className="px-5 py-4">
                        <Link
                          href={`/dashboard/services/${svc.id}`}
                          className="text-sm font-medium text-[var(--oc-ink)] hover:text-[var(--oc-accent-hi)] transition-colors"
                        >
                          {svc.name}
                        </Link>
                        {svc.description ? (
                          <div className="text-xs text-[var(--oc-muted3)] mt-0.5 line-clamp-1">
                            {svc.description}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-5 py-4 text-sm">
                        {svc.category ? (
                          <Chip tone="neutral" bordered>{svc.category.name}</Chip>
                        ) : (
                          <span className="text-[var(--oc-muted4)] text-xs">—</span>
                        )}
                      </td>
                      {isGoods ? (
                        <td className="px-5 py-4 text-sm text-[var(--oc-ink2)]">
                          {formatStock(stockNum, svc.unit?.name ?? null)}
                        </td>
                      ) : (
                        <td className="px-5 py-4 text-sm text-[var(--oc-ink2)]">
                          {formatDuration(
                            svc.durationValue?.toString() ?? null,
                            svc.durationUnit?.name ?? null,
                          )}
                        </td>
                      )}
                      {isGoods ? (
                        <td className="px-5 py-4 font-plex-mono text-sm text-[var(--oc-muted2)]">
                          {svc.costPrice
                            ? formatTugrik(svc.costPrice.toString())
                            : "—"}
                        </td>
                      ) : (
                        <td className="px-5 py-4 font-plex-mono text-sm text-[var(--oc-ink2)]">
                          {formatTugrik(svc.price.toString())}
                          {svc.unit?.name ? (
                            <span className="text-[var(--oc-muted4)]">
                              {" / "}
                              {svc.unit.name}
                            </span>
                          ) : null}
                        </td>
                      )}
                      {isGoods ? (
                        <td className="px-5 py-4 font-plex-mono text-sm text-[var(--oc-ink2)]">
                          {formatTugrik(svc.price.toString())}
                        </td>
                      ) : (
                        <td className="px-5 py-4 font-plex-mono text-sm text-[var(--oc-muted2)]">
                          {svc._count.items}
                        </td>
                      )}
                      <td className="px-5 py-4">
                        {isGoods && level ? (
                          <Chip tone={STOCK_TONE[level]}>{STOCK_LABEL[level]}</Chip>
                        ) : (
                          <Chip tone={svc.isActive ? "ok" : "neutral"}>
                            {svc.isActive ? "Идэвхтэй" : "Идэвхгүй"}
                          </Chip>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {canRemove ? (
                          <div className="flex items-center justify-end">
                            <form action={deleteServiceAction}>
                              <input type="hidden" name="id" value={svc.id} />
                              <button
                                type="submit"
                                className="text-xs text-red-400 hover:text-red-300 light:text-red-600 light:hover:text-red-700 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-red-500/10"
                                title={
                                  svc._count.items > 0
                                    ? "Захиалгад ашиглагдсан тул архивлагдана"
                                    : "Устгана"
                                }
                              >
                                {svc._count.items > 0 ? "Архив" : "Устгах"}
                              </button>
                            </form>
                          </div>
                        ) : null}
                      </td>
                    </ClickableRow>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination
            page={meta.page}
            totalPages={meta.totalPages}
            total={meta.total}
          />
        </div>
      )}
    </div>
  );
}
