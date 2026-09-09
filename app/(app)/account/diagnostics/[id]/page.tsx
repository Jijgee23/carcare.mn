import { notFound } from "next/navigation";
import { BtnLink } from "@/app/_components/landing-ops-ui";
import { ReportAnswers } from "@/app/dashboard/diagnostics/reports/[id]/report-answers";
import { requireAccount } from "@/lib/auth/account";
import {
  DIAGNOSTIC_TYPE_BADGE,
  DIAGNOSTIC_TYPE_LABEL,
  SEVERITY_BADGE,
  SEVERITY_LABEL,
  type DiagnosticType,
  type ReportData,
  type ReportSeverity,
  type TemplateSchema,
  emptySchema,
} from "@/lib/diagnostics";
import { prisma } from "@/lib/prisma";
import { ownedVehicleIdsForAccount } from "@/lib/vehicles";

export const metadata = {
  title: "Оношилгооны тайлан",
};

export const dynamic = "force-dynamic";

// Нэг оношилгооны тайланг унших (customer, read-only) — worker талын дэлгэрэнгүй
// хуудастай ижил render хийнэ (харах: app/dashboard/diagnostics/reports/[id]),
// зөвшөөрлийн зарчим account/orders/[id]-тэй ижил: account-тай холбоотой
// Customer-ийн ЭСВЭЛ эзэмшлийн машины тайлан байх ёстой. Засах/устгах/PDF
// боломжгүй.
export default async function AccountDiagnosticDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const account = await requireAccount();
  const { id } = await params;
  const ownedVehicleIds = await ownedVehicleIdsForAccount(account.id, account.phone);

  const report = await prisma.diagnosticReport.findFirst({
    where: {
      id,
      OR: [
        { customer: { accountId: account.id } },
        ...(ownedVehicleIds.length
          ? [{ vehicleId: { in: ownedVehicleIds } }]
          : []),
      ],
    },
    select: {
      id: true,
      templateVersion: true,
      data: true,
      maxSeverity: true,
      mileageAtReport: true,
      notes: true,
      createdAt: true,
      template: { select: { name: true, type: true, schema: true } },
      vehicle: { select: { plate: true, make: true, model: true, year: true } },
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
    <div className="w-full max-w-full flex flex-col gap-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">{report.template.name}</h1>
          <p className="text-[var(--oc-muted)] text-sm mt-0.5">
            {report.vehicle.plate} · {report.vehicle.make} {report.vehicle.model}
            {report.vehicle.year ? ` · ${report.vehicle.year}` : ""}
          </p>
          <p className="text-[var(--oc-muted3)] text-xs mt-0.5">
            {report.createdAt.toLocaleString("mn-MN", { hour12: false })} ·{" "}
            {report.branch.name}
            {report.mileageAtReport != null
              ? ` · ${report.mileageAtReport.toLocaleString("mn-MN")} км`
              : ""}
          </p>
        </div>
        <BtnLink href="/account/diagnostics" variant="ghost" className="shrink-0">
          ← Буцах
        </BtnLink>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={`text-xs px-2.5 py-1 rounded-full ${DIAGNOSTIC_TYPE_BADGE[tp]}`}
        >
          {DIAGNOSTIC_TYPE_LABEL[tp]}
        </span>
        {report.maxSeverity ? (
          <span
            className={`text-xs px-2.5 py-1 rounded-full border ${SEVERITY_BADGE[report.maxSeverity as ReportSeverity]}`}
          >
            {SEVERITY_LABEL[report.maxSeverity as ReportSeverity]}
          </span>
        ) : null}
      </div>

      {report.notes ? (
        <div className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] p-4 text-sm text-[var(--oc-muted2)]">
          {report.notes}
        </div>
      ) : null}

      <ReportAnswers schema={schema} data={data} />
    </div>
  );
}
