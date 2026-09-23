import { jsonError, requireApiUser, requirePermission } from "@/lib/api";
import { resolveWorkingBranch } from "@/lib/auth/api-branch";
import { canViewOrder } from "@/lib/auth/order-access";
import { customerLabel } from "@/lib/customers";
import {
  emptySchema,
  type ReportData,
  type TemplateSchema,
} from "@/lib/diagnostics";
import { renderReportPdf, type DiagnosticReportPdfData } from "@/lib/diagnostics-pdf";
import { prisma } from "@/lib/prisma";

// Mobile-only, server-rendered PDF export (P5-B2). Additive: the web's
// existing print button and `AdvancedPDFButton`
// (app/dashboard/diagnostics/reports/[id]/pdf-generator.tsx) are untouched
// and keep rendering client-side exactly as before. This route mirrors the
// exact authorization and query/include shape of
// `GET /api/v1/diagnostics/reports/[id]/route.ts` (P5-B0's corrected
// pattern) so a mobile client gets identical access rules for the PDF as it
// does for the JSON report.
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;
  const denied = requirePermission(auth.user, "diagnostics.view");
  if (denied) return denied;
  const { id } = await ctx.params;
  const scopeResult = await resolveWorkingBranch(req, auth.user);
  if (scopeResult.response) return scopeResult.response;
  const scope = scopeResult.branchId;

  const report = await prisma.diagnosticReport.findFirst({
    where: {
      id,
      tenantId: auth.user.tenantId,
      ...(scope ? { branchId: scope } : {}),
    },
    include: {
      template: {
        select: {
          id: true,
          name: true,
          type: true,
          schema: true,
        },
      },
      customer: { select: { id: true, fullName: true, phone: true } },
      vehicle: {
        select: { id: true, plate: true, make: true, model: true, year: true },
      },
      branch: { select: { id: true, name: true } },
      filledBy: { select: { id: true, firstName: true, lastName: true } },
      order: { select: { id: true, number: true, assignedToId: true, branchId: true } },
    },
  });
  // 404 (not 403) for both "does not exist" and "exists but out of this
  // caller's order access" — matching the existing route exactly, so
  // existence is never leaked via a different status code.
  if (!report) return jsonError(404, "Тайлан олдсонгүй.");
  if (report.order && !canViewOrder(auth.user, report.order)) return jsonError(404, "Тайлан олдсонгүй.");

  let schema: TemplateSchema;
  try {
    schema = report.template.schema as unknown as TemplateSchema;
    if (!schema.sections) schema = emptySchema();
  } catch {
    schema = emptySchema();
  }
  const data = (report.data ?? {}) as ReportData;

  const pdfData: DiagnosticReportPdfData = {
    reportId: report.id,
    templateName: report.template.name,
    templateVersion: report.templateVersion,
    createdAt: report.createdAt,
    customerName: customerLabel(report.customer),
    customerPhone: report.customer.phone,
    vehicleMake: report.vehicle.make,
    vehicleModel: report.vehicle.model,
    vehiclePlate: report.vehicle.plate,
    vehicleYear: report.vehicle.year ?? undefined,
    branchName: report.branch.name,
    filledByName: report.filledBy
      ? `${report.filledBy.lastName} ${report.filledBy.firstName}`
      : undefined,
    mileageAtReport: report.mileageAtReport ?? undefined,
    notes: report.notes ?? undefined,
    signatureUrl: report.signatureUrl ?? undefined,
    sections: schema.sections,
    data,
  };

  const pdfBuffer = await renderReportPdf(pdfData);
  const dateStamp = report.createdAt.toISOString().slice(0, 10);
  const filename = `diagnostic-${report.id}-${dateStamp}.pdf`;

  return new Response(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
