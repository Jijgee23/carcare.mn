import { jsonError, jsonOk } from "@/lib/api";
import {
  ensureAppointmentFeeCheckout,
  serializeAppointmentFee,
} from "@/lib/appointment-payments";
import { getApiAccountFromRequest } from "@/lib/auth/account-api-token";
import { reserveAppointment, ReservationError } from "@/lib/appointment-reservations";
import { PLAN_LIMIT_CODES } from "@/lib/plan-limits";
import { isFeatureEnabled } from "@/lib/plan-limits-server";
import { prisma } from "@/lib/prisma";

// GET /api/v1/app/appointments — миний цагууд (auth).
export async function GET(req: Request) {
  const account = await getApiAccountFromRequest(req);
  if (!account) return jsonError(401, "Нэвтрэх шаардлагатай.");

  // Finished-and-settled appointments (order fully completed AND fully paid)
  // belong in service history, not here — see /api/v1/app/orders. An
  // appointment whose order is completed but not yet fully paid stays here
  // so the customer still sees it needs payment.
  const appointments = await prisma.appointment.findMany({
    where: {
      accountId: account.id,
      NOT: { serviceOrder: { status: "COMPLETED", paymentStatus: "PAID" } },
    },
    orderBy: { requestedAt: "desc" },
    select: {
      id: true,
      status: true,
      requestedAt: true,
      note: true,
      tenant: { select: { name: true, slug: true } },
      branch: { select: { id: true, name: true } },
      category: { select: { name: true } },
      categories: { select: { category: { select: { id: true, name: true } } } },
      accountVehicle: { select: { vehicle: { select: { plate: true } } } },
      // A confirmed appointment may already have a ServiceOrder. Keep the
      // customer's appointment detail useful without exposing staff-only
      // fields; progress is read-only and scoped by the appointment account.
      serviceOrder: {
        select: {
          id: true,
          number: true,
          status: true,
          paymentStatus: true,
          scheduledAt: true,
          startedAt: true,
          completedAt: true,
          estimatedDurationMinutes: true,
          expectedFinishAt: true,
          totalAmount: true,
          paidAmount: true,
          vehicle: { select: { plate: true, make: true, model: true, year: true } },
          items: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              kind: true,
              description: true,
              status: true,
              quantity: true,
              unitPrice: true,
              total: true,
            },
          },
        },
      },
      feeAmount: true,
      feeCurrency: true,
      feeQpayInvoiceId: true,
      feeQrImage: true,
      feeQrText: true,
      feeQpayUrls: true,
      feeUnderpaidAmount: true,
      payment: { select: { amount: true, currency: true } },
    },
  });
  // Цаг захиалгагүй (walk-in) захиалга — ажилтан утсаар/шууд ирсэн машинд
  // цаг захиалгагүйгээр шууд засварын хуудас үүсгэсэн бол Appointment мөр
  // огт үүсдэггүй тул дээрх query-д огт тусахгүй. Ийм захиалгыг олж, тусад
  // нь буцаана — эс бөгөөс харилцагч идэвхтэй ажлаа "Миний захиалгууд"-д огт
  // харахгүй, зөвхөн дууссаны дараа /api/v1/app/orders (түүх)-д гарна (2026-09-08
  // хэрэглэгчийн тайлан: ажилтны үүсгэсэн захиалга харагдахгүй байсан).
  const walkInOrders = await prisma.serviceOrder.findMany({
    where: {
      customer: { accountId: account.id },
      appointment: null,
      NOT: { status: "COMPLETED", paymentStatus: "PAID" },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      number: true,
      status: true,
      paymentStatus: true,
      scheduledAt: true,
      startedAt: true,
      completedAt: true,
      estimatedDurationMinutes: true,
      expectedFinishAt: true,
      totalAmount: true,
      paidAmount: true,
      tenant: { select: { name: true, slug: true } },
      branch: { select: { id: true, name: true } },
      vehicle: { select: { plate: true, make: true, model: true, year: true } },
      items: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          kind: true,
          description: true,
          status: true,
          quantity: true,
          unitPrice: true,
          total: true,
        },
      },
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
    // Олон-ангилалт захиалга (booking v2). `category` (ганц) back-compat-д үлдэв.
    categories: a.categories.map((c) => c.category),
    accountVehicle: a.accountVehicle
      ? { plate: a.accountVehicle.vehicle.plate }
      : null,
    serviceOrder: a.serviceOrder
      ? {
          id: a.serviceOrder.id,
          number: a.serviceOrder.number,
          status: a.serviceOrder.status,
          paymentStatus: a.serviceOrder.paymentStatus,
          scheduledAt: a.serviceOrder.scheduledAt,
          startedAt: a.serviceOrder.startedAt,
          completedAt: a.serviceOrder.completedAt,
          estimatedDurationMinutes: a.serviceOrder.estimatedDurationMinutes,
          expectedFinishAt: a.serviceOrder.expectedFinishAt,
          totalAmount:
            a.serviceOrder.totalAmount != null
              ? Number.parseFloat(a.serviceOrder.totalAmount.toString())
              : null,
          paidAmount:
            a.serviceOrder.paidAmount != null
              ? Number.parseFloat(a.serviceOrder.paidAmount.toString())
              : null,
          vehicle: a.serviceOrder.vehicle,
          items: a.serviceOrder.items.map((it) => ({
            id: it.id,
            kind: it.kind,
            description: it.description,
            status: it.status,
            quantity: Number.parseFloat(it.quantity.toString()),
            unitPrice: Number.parseFloat(it.unitPrice.toString()),
            total: Number.parseFloat(it.total.toString()),
          })),
        }
      : null,
    payment: serializeAppointmentFee(a),
  }));

  const shapedWalkIns = walkInOrders.map((o) => ({
    id: o.id,
    number: o.number,
    status: o.status,
    paymentStatus: o.paymentStatus,
    scheduledAt: o.scheduledAt,
    startedAt: o.startedAt,
    completedAt: o.completedAt,
    estimatedDurationMinutes: o.estimatedDurationMinutes,
    expectedFinishAt: o.expectedFinishAt,
    totalAmount:
      o.totalAmount != null ? Number.parseFloat(o.totalAmount.toString()) : null,
    paidAmount:
      o.paidAmount != null ? Number.parseFloat(o.paidAmount.toString()) : null,
    tenant: o.tenant,
    branch: o.branch,
    vehicle: o.vehicle,
    items: o.items.map((it) => ({
      id: it.id,
      kind: it.kind,
      description: it.description,
      status: it.status,
      quantity: Number.parseFloat(it.quantity.toString()),
      unitPrice: Number.parseFloat(it.unitPrice.toString()),
      total: Number.parseFloat(it.total.toString()),
    })),
  }));

  return jsonOk({ appointments: shaped, walkInOrders: shapedWalkIns });
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
    categoryIds?: unknown;
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
  // Олон ангилал (booking v2). Ганц `categoryId`-тэй нэгтгэж, давхардлыг арилгана.
  const categoryIdsRaw = Array.isArray(b.categoryIds)
    ? b.categoryIds.filter((x): x is string => typeof x === "string" && !!x)
    : [];
  const requestedCategoryIds = [
    ...new Set([...(categoryIdRaw ? [categoryIdRaw] : []), ...categoryIdsRaw]),
  ];

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

  if (accountVehicleId) {
    const owned = await prisma.accountVehicle.findFirst({
      where: { id: accountVehicleId, accountId: account.id },
      select: { id: true },
    });
    if (!owned) return jsonError(400, "Машин олдсонгүй.");
  }

  let appt;
  try {
    appt = await reserveAppointment({
      tenantId: branch.tenantId, branchId: branch.id, accountId: account.id,
      accountVehicleId, categoryIds: requestedCategoryIds, requestedAt: when, note: note || null,
    });
  } catch (error) {
    if (error instanceof ReservationError) return jsonError(error.status, error.message);
    throw error;
  }

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
        feeQpayUrls: true,
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
