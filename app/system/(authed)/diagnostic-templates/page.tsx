import {
  DIAGNOSTIC_TYPE_BADGE,
  DIAGNOSTIC_TYPE_LABEL,
  type DiagnosticType,
} from "@/lib/diagnostics";
import { formatTugrik } from "@/lib/orders";
import { AddLinkButton, Chip } from "@/app/_components/landing-ops-ui";
import { ClickableRow } from "@/app/_components/clickable-row";
import { PageHeader } from "@/app/_components/page-header";
import { requireSuperAdmin } from "@/lib/auth/system";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Оношилгооны загвар" };

export const dynamic = "force-dynamic";

export default async function SystemDiagnosticTemplatesPage() {
  await requireSuperAdmin();

  const templates = await prisma.diagnosticTemplate.findMany({
    where: { tenantId: null },
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    include: {
      _count: { select: { reports: true, grants: true } },
    },
  });

  return (
    <div className="p-4 sm:p-6 max-w-full flex-1 flex flex-col min-h-0 w-full">
      <PageHeader
        title="Оношилгооны загвар"
        description="Платформ даяар байгууллагуудад олгож болох, төвлөрсөн оношилгооны загварууд."
        actions={
          <AddLinkButton href="/system/diagnostic-templates/new">
            Нэмэх
          </AddLinkButton>
        }
      />

      {templates.length === 0 ? (
        <div className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] p-10 text-center text-sm text-[var(--oc-muted3)]">
          Одоогоор загвар алга байна.
        </div>
      ) : (
        <div className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] overflow-hidden flex-1 min-h-0 flex flex-col">
          <div className="overflow-auto flex-1 min-h-0">
            <table className="w-full min-w-[860px]">
              <thead>
                <tr className="border-b border-[var(--oc-line)]">
                  {[
                    "Нэр",
                    "Төрөл",
                    "Үнэ",
                    "Хугацаа",
                    "Хувилбар",
                    "Байгууллага",
                    "Хэрэглэсэн",
                    "Төлөв",
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
                      href={`/system/diagnostic-templates/${t.id}`}
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
                        {t._count.grants}
                      </td>
                      <td className="px-5 py-4 font-plex-mono text-sm text-[var(--oc-muted2)]">
                        {t._count.reports}
                      </td>
                      <td className="px-5 py-4">
                        <Chip tone={t.isActive ? "ok" : "neutral"}>
                          {t.isActive ? "Идэвхтэй" : "Идэвхгүй"}
                        </Chip>
                      </td>
                    </ClickableRow>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
