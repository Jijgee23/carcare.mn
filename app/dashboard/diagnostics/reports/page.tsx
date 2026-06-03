import Link from "next/link";
import { EmptyState, PageHeader, PrimaryLinkButton } from "@/app/_components/page-header";
import { Pagination } from "@/app/_components/pagination";
import { buildMeta, getPageInfo } from "@/lib/pagination";
import { requireUser } from "@/lib/auth";
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
  const where = { tenantId: user.tenantId };
  const { page, pageSize, skip, take } = getPageInfo(pageParam);
  const [reports, total] = await Promise.all([
    prisma.diagnosticReport.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: {
        template: { select: { name: true, type: true } },
        customer: { select: { fullName: true } },
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
    <div className="p-6 sm:p-8 max-full flex-1 flex flex-col min-h-0 w-full">
      <PageHeader
        title="Оношилгооны тайлангууд"
        description="Бөглөгдсөн оношилгооны тайлангуудын жагсаалт"
        actions={
          <PrimaryLinkButton href="/dashboard/diagnostics/new">
            Шинэ тайлан
          </PrimaryLinkButton>
        }
      />

      {reports.length === 0 ? (
        <EmptyState
          title="Тайлан алга байна"
          description="Шинэ оношилгоо хийж эхлээрэй. Машин, үйлчлүүлэгчээ сонгож, загвараа бөглөнө."
          cta={
            <PrimaryLinkButton href="/dashboard/diagnostics/new">
              Эхний тайлан үүсгэх
            </PrimaryLinkButton>
          }
        />
      ) : (
        <div className="glass rounded-2xl overflow-hidden flex-1 min-h-0 flex flex-col">
          <div className="overflow-auto flex-1 min-h-0">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {[
                    "Огноо",
                    "Загвар",
                    "Үйлчлүүлэгч",
                    "Машин",
                    "Салбар",
                    "Бөглөсөн",
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
                {reports.map((r) => {
                  const tp = r.template.type as DiagnosticType;
                  return (
                    <tr
                      key={r.id}
                      className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-5 py-3 text-xs text-white/50">
                        {r.createdAt.toLocaleString("mn-MN", {
                          year: "numeric",
                          month: "short",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-col gap-1">
                          <span
                            className={`text-[10px] self-start px-2 py-0.5 rounded-full ${DIAGNOSTIC_TYPE_BADGE[tp]}`}
                          >
                            {DIAGNOSTIC_TYPE_LABEL[tp]}
                          </span>
                          <span className="text-sm text-white/90">
                            {r.template.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-sm text-white/70">
                        {customerLabel(r.customer)}
                      </td>
                      <td className="px-5 py-3 text-sm">
                        <div className="text-white/70">
                          {r.vehicle.make} {r.vehicle.model}
                        </div>
                        <div className="font-mono text-xs text-white/40">
                          {r.vehicle.plate}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-sm text-white/60">
                        {r.branch.name}
                      </td>
                      <td className="px-5 py-3 text-sm text-white/60">
                        {r.filledBy
                          ? `${r.filledBy.lastName} ${r.filledBy.firstName}`
                          : "—"}
                      </td>
                      <td className="px-5 py-3 text-sm text-white/60">
                        {r.order ? `#${r.order.number}` : "—"}
                      </td>
                      <td className="px-5 py-3">
                        <Link
                          href={`/dashboard/diagnostics/reports/${r.id}`}
                          className="text-xs text-violet-400 hover:text-violet-300 px-2.5 py-1.5 rounded-lg hover:bg-violet-500/10"
                        >
                          Үзэх
                        </Link>
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
