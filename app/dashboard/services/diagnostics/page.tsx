import Link from "next/link";
import {
  deleteTemplateAction,
  duplicateTemplateAction,
} from "@/app/_actions/diagnostic-templates";
import { ClickableRow } from "@/app/_components/clickable-row";
import { AddLinkButton, Chip } from "@/app/_components/landing-ops-ui";
import { EmptyState } from "@/app/_components/page-header";
import { Pagination } from "@/app/_components/pagination";
import { buildMeta, getPageInfo } from "@/lib/pagination";
import { requireUser } from "@/lib/auth";
import { canCreate, canDelete, canView } from "@/lib/auth/roles";
import { redirect } from "next/navigation";
import {
  DIAGNOSTIC_TYPE_BADGE,
  DIAGNOSTIC_TYPE_LABEL,
  type DiagnosticType,
} from "@/lib/diagnostics";
import { formatTugrik } from "@/lib/orders";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Оношилгоо — Үйлчилгээ",
};

export default async function DiagnosticsServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requireUser();
  if (!canView(user, "diagnostics")) redirect("/dashboard");
  const canAdd = canCreate(user, "diagnostics");
  const canRemove = canDelete(user, "diagnostics");

  const { page: pageParam } = await searchParams;
  const where = { tenantId: user.tenantId };
  const { page, pageSize, skip, take } = getPageInfo(pageParam);
  const [templates, total] = await Promise.all([
    prisma.diagnosticTemplate.findMany({
      where,
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
      skip,
      take,
      include: {
        _count: { select: { reports: true } },
        category: { select: { name: true } },
      },
    }),
    prisma.diagnosticTemplate.count({ where }),
  ]);
  const meta = buildMeta(total, page, pageSize);

  return (
    <div className="p-4 sm:p-6 max-w-full flex-1 flex flex-col min-h-0 w-full">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--oc-ink)]">Оношилгоо</h1>
          <p className="text-sm text-[var(--oc-muted3)] mt-1">
            Оношилгооны үйлчилгээний жагсаалт. Үнэ ба бүтэц тус бүрд тохируулна.
          </p>
        </div>
        {canAdd ? (
          <AddLinkButton href="/dashboard/services/diagnostics/new">Нэмэх</AddLinkButton>
        ) : null}
      </div>

      {templates.length === 0 ? (
        <EmptyState
          title="Оношилгоо алга байна"
          description="Машин хүлээж авах, үйлчилгээний дараах шалгалт зэрэгт зориулсан оношилгоо үүсгээрэй."
          cta={
            canAdd ? (
              <AddLinkButton href="/dashboard/services/diagnostics/new">
                Эхний оношилгоо үүсгэх
              </AddLinkButton>
            ) : null
          }
        />
      ) : (
        <div className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] overflow-hidden flex-1 min-h-0 flex flex-col">
          <div className="overflow-auto flex-1 min-h-0">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="border-b border-[var(--oc-line)]">
                  {[
                    "Нэр",
                    "Ангилал",
                    "Төрөл",
                    "Үнэ",
                    "Хугацаа",
                    "Хувилбар",
                    "Хэрэглэсэн",
                    "Төлөв",
                    "Үйлдэл",
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
                {templates.map((t) => {
                  const type = t.type as DiagnosticType;
                  return (
                    <ClickableRow
                      key={t.id}
                      href={`/dashboard/services/diagnostics/${t.id}`}
                    >
                      <td className="px-5 py-4">
                        <div className="text-sm font-medium text-[var(--oc-ink)]">
                          {t.name}
                        </div>
                        {t.description ? (
                          <div className="text-xs text-[var(--oc-muted3)] mt-0.5 line-clamp-1">
                            {t.description}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-5 py-4 text-sm">
                        {t.category ? (
                          <Chip tone="neutral" bordered>{t.category.name}</Chip>
                        ) : (
                          <span className="text-[var(--oc-muted4)] text-xs">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`text-xs px-2.5 py-1 rounded-full ${DIAGNOSTIC_TYPE_BADGE[type]}`}
                        >
                          {DIAGNOSTIC_TYPE_LABEL[type]}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-plex-mono text-sm text-[var(--oc-ink2)]">
                        {t.price ? formatTugrik(t.price.toString()) : "—"}
                      </td>
                      <td className="px-5 py-4 font-plex-mono text-sm text-[var(--oc-muted2)]">
                        {t.durationMin != null ? `${t.durationMin}мин` : "—"}
                      </td>
                      <td className="px-5 py-4 font-plex-mono text-sm text-[var(--oc-muted2)]">
                        v{t.version}
                      </td>
                      <td className="px-5 py-4 font-plex-mono text-sm text-[var(--oc-muted2)]">
                        {t._count.reports}
                      </td>
                      <td className="px-5 py-4">
                        <Chip tone={t.isActive ? "ok" : "neutral"}>
                          {t.isActive ? "Идэвхтэй" : "Идэвхгүй"}
                        </Chip>
                      </td>
                      <td className="px-5 py-4">
                        {canRemove ? (
                          <div className="flex items-center justify-end gap-1">
                            <Link
                              href={`/dashboard/services/diagnostics/${t.id}`}
                              className="text-xs text-[var(--oc-accent)] hover:text-[var(--oc-accent-hi)] transition-colors px-2.5 py-1.5 rounded-lg hover:bg-[var(--oc-accent)]/10"
                            >
                              Засах
                            </Link>
                            <form action={duplicateTemplateAction}>
                              <input type="hidden" name="id" value={t.id} />
                              <button
                                type="submit"
                                className="text-xs text-[var(--oc-muted2)] hover:text-[var(--oc-ink2)] transition-colors px-2.5 py-1.5 rounded-lg hover:bg-white/[0.06]"
                              >
                                Хуулах
                              </button>
                            </form>
                            <form action={deleteTemplateAction}>
                              <input type="hidden" name="id" value={t.id} />
                              <button
                                type="submit"
                                className="text-xs text-red-400 hover:text-red-300 light:text-red-600 light:hover:text-red-700 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-red-500/10"
                                title={
                                  t._count.reports > 0
                                    ? "Бөглөгдсөн тайлантай тул архивлагдана"
                                    : "Устгана"
                                }
                              >
                                {t._count.reports > 0 ? "Архив" : "Устгах"}
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
