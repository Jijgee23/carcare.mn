import Link from "next/link";
import {
  deleteTemplateAction,
  duplicateTemplateAction,
} from "@/app/_actions/diagnostic-templates";
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
      include: { _count: { select: { reports: true } } },
    }),
    prisma.diagnosticTemplate.count({ where }),
  ]);
  const meta = buildMeta(total, page, pageSize);

  return (
    <div className="p-6 sm:p-8 max-full flex-1 flex flex-col min-h-0 w-full">
      <PageHeader
        title="Оношилгоо"
        description="Оношилгооны үйлчилгээний жагсаалт. Үнэ ба бүтэц тус бүрд тохируулна."
        actions={
          canAdd ? (
            <PrimaryLinkButton href="/dashboard/services/diagnostics/new">
              Нэмэх
            </PrimaryLinkButton>
          ) : null
        }
      />

      {templates.length === 0 ? (
        <EmptyState
          title="Оношилгоо алга байна"
          description="Машин хүлээж авах, үйлчилгээний дараах шалгалт зэрэгт зориулсан оношилгоо үүсгээрэй."
          cta={
            canAdd ? (
              <PrimaryLinkButton href="/dashboard/services/diagnostics/new">
                Эхний оношилгоо үүсгэх
              </PrimaryLinkButton>
            ) : null
          }
        />
      ) : (
        <div className="glass rounded-2xl overflow-hidden flex-1 min-h-0 flex flex-col">
          <div className="overflow-auto flex-1 min-h-0">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {[
                    "Нэр",
                    "Төрөл",
                    "Үнэ",
                    "Хугацаа",
                    "Хувилбар",
                    "Хэрэглэсэн",
                    "Төлөв",
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
                {templates.map((t) => {
                  const type = t.type as DiagnosticType;
                  return (
                    <tr
                      key={t.id}
                      className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-5 py-4">
                        <div className="text-sm font-medium text-white/90">
                          {t.name}
                        </div>
                        {t.description ? (
                          <div className="text-xs text-white/40 mt-0.5 line-clamp-1">
                            {t.description}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`text-xs px-2.5 py-1 rounded-full ${DIAGNOSTIC_TYPE_BADGE[type]}`}
                        >
                          {DIAGNOSTIC_TYPE_LABEL[type]}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-white/80">
                        {t.price ? formatTugrik(t.price.toString()) : "—"}
                      </td>
                      <td className="px-5 py-4 text-sm text-white/60">
                        {t.durationMin != null ? `${t.durationMin}мин` : "—"}
                      </td>
                      <td className="px-5 py-4 text-sm text-white/60">
                        v{t.version}
                      </td>
                      <td className="px-5 py-4 text-sm text-white/60">
                        {t._count.reports}
                      </td>
                      <td className="px-5 py-4">
                        {t.isActive ? (
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
                              href={`/dashboard/services/diagnostics/${t.id}`}
                              className="text-xs text-violet-400 hover:text-violet-300 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-violet-500/10"
                            >
                              Засах
                            </Link>
                            <form action={duplicateTemplateAction}>
                              <input type="hidden" name="id" value={t.id} />
                              <button
                                type="submit"
                                className="text-xs text-white/50 hover:text-white/80 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-white/[0.06]"
                              >
                                Хуулах
                              </button>
                            </form>
                            <form action={deleteTemplateAction}>
                              <input type="hidden" name="id" value={t.id} />
                              <button
                                type="submit"
                                className="text-xs text-red-400 hover:text-red-300 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-red-500/10"
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
