import { Prisma } from "@/app/generated/prisma/client";
import { jsonError, jsonOk, requireApiUser, requirePermission } from "@/lib/api";
import { branchScopeId } from "@/lib/auth/roles";
import { canAssignOrders, canEditOrder, orderReadWhere } from "@/lib/auth/order-access";
import { logAudit } from "@/lib/audit";
import { requireActiveSubscriptionApi } from "@/lib/subscription-server";
import { prisma } from "@/lib/prisma";
import {
  ORDER_STATUS_TRANSITIONS,
  isOrderLocked,
  type OrderStatus,
} from "@/lib/orders";
import {
  MIN_CATEGORY_DURATION_MINUTES,
  MAX_CATEGORY_DURATION_MINUTES,
} from "@/lib/category-duration";
import { calculateServiceItemDurationMinutes, type ServiceDurationItem } from "@/lib/service-duration";
import { closeOpenOrderTimeBooking, openOrderTimeBooking, withOrderTransaction } from "@/lib/order-time-booking";

const ORDER_DETAIL_SELECT = {
  id: true,
  number: true,
  status: true,
  paymentStatus: true,
  scheduledAt: true,
  startedAt: true,
  completedAt: true,
  paidAt: true,
  totalAmount: true,
  paidAmount: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  customer: { select: { id: true, fullName: true, phone: true, email: true } },
  vehicle: {
    select: {
      id: true,
      plate: true,
      make: true,
      model: true,
      year: true,
      vin: true,
      mileage: true,
    },
  },
  branch: { select: { id: true, name: true } },
  assignedTo: { select: { id: true, firstName: true, lastName: true } },
  items: {
    orderBy: { createdAt: "asc" as const },
    select: {
      id: true,
      kind: true,
      description: true,
      quantity: true,
      unitPrice: true,
      total: true,
      serviceId: true,
      status: true,
      cancelledAt: true,
      cancelledById: true,
    },
  },
  reports: {
    orderBy: { createdAt: "desc" as const },
    select: {
      id: true,
      createdAt: true,
      template: { select: { id: true, name: true, type: true } },
    },
  },
} satisfies Prisma.ServiceOrderSelect;

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;
  const { id } = await ctx.params;
  const scope = branchScopeId(auth.user);

  const order = await prisma.serviceOrder.findFirst({
    where: {
      id,
      tenantId: auth.user.tenantId,
      ...(scope ? { branchId: scope } : {}),
      ...orderReadWhere(auth.user),
    },
    select: ORDER_DETAIL_SELECT,
  });

  if (!order) return jsonError(404, "Засварын хуудас олдсонгүй.");
  return jsonOk({ order });
}

// S06 fix: validation that runs INSIDE the withOrderTransaction lock (i.e.
// against the freshly re-read row) throws this to carry an HTTP status back
// out through the transaction boundary, instead of returning early.
class OrderPatchError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;
  const denied = requirePermission(auth.user, "orders.edit");
  if (denied && !auth.user.role?.permissions.includes("orders.editOwn")) return denied;
  const locked = await requireActiveSubscriptionApi(auth.user);
  if (locked) return locked;
  const { id } = await ctx.params;
  const scope = branchScopeId(auth.user);

  // Pre-lock existence/scope check only — status/lock state is re-validated
  // fresh, under the row lock, below (S06: this used to validate here and
  // write in a separate lock-free transaction, letting a concurrent status
  // change or the expiry cron race this request).
  const preCheck = await prisma.serviceOrder.findFirst({
    where: {
      id,
      tenantId: auth.user.tenantId,
      ...(scope ? { branchId: scope } : {}),
    },
      select: { id: true, assignedToId: true },
  });
  if (!preCheck) return jsonError(404, "Засварын хуудас олдсонгүй.");
  if (!canEditOrder(auth.user, preCheck)) return jsonError(403, "Танд энэ засварын хуудсыг засах эрх байхгүй.");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "JSON body шаардлагатай.");
  }
  const b = body as Record<string, unknown>;

  let statusChangedTo: OrderStatus | null = null;
  let fromStatus: OrderStatus | null = null;
  let updated: Prisma.ServiceOrderGetPayload<{ select: typeof ORDER_DETAIL_SELECT }>;
  try {
    updated = await withOrderTransaction(
      auth.user.tenantId,
      id,
      {
        id: true,
        status: true,
        branchId: true,
        assignedToId: true,
        startedAt: true,
        estimatedDurationMinutes: true,
        items: {
          where: { status: { not: "CANCELLED" } },
          select: {
            kind: true,
            status: true,
            quantity: true,
            service: {
              select: {
                durationValue: true,
                durationUnit: { select: { name: true, code: true } },
              },
            },
            diagnosticTemplate: { select: { durationMin: true } },
          },
        },
      },
      async (tx, orderRaw) => {
        const order = orderRaw as {
          id: string;
          status: OrderStatus;
          branchId: string;
          assignedToId: string | null;
          startedAt: Date | null;
          estimatedDurationMinutes: number | null;
          items: ServiceDurationItem[];
        } | null;
        if (!order || (scope && order.branchId !== scope) || !canEditOrder(auth.user, order)) {
          throw new OrderPatchError(404, "Засварын хуудас олдсонгүй.");
        }
        if (isOrderLocked(order.status as OrderStatus)) {
          throw new OrderPatchError(
            422,
            "Дууссан / цуцлагдсан засварын хуудасны мэдээллийг засах боломжгүй.",
          );
        }

        const updates: Prisma.ServiceOrderUpdateInput = {};
        let bookingSyncNow: Date | null = null;
        let bookingSyncEnteringInProgress = false;

        if (typeof b.status === "string") {
          const newStatus = b.status as OrderStatus;
          // S12: POSTPONED needs a mandatory reason/return-time and a
          // structured OrderStatusChange row — this generic PATCH used to
          // also accept it with none of that validation
          // (WEB_SCHEDULING_ASSESSMENT S11-S12). Use the dedicated
          // POST /api/v1/orders/[id]/postpone endpoint instead.
          if (newStatus === "POSTPONED") {
            throw new OrderPatchError(
              422,
              'Хойшлуулахын тулд POST /api/v1/orders/[id]/postpone ашиглана уу.',
            );
          }
          const allowed = ORDER_STATUS_TRANSITIONS[order.status as OrderStatus];
          if (!allowed.includes(newStatus)) {
            throw new OrderPatchError(
              422,
              `"${order.status}" статусаас "${newStatus}" руу шилжих боломжгүй.`,
            );
          }
          updates.status = newStatus;
          statusChangedTo = newStatus;
          fromStatus = order.status as OrderStatus;

          const now = new Date();
          bookingSyncNow = now;
          const enteringInProgress = newStatus === "IN_PROGRESS";
          bookingSyncEnteringInProgress = enteringInProgress;
          const startingFresh = enteringInProgress && !order.startedAt;
          const resuming = enteringInProgress && order.status === "POSTPONED";

          // Ажил эхлэхэд (эсвэл сэлбэгээс сэргэхэд) үргэлжлэх хугацааны тооцоолол
          // байх ёстой — app/_actions/orders.ts-ийн changeOrderStatusAction-той
          // ижил зарчим (D-хугацааны шийдвэр): үгүй бол захиалга хугацаагүй, cap
          // бага салбарт бүх цаг захиалгыг хаадаг. Аль хэдийн байвал дахин
          // асуухгүй.
          let effectiveDurationMinutes = order.estimatedDurationMinutes;
          const serviceItemDurationMinutes = enteringInProgress
            ? calculateServiceItemDurationMinutes(order.items)
            : null;
          if (effectiveDurationMinutes == null && serviceItemDurationMinutes != null) {
            effectiveDurationMinutes = serviceItemDurationMinutes;
          }
          if (enteringInProgress && effectiveDurationMinutes == null) {
            const durationMinutes = b.durationMinutes;
            if (
              typeof durationMinutes !== "number" ||
              !Number.isInteger(durationMinutes) ||
              durationMinutes < MIN_CATEGORY_DURATION_MINUTES ||
              durationMinutes > MAX_CATEGORY_DURATION_MINUTES
            ) {
              throw new OrderPatchError(
                422,
                `Ажлыг эхлүүлэхийн өмнө "durationMinutes" (бүхэл тоо, ${MIN_CATEGORY_DURATION_MINUTES}–${MAX_CATEGORY_DURATION_MINUTES}) шаардлагатай.`,
              );
            }
            effectiveDurationMinutes = durationMinutes;
          }

          const startedAt = startingFresh ? now : order.startedAt;
          if (startingFresh) {
            updates.startedAt = startedAt;
          }
          if (startingFresh && effectiveDurationMinutes !== order.estimatedDurationMinutes) {
            updates.estimatedDurationMinutes = effectiveDurationMinutes;
          }
          if (newStatus === "COMPLETED") {
            updates.completedAt = new Date();
          }
          // Хүчин чадлын эзэмшил — app/_actions/orders.ts-ийн
          // changeOrderStatusAction-той ижил зарчим: идэвхтэй ажил хүчин чадал
          // эзэлнэ, дууссан/цуцлагдсан/хойшлогдсон бол шууд суллана. POSTPONED
          // одоо үргэлж суллагдсан гэж тооцогдоно (D-076, COWORK.md) — дуудагчаас
          // `occupiesCapacity` авахгүй.
          if (newStatus === "COMPLETED" || newStatus === "CANCELLED") {
            updates.occupiesCapacity = false;
          } else {
            updates.occupiesCapacity = true;
          }
          if (enteringInProgress && effectiveDurationMinutes != null) {
            // Сэргэхэд одоогоос тоолж дуусах хугацааг дахин тооцоолно — хуучин
            // (хүлээлтийн өмнөх) утга хуучирсан хэвээр үлдэхгүй.
            const anchor = resuming ? now : startedAt;
            if (anchor) {
              updates.expectedFinishAt = new Date(
                anchor.getTime() + effectiveDurationMinutes * 60000,
              );
            }
          }
        }

        if (typeof b.notes === "string") {
          updates.notes = b.notes.trim() || null;
        }

        if (typeof b.assignedToId === "string") {
          if (!canAssignOrders(auth.user)) {
            const requested = b.assignedToId.trim() || null;
            if (requested !== auth.user.id) {
              throw new OrderPatchError(403, "Зөвхөн orders.assign эрхтэй хэрэглэгч хариуцагч өөрчилж болно.");
            }
          }
          updates.assignedTo = b.assignedToId.trim()
            ? { connect: { id: b.assignedToId.trim() } }
            : { disconnect: true };
        }

        const u = await tx.serviceOrder.update({
          where: { id: order.id },
          data: updates,
          select: ORDER_DETAIL_SELECT,
        });
        // Захиалгыг бүхэлд нь цуцлахад дотор нь бөглөгдсөн (COMPLETED) байсан
        // мөр — тэр дундаа бөглөгдсөн оношилгооны хуудас — идэвхтэй хэвээр
        // үлдэж, дуусаагүй мэт харагдахаас сэргийлж бүх мөрийг мөн цуцална.
        if (statusChangedTo === "CANCELLED") {
          await tx.serviceItem.updateMany({
            where: { orderId: order.id, status: { not: "CANCELLED" } },
            data: {
              status: "CANCELLED",
              cancelledAt: new Date(),
              cancelledById: auth.user.id,
            },
          });
        }
        // S04: keep OrderTimeBooking in sync with the scalar status transition —
        // same dual-write rules as changeOrderStatusAction (app/_actions/orders.ts),
        // on this SAME transaction client, so API-driven transitions don't leave
        // the booking-row source of truth stale.
        if (statusChangedTo && bookingSyncNow) {
          if (bookingSyncEnteringInProgress) {
            await closeOpenOrderTimeBooking(tx, order.id, bookingSyncNow, "all");
            await openOrderTimeBooking(tx, {
              tenantId: auth.user.tenantId,
              orderId: order.id,
              branchId: order.branchId,
              kind: "ACTIVE",
              startAt: bookingSyncNow,
              endAt: (updates.expectedFinishAt as Date | undefined) ?? null,
              createdById: auth.user.id,
            });
          } else if (statusChangedTo === "COMPLETED") {
            await closeOpenOrderTimeBooking(tx, order.id, updates.completedAt as Date, "ACTIVE");
          } else if (statusChangedTo === "CANCELLED") {
            await closeOpenOrderTimeBooking(tx, order.id, bookingSyncNow, "all");
          }
        }
        // S12: write a structured OrderStatusChange row in the same
        // transaction as the scalar status write, for every transition made
        // through this API — matching changeOrderStatusAction
        // (app/_actions/orders.ts). No reason/reasonTag on this path.
        if (statusChangedTo) {
          await tx.orderStatusChange.create({
            data: {
              tenantId: auth.user.tenantId,
              orderId: order.id,
              fromStatus: order.status,
              toStatus: statusChangedTo,
              changedById: auth.user.id,
            },
          });
        }
        return u;
      },
    );
  } catch (e) {
    if (e instanceof OrderPatchError) return jsonError(e.status, e.message);
    return jsonError(500, e instanceof Error ? e.message : "Шинэчлэх явцад алдаа гарлаа.");
  }

  if (statusChangedTo) {
    await logAudit({
      tenantId: auth.user.tenantId,
      userId: auth.user.id,
      entity: "ServiceOrder",
      entityId: id,
      action: "STATUS_CHANGE",
      summary: `${fromStatus} → ${statusChangedTo}`,
      before: { status: fromStatus },
      after: { status: statusChangedTo },
    });
  } else {
    await logAudit({
      tenantId: auth.user.tenantId,
      userId: auth.user.id,
      entity: "ServiceOrder",
      entityId: id,
      action: "UPDATE",
      summary: "Засварын хуудасны мэдээлэл шинэчлэв",
    });
  }

  return jsonOk({ order: updated });
}
