import Link from "next/link";
import { deleteServiceAction } from "@/app/_actions/services";
import {
  EmptyState,
  PageHeader,
  PrimaryLinkButton,
} from "@/app/_components/page-header";
import { Pagination } from "@/app/_components/pagination";
import { buildMeta, getPageInfo } from "@/lib/pagination";
import { requireUser } from "@/lib/auth";
import { canCreate, canDelete, canView } from "@/lib/auth/roles";
import { redirect } from "next/navigation";
import { formatTugrik } from "@/lib/orders";
import { prisma } from "@/lib/prisma";
import {
  STOCK_BADGE,
  STOCK_LABEL,
  SERVICE_KIND_DESCRIPTION,
  SERVICE_KIND_LABEL,
  SERVICE_KIND_SLUG,
  type ServiceKind,
  formatDuration,
  formatStock,
  stockLevel,
} from "@/lib/services";

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
      },
    }),
    prisma.service.count({ where }),
  ]);
  const meta = buildMeta(total, page, pageSize);

  const newHref = `/dashboard/services/new?type=${SERVICE_KIND_SLUG[type]}`;
  const isGoods = type === "GOODS";

  return (
    <div className="p-6 sm:p-8 max-full flex-1 flex flex-col min-h-0 w-full">
      <PageHeader
        title={SERVICE_KIND_LABEL[type]}
        description={SERVICE_KIND_DESCRIPTION[type]}
        actions={
          canAdd ? <PrimaryLinkButton href={newHref}>Нэмэх</PrimaryLinkButton> : null
        }
      />

      {services.length === 0 ? (
        <EmptyState
          title={`${SERVICE_KIND_LABEL[type]} бүртгээгүй байна`}
          description="Шинээр нэмж эхлээрэй."
          cta={
            canAdd ? <PrimaryLinkButton href={newHref}>Эхний нэмэх</PrimaryLinkButton> : null
          }
        />
      ) : (
        <div className="glass rounded-2xl overflow-hidden flex-1 min-h-0 flex flex-col">
          <div className="overflow-auto flex-1 min-h-0">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {(isGoods
                    ? ["Код", "Нэр", "Үлдэгдэл", "Өртөг", "Үнэ", "Статус", ""]
                    : ["Код", "Нэр", "Хугацаа", "Үнэ", "Хэрэглэсэн", "Төлөв", ""]
                  ).map((h) => (
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
                {services.map((svc) => {
                  const stockNum = svc.stock
                    ? Number.parseFloat(svc.stock.toString())
                    : 0;
                  const level = isGoods ? stockLevel(stockNum) : null;
                  return (
                    <tr
                      key={svc.id}
                      className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-5 py-4 text-xs font-mono text-white/60">
                        {svc.code ?? "—"}
                      </td>
                      <td className="px-5 py-4">
                        <Link
                          href={`/dashboard/services/${svc.id}`}
                          className="text-sm font-medium text-white/90 hover:text-violet-300 transition-colors"
                        >
                          {svc.name}
                        </Link>
                        {svc.description ? (
                          <div className="text-xs text-white/40 mt-0.5 line-clamp-1">
                            {svc.description}
                          </div>
                        ) : null}
                      </td>
                      {isGoods ? (
                        <td className="px-5 py-4 text-sm text-white/80">
                          {formatStock(stockNum, svc.unit?.name ?? null)}
                        </td>
                      ) : (
                        <td className="px-5 py-4 text-sm text-white/80">
                          {formatDuration(
                            svc.durationValue?.toString() ?? null,
                            svc.durationUnit?.name ?? null,
                          )}
                        </td>
                      )}
                      {isGoods ? (
                        <td className="px-5 py-4 text-sm text-white/50">
                          {svc.costPrice
                            ? formatTugrik(svc.costPrice.toString())
                            : "—"}
                        </td>
                      ) : (
                        <td className="px-5 py-4 text-sm text-white/80">
                          {formatTugrik(svc.price.toString())}
                          {svc.unit?.name ? (
                            <span className="text-white/30">
                              {" / "}
                              {svc.unit.name}
                            </span>
                          ) : null}
                        </td>
                      )}
                      {isGoods ? (
                        <td className="px-5 py-4 text-sm text-white/80">
                          {formatTugrik(svc.price.toString())}
                        </td>
                      ) : (
                        <td className="px-5 py-4 text-sm text-white/60">
                          {svc._count.items}
                        </td>
                      )}
                      <td className="px-5 py-4">
                        {isGoods && level ? (
                          <span
                            className={`text-xs px-2.5 py-1 rounded-full ${STOCK_BADGE[level]}`}
                          >
                            {STOCK_LABEL[level]}
                          </span>
                        ) : svc.isActive ? (
                          <span className="text-xs text-emerald-300">
                            Идэвхтэй
                          </span>
                        ) : (
                          <span className="text-xs text-white/40">
                            Идэвхгүй
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {canRemove ? (
                          <div className="flex items-center justify-end gap-1">
                            <Link
                              href={`/dashboard/services/${svc.id}`}
                              className="text-xs text-violet-400 hover:text-violet-300 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-violet-500/10"
                            >
                              Засах
                            </Link>
                            <form action={deleteServiceAction}>
                              <input type="hidden" name="id" value={svc.id} />
                              <button
                                type="submit"
                                className="text-xs text-red-400 hover:text-red-300 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-red-500/10"
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
                    </tr>
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
