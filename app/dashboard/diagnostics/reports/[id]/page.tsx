import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteReportAction } from "@/app/_actions/diagnostic-reports";
import { PageHeader } from "@/app/_components/page-header";
import { requireUser } from "@/lib/auth";
import { branchScopeId } from "@/lib/auth/roles";
import { customerLabel } from "@/lib/customers";
import {
  DIAGNOSTIC_TYPE_BADGE,
  DIAGNOSTIC_TYPE_LABEL,
  itemPositions,
  positionedKey,
  type DiagnosticType,
  type ReportData,
  type ReportEntry,
  type TemplateItem,
  type TemplateSchema,
  emptySchema,
} from "@/lib/diagnostics";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Оношилгооны тайлан",
};

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const scopeBranchId = branchScopeId(user);

  const report = await prisma.diagnosticReport.findFirst({
    where: {
      id,
      tenantId: user.tenantId,
      ...(scopeBranchId ? { branchId: scopeBranchId } : {}),
    },
    include: {
      template: { select: { id: true, name: true, schema: true, type: true } },
      filledBy: { select: { firstName: true, lastName: true } },
      order: { select: { id: true, number: true } },
      customer: { select: { id: true, fullName: true, phone: true } },
      vehicle: { select: { id: true, plate: true, make: true, model: true, year: true } },
      branch: { select: { name: true } },
    },
  });
  if (!report) notFound();

  let schema: TemplateSchema;
  try {
    schema = report.template.schema as unknown as TemplateSchema;
    if (!schema.sections) schema = emptySchema();
  } catch {
    schema = emptySchema();
  }
  const data = (report.data ?? {}) as ReportData;
  const tp = report.template.type as DiagnosticType;

  return (
    <div className="p-6 sm:p-8 max-full flex-1 flex flex-col min-h-0 w-full">
      <PageHeader
        title={report.template.name}
        description={`v${report.templateVersion} · ${report.createdAt.toLocaleString("mn-MN")}`}
        actions={
          <span
            className={`text-xs px-2.5 py-1 rounded-full ${DIAGNOSTIC_TYPE_BADGE[tp]}`}
          >
            {DIAGNOSTIC_TYPE_LABEL[tp]}
          </span>
        }
      />

      <div className="glass rounded-2xl p-5 mb-6 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <Row label="Үйлчлүүлэгч">
          <Link
            href={`/dashboard/customers/${report.customer.id}`}
            className="text-violet-300 hover:text-violet-200"
          >
            {customerLabel(report.customer)}
          </Link>
          <div className="text-xs text-white/40">{report.customer.phone}</div>
        </Row>
        <Row label="Машин">
          <Link
            href={`/dashboard/vehicles/${report.vehicle.id}`}
            className="text-violet-300 hover:text-violet-200"
          >
            {report.vehicle.make} {report.vehicle.model}
          </Link>
          <div className="font-mono text-xs text-white/40">
            {report.vehicle.plate}
            {report.vehicle.year ? ` · ${report.vehicle.year}` : ""}
          </div>
        </Row>
        <Row label="Салбар">{report.branch.name}</Row>
        <Row label="Бөглөсөн">
          {report.filledBy
            ? `${report.filledBy.lastName} ${report.filledBy.firstName}`
            : "—"}
        </Row>
        {report.order ? (
          <Row label="Захиалга">
            <Link
              href={`/dashboard/orders/${report.order.id}`}
              className="text-violet-300 hover:text-violet-200"
            >
              #{report.order.number}
            </Link>
          </Row>
        ) : null}
        {report.mileageAtReport !== null ? (
          <Row label="Гүйлт">
            {report.mileageAtReport.toLocaleString("mn-MN")} км
          </Row>
        ) : null}
        {report.notes ? (
          <div className="sm:col-span-2">
            <dt className="text-xs text-white/40">Тэмдэглэл</dt>
            <dd className="text-white/80 whitespace-pre-wrap">
              {report.notes}
            </dd>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-5">
        {schema.sections.map((section) => (
          <section
            key={section.id}
            className="glass rounded-2xl border border-white/[0.08] overflow-hidden"
          >
            <div className="px-5 py-3 border-b border-white/[0.06]">
              <h2 className="font-semibold text-sm">{section.title}</h2>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {section.items.map((item) => {
                const positions = itemPositions(item);
                return (
                  <div
                    key={item.id}
                    className="px-5 py-3 flex flex-col gap-2"
                  >
                    <div className="text-xs text-white/40">{item.label}</div>
                    {positions ? (
                      <div className="flex flex-col gap-3 pl-3 border-l border-white/[0.06]">
                        {positions.map((pos) => (
                          <div key={pos.code} className="flex flex-col gap-1">
                            <div className="text-[11px] text-white/50">
                              {pos.label}
                            </div>
                            <EntryView
                              item={item}
                              entry={data[positionedKey(item.id, pos.code)] ?? {}}
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EntryView item={item} entry={data[item.id] ?? {}} />
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        {report.signatureUrl ? (
          <section className="glass rounded-2xl p-5 border border-white/[0.08]">
            <h2 className="font-semibold text-sm mb-3">
              Үйлчлүүлэгчийн гарын үсэг
            </h2>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={report.signatureUrl}
              alt="Гарын үсэг"
              className="w-64 h-32 object-contain rounded-lg border border-white/[0.06] bg-white/[0.04]"
            />
          </section>
        ) : null}
      </div>

      <div className="flex items-center justify-between mt-6">
        <Link
          href="/dashboard/diagnostics/reports"
          className="text-sm text-white/50 hover:text-white/80"
        >
          ← Жагсаалт руу буцах
        </Link>
        <form action={deleteReportAction}>
          <input type="hidden" name="id" value={report.id} />
          <button
            type="submit"
            className="text-xs text-red-400 hover:text-red-300 px-3 py-1.5 rounded-lg hover:bg-red-500/10"
          >
            Тайланг устгах
          </button>
        </form>
      </div>
    </div>
  );
}

// Нэг талбарын (item эсвэл байрлалын) утга/зураг/гарын үсэг/тэмдэглэлийг харуулна.
function EntryView({
  item,
  entry,
}: {
  item: TemplateItem;
  entry: ReportEntry;
}) {
  return (
    <>
      <div className="text-sm text-white/90">
        {renderValue(item.type, entry.value)}
      </div>
      {entry.photos && entry.photos.length > 0 ? (
        <div className="flex flex-wrap gap-2 mt-1">
          {entry.photos.map((p, idx) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={idx}
              src={p}
              alt=""
              className="w-24 h-24 object-cover rounded-lg border border-white/[0.06]"
            />
          ))}
        </div>
      ) : null}
      {item.type === "signature" && typeof entry.value === "string" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={entry.value}
          alt="Гарын үсэг"
          className="w-48 h-24 object-contain rounded-lg border border-white/[0.06] bg-white/[0.04]"
        />
      ) : null}
      {entry.note ? (
        <div className="text-xs text-white/50 italic">
          Тэмдэглэл: {entry.note}
        </div>
      ) : null}
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-white/40">{label}</dt>
      <dd className="text-white/80">{children}</dd>
    </div>
  );
}

function renderValue(
  type: string,
  value: string | number | boolean | undefined,
): React.ReactNode {
  if (value === undefined || value === "" || value === null)
    return <span className="text-white/30">—</span>;
  if (type === "signature") return null;
  if (typeof value === "boolean") return value ? "Тийм" : "Үгүй";
  return String(value);
}
