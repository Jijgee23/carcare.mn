"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { workingBranchScopeId } from "@/lib/auth/roles";
import { canDelete as canDeletePerm } from "@/lib/auth/roles";
import {
  type ReportEntry,
  type TemplateSchema,
  validateReportData,
} from "@/lib/diagnostics";
import { collectReportData } from "@/lib/diagnostics-server";
import { canFillDiagnostics, isOrderLocked, type OrderStatus } from "@/lib/orders";
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
 *   itemId? — захиалгын аль ServiceItem(kind=DIAGNOSTIC) мөрийг энэ тайлан
 *     гүйцээж байгааг заана (өгвөл: тухайн мөрийг тайлантай холбож, статусыг
 *     дууссан болгоно)
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
  const itemId = s(formData, "itemId");
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

  // Салбараар хязгаарлагдсан ажилтан зөвхөн өөрийн салбарт оношилгоо хийнэ.
  const scope = workingBranchScopeId(user);

  // orderId өгөгдсөн бол захиалгаас customer/vehicle/branch-г өвлөнө
  if (orderId) {
    const order = await prisma.serviceOrder.findFirst({
      where: {
        id: orderId,
        tenantId: user.tenantId,
        ...(scope ? { branchId: scope } : {}),
      },
      select: {
        id: true,
        status: true,
        customerId: true,
        vehicleId: true,
        branchId: true,
      },
    });
    if (!order) return { ok: false, message: "Засварын хуудас олдсонгүй." };

    // Засварын хуудас эхэлсний дараа л оношилгоо бөглөнө.
    const status = order.status as OrderStatus;
    if (isOrderLocked(status)) {
      return {
        ok: false,
        message: "Дууссан / цуцлагдсан засварын хуудсанд оношилгоо бөглөх боломжгүй.",
      };
    }
    if (!canFillDiagnostics(status)) {
      return {
        ok: false,
        message: "Засварын хуудас эхлээгүй байна. Эхлүүлсний дараа оношилгоо бөглөнө.",
      };
    }

    customerId = order.customerId;
    vehicleId = order.vehicleId;
    branchId = order.branchId;

    if (itemId) {
      const item = await prisma.serviceItem.findFirst({
        where: {
          id: itemId,
          orderId: order.id,
          kind: "DIAGNOSTIC",
          status: { not: "CANCELLED" },
          diagnosticReportId: null,
        },
        select: { id: true },
      });
      if (!item) {
        return {
          ok: false,
          message: "Оношилгооны мөр олдсонгүй эсвэл аль хэдийн бөглөгдсөн байна.",
        };
      }
    }
  }

  if (!customerId || !vehicleId || !branchId) {
    return {
      ok: false,
      message: "Үйлчлүүлэгч, машин, салбар заавал шаардлагатай.",
    };
  }

  if (scope && branchId !== scope) {
    return {
      ok: false,
      message: "Зөвхөн өөрийн салбарт оношилгоо бүртгэх боломжтой.",
    };
  }

  // Тенант харьяалал шалгана
  const [cust, veh, br] = await Promise.all([
    prisma.customer.findFirst({
      where: { id: customerId, tenantId: user.tenantId },
      select: { id: true },
    }),
    prisma.tenantVehicle.findUnique({
      where: {
        tenantId_vehicleId: { tenantId: user.tenantId, vehicleId },
      },
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

  // Захиалгын аль ServiceItem(kind=DIAGNOSTIC) мөрийг энэ тайлан гүйцээж
  // байгааг заасан бол тухайн мөрийг тайлантай холбож, дууссан гэж тооцно.
  if (itemId) {
    await prisma.serviceItem.update({
      where: { id: itemId },
      data: { diagnosticReportId: reportId, status: "COMPLETED" },
    });
  }

  await logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    entity: "DiagnosticReport",
    entityId: reportId,
    action: "CREATE",
    summary: `${template.name}${orderId ? ` · засварын хуудас #${orderId}` : ""}`,
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

  // Энэ тайланг гүйцээж байсан ServiceItem-ийг олж, тайлан устгагдсаны дараа
  // (FK-ийн SET NULL-аар diagnosticReportId нь автоматаар хоослогдоно) статусыг
  // нь бөглөх хүлээгдэж буй болгож буцаана.
  const linkedItem = await prisma.serviceItem.findUnique({
    where: { diagnosticReportId: report.id },
    select: { id: true },
  });

  await prisma.$transaction(async (tx) => {
    await tx.diagnosticReport.delete({ where: { id: report.id } });
    if (linkedItem) {
      await tx.serviceItem.update({
        where: { id: linkedItem.id },
        data: { status: "PENDING" },
      });
    }
  });

  await logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    entity: "DiagnosticReport",
    entityId: report.id,
    action: "DELETE",
    summary: report.orderId ? `засварын хуудас #${report.orderId}` : null,
  });

  revalidatePath("/dashboard/diagnostics/reports");
  if (report.orderId) revalidatePath(`/dashboard/orders/${report.orderId}`);
}
