"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { canDelete as canDeletePerm } from "@/lib/auth/roles";
import {
  type ReportEntry,
  type TemplateSchema,
  validateReportData,
} from "@/lib/diagnostics";
import { collectReportData } from "@/lib/diagnostics-server";
import { prisma } from "@/lib/prisma";

export type ReportActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  redirectTo?: string;
} | null;

function s(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

/**
 * formData дотор:
 *   templateId, orderId? — байх ёстой
 *   customerId, vehicleId, branchId — orderId байхгүй бол заавал
 *   mileageAtReport?, notes?
 *   data[*][value|note], photos[*][], signatures[*], signature
 */
export async function createReportAction(
  _prev: ReportActionState,
  formData: FormData,
): Promise<ReportActionState> {
  const user = await requireUser();

  const templateId = s(formData, "templateId");
  const orderId = s(formData, "orderId");
  let customerId = s(formData, "customerId");
  let vehicleId = s(formData, "vehicleId");
  let branchId = s(formData, "branchId");
  const mileageStr = s(formData, "mileageAtReport");
  const notes = s(formData, "notes");

  if (!templateId) return { ok: false, message: "Загвар сонгоогүй байна." };

  const template = await prisma.diagnosticTemplate.findFirst({
    where: { id: templateId, tenantId: user.tenantId, isActive: true },
    select: { id: true, name: true, version: true, schema: true },
  });
  if (!template) return { ok: false, message: "Загвар олдсонгүй." };

  // orderId өгөгдсөн бол захиалгаас customer/vehicle/branch-г өвлөнө
  if (orderId) {
    const order = await prisma.serviceOrder.findFirst({
      where: { id: orderId, tenantId: user.tenantId },
      select: {
        id: true,
        customerId: true,
        vehicleId: true,
        branchId: true,
      },
    });
    if (!order) return { ok: false, message: "Захиалга олдсонгүй." };
    customerId = order.customerId;
    vehicleId = order.vehicleId;
    branchId = order.branchId;
  }

  if (!customerId || !vehicleId || !branchId) {
    return {
      ok: false,
      message: "Үйлчлүүлэгч, машин, салбар заавал шаардлагатай.",
    };
  }

  // Тенант харьяалал шалгана
  const [cust, veh, br] = await Promise.all([
    prisma.customer.findFirst({
      where: { id: customerId, tenantId: user.tenantId },
      select: { id: true },
    }),
    prisma.vehicle.findFirst({
      where: { id: vehicleId, tenantId: user.tenantId },
      select: { id: true },
    }),
    prisma.branch.findFirst({
      where: { id: branchId, tenantId: user.tenantId },
      select: { id: true },
    }),
  ]);
  if (!cust || !veh || !br) {
    return { ok: false, message: "Сонгосон мэдээлэл буруу." };
  }

  const schema = template.schema as unknown as TemplateSchema;

  let collected: Awaited<ReturnType<typeof collectReportData>>;
  try {
    collected = await collectReportData(formData, schema);
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Файл хадгалахад алдаа.",
    };
  }

  let validated: Record<string, ReportEntry>;
  try {
    validated = validateReportData(schema, collected.data);
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Бөглөлт буруу.",
    };
  }

  const mileage = mileageStr ? Number(mileageStr) : null;
  const mileageVal =
    mileage !== null && !Number.isNaN(mileage) && mileage >= 0
      ? Math.floor(mileage)
      : null;

  let reportId: string;
  try {
    const created = await prisma.diagnosticReport.create({
      data: {
        templateVersion: template.version,
        data: validated,
        signatureUrl: collected.signatureUrl,
        mileageAtReport: mileageVal,
        notes: notes || null,
        tenantId: user.tenantId,
        templateId: template.id,
        orderId: orderId || null,
        customerId,
        vehicleId,
        branchId,
        filledById: user.id,
      },
      select: { id: true },
    });
    reportId = created.id;
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Хадгалахад алдаа гарлаа.",
    };
  }

  await logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    entity: "DiagnosticReport",
    entityId: reportId,
    action: "CREATE",
    summary: `${template.name}${orderId ? ` · захиалга #${orderId}` : ""}`,
    after: { templateId: template.id, orderId, customerId, vehicleId, branchId },
  });

  revalidatePath("/dashboard/diagnostics/reports");
  if (orderId) {
    revalidatePath(`/dashboard/orders/${orderId}`);
    redirect(`/dashboard/orders/${orderId}`);
  }
  redirect(`/dashboard/diagnostics/reports/${reportId}`);
}

export async function deleteReportAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = s(formData, "id");
  if (!id) return;

  const report = await prisma.diagnosticReport.findFirst({
    where: { id, tenantId: user.tenantId },
    select: { id: true, orderId: true, filledById: true },
  });
  if (!report) return;

  const allowed =
    canDeletePerm(user, "diagnostics") || report.filledById === user.id;
  if (!allowed) {
    throw new Error("Танд устгах эрх байхгүй.");
  }

  await prisma.diagnosticReport.delete({ where: { id: report.id } });

  await logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    entity: "DiagnosticReport",
    entityId: report.id,
    action: "DELETE",
    summary: report.orderId ? `захиалга #${report.orderId}` : null,
  });

  revalidatePath("/dashboard/diagnostics/reports");
  if (report.orderId) revalidatePath(`/dashboard/orders/${report.orderId}`);
}
