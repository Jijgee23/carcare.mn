import Link from "next/link";
import { Prisma } from "@/app/generated/prisma/client";
import { BtnLink } from "@/app/_components/landing-ops-ui";
import { requireAccount } from "@/lib/auth/account";
import {
  DIAGNOSTIC_TYPE_BADGE,
  DIAGNOSTIC_TYPE_LABEL,
  SEVERITY_BADGE,
  SEVERITY_LABEL,
  type DiagnosticType,
  type ReportSeverity,
} from "@/lib/diagnostics";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Оношилгооны түүх",
};

export const dynamic = "force-dynamic";

function formatDate(d: Date): string {
  return d.toLocaleDateString("mn-MN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

// Миний бүх машины оношилгооны тайлангийн түүх (cross-tenant) — эзэмшлийн
// машины БАТАЛГААЖСАН холбоос эсвэл account-той шууд холбоотой Customer-ийн
// тайлангууд. Зарчим `account/history`-тэй ижил (харах: тэнд байгаа тайлбар).
export default async function AccountDiagnosticsPage() {
  const account = await requireAccount();

  const ownedLinks = await prisma.tenantVehicle.findMany({
    where: {
      OR: [
        { customer: { accountId: account.id } },
        { customer: { phone: { endsWith: account.phone } } },
      ],
    },
    select: { vehicleId: true },
    distinct: ["vehicleId"],
  });
  const ownedVehicleIds = ownedLinks.map((l) => l.vehicleId);

  const where: Prisma.DiagnosticReportWhereInput = {
    OR: [
      { customer: { accountId: account.id } },
      ...(ownedVehicleIds.length
        ? [{ vehicleId: { in: ownedVehicleIds } }]
        : []),
    ],
  };

  const reports = await prisma.diagnosticReport.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      mileageAtReport: true,
      maxSeverity: true,
      createdAt: true,
      template: { select: { name: true, type: true } },
      vehicle: { select: { plate: true, make: true, model: true } },
      branch: { select: { name: true } },
    },
  });

  return (
    <div className="w-full flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Оношилгооны түүх</h1>
          <p className="text-[var(--oc-muted3)] text-sm mt-0.5">
            Таны машинд хийгдсэн бүх оношилгоо, үзлэгийн тайлан
          </p>
        </div>
        <BtnLink href="/account" variant="ghost">
          ← Буцах
        </BtnLink>
      </div>

      {reports.length === 0 ? (
        <div className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] p-10 text-center text-sm text-[var(--oc-muted3)]">
          Одоогоор оношилгооны тайлан алга. Үйлчилгээ хийгдэж, тайлан
          бөглөгдсөний дараа энд харагдана.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {reports.map((r) => {
            const tp = r.template.type as DiagnosticType;
            return (
              <Link
                key={r.id}
                href={`/account/diagnostics/${r.id}`}
                className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] p-4 block hover:bg-[var(--oc-panel2)] transition-colors"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-[11px] px-2.5 py-1 rounded-full ${DIAGNOSTIC_TYPE_BADGE[tp]}`}
                      >
                        {DIAGNOSTIC_TYPE_LABEL[tp]}
                      </span>
                      <span className="font-semibold text-[var(--oc-ink)]">
                        {r.template.name}
                      </span>
                    </div>
                    <div className="text-sm text-[var(--oc-muted)] mt-1">
                      {r.vehicle.plate} · {r.vehicle.make} {r.vehicle.model}
                    </div>
                    <div className="text-xs text-[var(--oc-muted3)] mt-0.5 tabular-nums">
                      {formatDate(r.createdAt)} · {r.branch.name}
                      {r.mileageAtReport != null
                        ? ` · ${r.mileageAtReport.toLocaleString("mn-MN")} км`
                        : ""}
                    </div>
                  </div>
                  {r.maxSeverity ? (
                    <span
                      className={`shrink-0 text-[11px] px-2.5 py-1 rounded-full border ${SEVERITY_BADGE[r.maxSeverity as ReportSeverity]}`}
                    >
                      {SEVERITY_LABEL[r.maxSeverity as ReportSeverity]}
                    </span>
                  ) : null}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
