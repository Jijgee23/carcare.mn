import { Prisma } from "@/app/generated/prisma/client";
import { jsonError, jsonOk, requireApiUser } from "@/lib/api";
import {
  type ReportEntry,
  type TemplateSchema,
  validateReportData,
} from "@/lib/diagnostics";
import { collectReportData } from "@/lib/diagnostics-server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;

  const url = new URL(req.url);
  const vehicleId = url.searchParams.get("vehicleId")?.trim();
  const customerId = url.searchParams.get("customerId")?.trim();
  const orderId = url.searchParams.get("orderId")?.trim();
  const filledByMe = url.searchParams.get("filledByMe") === "true";
  const limit = Math.min(
    Math.max(Number(url.searchParams.get("limit") ?? "50"), 1),
    200,
  );

  const where: Prisma.DiagnosticReportWhereInput = {
    tenantId: auth.user.tenantId,
  };
  if (vehicleId) where.vehicleId = vehicleId;
  if (customerId) where.customerId = customerId;
  if (orderId) where.orderId = orderId;
  if (filledByMe) where.filledById = auth.user.id;

  const reports = await prisma.diagnosticReport.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      createdAt: true,
      templateVersion: true,
      mileageAtReport: true,
      orderId: true,
      template: { select: { id: true, name: true, type: true } },
      customer: { select: { id: true, fullName: true, phone: true } },
      vehicle: {
        select: { id: true, plate: true, make: true, model: true },
      },
      branch: { select: { id: true, name: true } },
      filledBy: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
  });

  return jsonOk({ reports });
}

export async function POST(req: Request) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;

  // Multipart form-data — зураг хавсаргахын тулд
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return jsonError(
      400,
      "Multipart form-data илгээнэ үү (зураг хавсаргах боломжтой).",
    );
  }

  const templateId = str(formData, "templateId");
  const customerId = str(formData, "customerId");
  const vehicleId = str(formData, "vehicleId");
  const branchId = str(formData, "branchId");
  const orderId = str(formData, "orderId");
  const mileageStr = str(formData, "mileageAtReport");
  const notes = str(formData, "notes");

  if (!templateId) return jsonError(422, "templateId шаардлагатай.");

  const template = await prisma.diagnosticTemplate.findFirst({
    where: { id: templateId, tenantId: auth.user.tenantId, isActive: true },
    select: { id: true, version: true, schema: true },
  });
  if (!template) return jsonError(404, "Загвар олдсонгүй.");

  let finalCustomerId = customerId;
  let finalVehicleId = vehicleId;
  let finalBranchId = branchId;

  if (orderId) {
    const order = await prisma.serviceOrder.findFirst({
      where: { id: orderId, tenantId: auth.user.tenantId },
      select: {
        customerId: true,
        vehicleId: true,
        branchId: true,
      },
    });
    if (!order) return jsonError(404, "Захиалга олдсонгүй.");
    finalCustomerId = order.customerId;
    finalVehicleId = order.vehicleId;
    finalBranchId = order.branchId;
  }

  if (!finalCustomerId || !finalVehicleId || !finalBranchId) {
    return jsonError(
      422,
      "customerId, vehicleId, branchId шаардлагатай (эсвэл orderId илгээнэ үү).",
    );
  }

  const [cust, veh, br] = await Promise.all([
    prisma.customer.findFirst({
      where: { id: finalCustomerId, tenantId: auth.user.tenantId },
      select: { id: true },
    }),
    prisma.vehicle.findFirst({
      where: { id: finalVehicleId, tenantId: auth.user.tenantId },
      select: { id: true },
    }),
    prisma.branch.findFirst({
      where: { id: finalBranchId, tenantId: auth.user.tenantId },
      select: { id: true },
    }),
  ]);
  if (!cust || !veh || !br) return jsonError(422, "Сонгосон ID-нууд буруу.");

  const schema = template.schema as unknown as TemplateSchema;

  let collected: Awaited<ReturnType<typeof collectReportData>>;
  try {
    collected = await collectReportData(formData, schema);
  } catch (e) {
    return jsonError(
      400,
      e instanceof Error ? e.message : "Файл хадгалахад алдаа.",
    );
  }

  let validated: Record<string, ReportEntry>;
  try {
    validated = validateReportData(schema, collected.data);
  } catch (e) {
    return jsonError(422, e instanceof Error ? e.message : "Бөглөлт буруу.");
  }

  const mileage = mileageStr ? Number(mileageStr) : null;
  const mileageVal =
    mileage !== null && !Number.isNaN(mileage) && mileage >= 0
      ? Math.floor(mileage)
      : null;

  const report = await prisma.diagnosticReport.create({
    data: {
      templateVersion: template.version,
      data: validated,
      signatureUrl: collected.signatureUrl,
      mileageAtReport: mileageVal,
      notes: notes || null,
      tenantId: auth.user.tenantId,
      templateId: template.id,
      orderId: orderId || null,
      customerId: finalCustomerId,
      vehicleId: finalVehicleId,
      branchId: finalBranchId,
      filledById: auth.user.id,
    },
    select: {
      id: true,
      createdAt: true,
      templateVersion: true,
      orderId: true,
      customerId: true,
      vehicleId: true,
      branchId: true,
    },
  });

  return jsonOk({ report }, { status: 201 });
}

function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}
