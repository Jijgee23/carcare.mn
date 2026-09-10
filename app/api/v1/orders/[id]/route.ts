import { Prisma } from "@/app/generated/prisma/client";
import { jsonError, jsonOk, requireApiUser, requirePermission } from "@/lib/api";
import { branchScopeId } from "@/lib/auth/roles";
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
import { calculateServiceItemDurationMinutes } from "@/lib/service-duration";

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
    },
    select: ORDER_DETAIL_SELECT,
  });

  if (!order) return jsonError(404, "Засварын хуудас олдсонгүй.");
  return jsonOk({ order });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;
  const denied = requirePermission(auth.user, "orders.edit");
  if (denied) return denied;
  const locked = await requireActiveSubscriptionApi(auth.user);
  if (locked) return locked;
  const { id } = await ctx.params;
  const scope = branchScopeId(auth.user);

  const order = await prisma.serviceOrder.findFirst({
    where: {
      id,
      tenantId: auth.user.tenantId,
      ...(scope ? { branchId: scope } : {}),
    },
    select: {
      id: true,
      status: true,
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
  });
  if (!order) return jsonError(404, "Засварын хуудас олдсонгүй.");
  if (isOrderLocked(order.status as OrderStatus)) {
    return jsonError(
      422,
      "Дууссан / цуцлагдсан засварын хуудасны мэдээллийг засах боломжгүй.",
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "JSON body шаардлагатай.");
  }

  const b = body as Record<string, unknown>;
  const updates: Prisma.ServiceOrderUpdateInput = {};
  let statusChangedTo: OrderStatus | null = null;

  if (typeof b.status === "string") {
    const newStatus = b.status as OrderStatus;
    const allowed = ORDER_STATUS_TRANSITIONS[order.status as OrderStatus];
    if (!allowed.includes(newStatus)) {
      return jsonError(
        422,
        `"${order.status}" статусаас "${newStatus}" руу шилжих боломжгүй.`,
      );
    }
    updates.status = newStatus;
    statusChangedTo = newStatus;

    const now = new Date();
    const enteringInProgress = newStatus === "IN_PROGRESS";
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
        return jsonError(
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
    if (newStatus === "COMPLETED" || newStatus === "CANCELLED" || newStatus === "POSTPONED") {
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
    updates.assignedTo = b.assignedToId.trim()
      ? { connect: { id: b.assignedToId.trim() } }
      : { disconnect: true };
  }

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.serviceOrder.update({
      where: { id },
      data: updates,
      select: ORDER_DETAIL_SELECT,
    });
    // Захиалгыг бүхэлд нь цуцлахад дотор нь бөглөгдсөн (COMPLETED) байсан
    // мөр — тэр дундаа бөглөгдсөн оношилгооны хуудас — идэвхтэй хэвээр
    // үлдэж, дуусаагүй мэт харагдахаас сэргийлж бүх мөрийг мөн цуцална.
    if (statusChangedTo === "CANCELLED") {
      await tx.serviceItem.updateMany({
        where: { orderId: id, status: { not: "CANCELLED" } },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancelledById: auth.user.id,
        },
      });
    }
    return u;
  });

  if (statusChangedTo) {
    await logAudit({
      tenantId: auth.user.tenantId,
      userId: auth.user.id,
      entity: "ServiceOrder",
      entityId: id,
      action: "STATUS_CHANGE",
      summary: `${order.status} → ${statusChangedTo}`,
      before: { status: order.status },
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
