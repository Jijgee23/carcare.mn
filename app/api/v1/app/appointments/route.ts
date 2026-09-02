import { jsonError, jsonOk } from "@/lib/api";
import { isSlotAvailable } from "@/lib/appointment-slots";
import {
  ensureAppointmentFeeCheckout,
  serializeAppointmentFee,
} from "@/lib/appointment-payments";
import { getApiAccountFromRequest } from "@/lib/auth/account-api-token";
import { PLAN_LIMIT_CODES } from "@/lib/plan-limits";
import { isFeatureEnabled } from "@/lib/plan-limits-server";
import { prisma } from "@/lib/prisma";

// GET /api/v1/app/appointments — миний цагууд (auth).
export async function GET(req: Request) {
  const account = await getApiAccountFromRequest(req);
  if (!account) return jsonError(401, "Нэвтрэх шаардлагатай.");

  const appointments = await prisma.appointment.findMany({
    where: { accountId: account.id },
    orderBy: { requestedAt: "desc" },
    select: {
      id: true,
      status: true,
      requestedAt: true,
      note: true,
      tenant: { select: { name: true, slug: true } },
      branch: { select: { name: true } },
      category: { select: { name: true } },
      accountVehicle: { select: { vehicle: { select: { plate: true } } } },
      feeAmount: true,
      feeCurrency: true,
      feeQpayInvoiceId: true,
      feeQrImage: true,
      feeQrText: true,
      feeUnderpaidAmount: true,
      payment: { select: { amount: true, currency: true } },
    },
  });
  // Хариуны хэлбэрийг хадгална: accountVehicle: { plate } | null,
  // payment: AppointmentFeeInfo (null бол хураамж шаардлагагүй).
  const shaped = appointments.map((a) => ({
    id: a.id,
    status: a.status,
    requestedAt: a.requestedAt,
    note: a.note,
    tenant: a.tenant,
    branch: a.branch,
    category: a.category,
    accountVehicle: a.accountVehicle
      ? { plate: a.accountVehicle.vehicle.plate }
      : null,
    payment: serializeAppointmentFee(a),
  }));
  return jsonOk({ appointments: shaped });
}

// POST /api/v1/app/appointments — цаг захиалах (auth).
// { branchId, requestedAt (ISO), accountVehicleId?, note? }
export async function POST(req: Request) {
  const account = await getApiAccountFromRequest(req);
  if (!account) return jsonError(401, "Нэвтрэх шаардлагатай.");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "JSON body шаардлагатай.");
  }
  const b = body as {
    branchId?: unknown;
    requestedAt?: unknown;
    accountVehicleId?: unknown;
    categoryId?: unknown;
    note?: unknown;
  };
  const branchId = typeof b.branchId === "string" ? b.branchId.trim() : "";
  const requestedRaw = typeof b.requestedAt === "string" ? b.requestedAt : "";
  const note = typeof b.note === "string" ? b.note.trim() : "";
  const accountVehicleId =
    typeof b.accountVehicleId === "string" && b.accountVehicleId
      ? b.accountVehicleId
      : null;
  const categoryIdRaw =
    typeof b.categoryId === "string" && b.categoryId ? b.categoryId : null;

  if (!branchId) return jsonError(400, "branchId шаардлагатай.");
  const when = new Date(requestedRaw);
  if (!requestedRaw || !Number.isFinite(when.getTime())) {
    return jsonError(400, "requestedAt буруу (ISO огноо шаардлагатай).");
  }
  if (when.getTime() < Date.now()) {
    return jsonError(400, "Өнгөрсөн цаг сонгох боломжгүй.");
  }

  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: {
      id: true,
      tenantId: true,
      tenant: { select: { acceptsOnlineBooking: true, suspended: true } },
    },
  });
  if (!branch) return jsonError(404, "Салбар олдсонгүй.");
  if (!branch.tenant.acceptsOnlineBooking || branch.tenant.suspended) {
    return jsonError(403, "Энэ байгууллага онлайн цаг захиалга хүлээн авахгүй.");
  }
  if (!(await isFeatureEnabled(branch.tenantId, PLAN_LIMIT_CODES.ONLINE_BOOKING))) {
    return jsonError(403, "Энэ байгууллага онлайн цаг захиалга хүлээн авахгүй.");
  }

  if (!(await isSlotAvailable(prisma, branch.id, when))) {
    return jsonError(409, "Энэ цаг дүүрсэн байна. Өөр цаг сонгоно уу.");
  }

  if (accountVehicleId) {
    const owned = await prisma.accountVehicle.findFirst({
      where: { id: accountVehicleId, accountId: account.id },
      select: { id: true },
    });
    if (!owned) return jsonError(400, "Машин олдсонгүй.");
  }

  // Ангилал — заавал биш; салбарт хамаарах (эсвэл салбаргүй) идэвхтэйг л авна.
  let categoryId: string | null = categoryIdRaw;
  if (categoryId) {
    const cat = await prisma.category.findFirst({
      where: {
        id: categoryId,
        tenantId: branch.tenantId,
        isActive: true,
        OR: [{ branches: { some: { id: branch.id } } }, { branches: { none: {} } }],
      },
      select: { id: true },
    });
    if (!cat) categoryId = null;
  }

  const appt = await prisma.appointment.create({
    data: {
      tenantId: branch.tenantId,
      branchId: branch.id,
      accountId: account.id,
      accountVehicleId,
      categoryId,
      requestedAt: when,
      note: note || null,
      status: "PENDING",
    },
    select: { id: true, status: true, requestedAt: true },
  });

  // Цаг захиалгын хураамж — идэвхтэй бол QPay invoice татна. Доголдвол ч
  // захиалга үүсэхийг тасалдуулахгүй (fee талбарууд FAILED-тэй үлдэж,
  // /payment/retry-ээр дараа дахин оролдоно).
  let payment = null;
  try {
    await ensureAppointmentFeeCheckout(appt.id);
    const withFee = await prisma.appointment.findUnique({
      where: { id: appt.id },
      select: {
        feeAmount: true,
        feeCurrency: true,
        feeQpayInvoiceId: true,
        feeQrImage: true,
        feeQrText: true,
        feeUnderpaidAmount: true,
        payment: { select: { amount: true, currency: true } },
      },
    });
    if (withFee) payment = serializeAppointmentFee(withFee);
  } catch (e) {
    console.warn("[payment] POST /api/v1/app/appointments:", e);
  }

  return jsonOk({ appointment: { ...appt, payment } }, { status: 201 });
}
