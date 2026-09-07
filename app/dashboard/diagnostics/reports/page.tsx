import { ClickableRow } from "@/app/_components/clickable-row";
import { AddLinkButton } from "@/app/_components/landing-ops-ui";
import { EmptyState } from "@/app/_components/page-header";
import { Pagination } from "@/app/_components/pagination";
import { buildMeta, getPageInfo } from "@/lib/pagination";
import { requireUser } from "@/lib/auth";
import { workingBranchScopeId } from "@/lib/auth/roles";
import { customerLabel } from "@/lib/customers";
import {
  DIAGNOSTIC_TYPE_BADGE,
  DIAGNOSTIC_TYPE_LABEL,
  type DiagnosticType,
} from "@/lib/diagnostics";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Оношилгооны тайлангууд",
};

export default async function ReportsListPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requireUser();

  const { page: pageParam } = await searchParams;
  const scopeBranchId = workingBranchScopeId(user);
  const where = {
    tenantId: user.tenantId,
    ...(scopeBranchId ? { branchId: scopeBranchId } : {}),
  };
  const { page, pageSize, skip, take } = getPageInfo(pageParam);
  const [reports, total] = await Promise.all([
    prisma.diagnosticReport.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: {
        template: { select: { name: true, type: true } },
        customer: { select: { fullName: true, phone: true } },
        vehicle: { select: { plate: true, make: true, model: true } },
        branch: { select: { name: true } },
        filledBy: { select: { firstName: true, lastName: true } },
        order: { select: { number: true } },
      },
    }),
    prisma.diagnosticReport.count({ where }),
  ]);
  const meta = buildMeta(total, page, pageSize);

  return (
    <div className="p-4 sm:p-6 max-w-full flex-1 flex flex-col min-h-0 w-full">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--oc-ink)]">Оношилгооны тайлангууд</h1>
          <p className="text-sm text-[var(--oc-muted3)] mt-1">
            Бөглөгдсөн оношилгооны тайлангуудын жагсаалт · {total} тайлан
          </p>
        </div>
        <AddLinkButton href="/dashboard/diagnostics/new">Шинэ тайлан</AddLinkButton>
      </div>

      {reports.length === 0 ? (
        <EmptyState
          title="Тайлан алга байна"
          description="Шинэ оношилгоо хийж эхлээрэй. Машин, үйлчлүүлэгчээ сонгож, загвараа бөглөнө."
          cta={
            <AddLinkButton href="/dashboard/diagnostics/new">Эхний тайлан үүсгэх</AddLinkButton>
          }
        />
      ) : (
        <div className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] overflow-hidden flex-1 min-h-0 flex flex-col">
          <div className="overflow-auto flex-1 min-h-0">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="border-b border-[var(--oc-line)]">
                  {[
                    "Огноо",
                    "Загвар",
                    "Үйлчлүүлэгч",
                    "Машин",
                    "Салбар",
                    "Бөглөсөн",
                    "Захиалга",
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
                {reports.map((r) => {
                  const tp = r.template.type as DiagnosticType;
                  return (
                    <ClickableRow key={r.id} href={`/dashboard/diagnostics/reports/${r.id}`}>
                      <td className="px-5 py-3 font-plex-mono text-xs text-[var(--oc-muted3)] whitespace-nowrap">
                        {r.createdAt.toLocaleString("mn-MN", {
                          year: "numeric",
                          month: "short",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                        })}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-col gap-1">
                          <span
                            className={`text-[10px] self-start px-2 py-0.5 rounded-full ${DIAGNOSTIC_TYPE_BADGE[tp]}`}
                          >
                            {DIAGNOSTIC_TYPE_LABEL[tp]}
                          </span>
                          <span className="text-sm text-[var(--oc-ink)]">
                            {r.template.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-sm text-[var(--oc-muted2)]">
                        {customerLabel(r.customer)}
                      </td>
                      <td className="px-5 py-3 text-sm">
                        <div className="text-[var(--oc-muted2)]">
                          {r.vehicle.make} {r.vehicle.model}
                        </div>
                        <div className="font-plex-mono text-xs text-[var(--oc-muted3)]">
                          {r.vehicle.plate}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-sm text-[var(--oc-muted2)]">
                        {r.branch.name}
                      </td>
                      <td className="px-5 py-3 text-sm text-[var(--oc-muted2)]">
                        {r.filledBy
                          ? `${r.filledBy.lastName} ${r.filledBy.firstName}`
                          : "—"}
                      </td>
                      <td className="px-5 py-3 font-plex-mono text-sm text-[var(--oc-muted2)]">
                        {r.order ? `#${r.order.number}` : "—"}
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
