// S12: postpone is no longer reachable through the generic status-change
// action/API (see app/_actions/orders.ts's changeOrderStatusAction and
// app/api/v1/orders/[id]/route.ts's PATCH) — this is the ONE place that
// implements it, shared by the dashboard's postponeOrderAction (form-data,
// app/_actions/orders.ts) and the dedicated
// POST /api/v1/orders/[id]/postpone endpoint (JSON body). Both transports
// parse their own transport-shaped input (FormData vs JSON) into the raw
// strings below and hand off to postponeOrderCore for every actual
// validation and write.
import { logAudit } from "@/lib/audit";
import { parseBusinessLocalDateTime } from "@/lib/booking-time";
import {
  closeOpenOrderTimeBooking,
  getOpenOrderTimeBookings,
  openOrderTimeBooking,
  updateOpenOrderTimeBookingSchedule,
  withOrderTransaction,
} from "@/lib/order-time-booking";
import {
  findScheduleConflict,
  getBranchSlotMinutes,
  validateScheduledOrderHours,
} from "@/lib/order-schedule-validation";
import {
  ORDER_POSTPONE_REASON_TAGS,
  ORDER_STATUS_TRANSITIONS,
  type OrderPostponeReasonTag,
  type OrderStatus,
} from "@/lib/orders";
import { prisma } from "@/lib/prisma";

export type PostponeCoreInput = {
  tenantId: string;
  orderId: string;
  /** Branch scope restriction for the acting user, or null for unrestricted
   * (owner / all-branches). Each transport computes this with its own helper
   * (workingBranchScopeId for the dashboard, branchScopeId for the API) —
   * intentionally NOT unified here, since the two already differ elsewhere
   * between app/_actions/orders.ts and app/api/v1/orders/[id]/route.ts. */
  branchScope: string | null;
  reasonRaw: string;
  reasonTagRaw: string;
  returnAtRaw: string;
  confirmed: boolean;
  actorId: string;
};

export type PostponeCoreError = {
  code: "not_found" | "validation" | "conflict";
  message?: string;
  fieldErrors?: Record<string, string>;
};

export type PostponeCoreResult = { ok: true } | { ok: false; error: PostponeCoreError };

class PostponeTxError extends Error {
  constructor(
    public code: PostponeCoreError["code"],
    message: string,
  ) {
    super(message);
  }
}

export async function postponeOrderCore(input: PostponeCoreInput): Promise<PostponeCoreResult> {
  const { tenantId, orderId, branchScope, confirmed, actorId } = input;

  const reason = input.reasonRaw.trim();
  const reasonTag = (ORDER_POSTPONE_REASON_TAGS as readonly string[]).includes(input.reasonTagRaw)
    ? (input.reasonTagRaw as OrderPostponeReasonTag)
    : null;
  if (!reasonTag && !reason) {
    return { ok: false, error: { code: "validation", fieldErrors: { reason: "Шалтгаан сонгох эсвэл бичнэ үү." } } };
  }

  const returnRaw = input.returnAtRaw.trim();
  if (!returnRaw) {
    return { ok: false, error: { code: "validation", fieldErrors: { returnAt: "Буцах цагийг оруулна уу." } } };
  }
  const returnAt = parseBusinessLocalDateTime(returnRaw);
  if (!Number.isFinite(returnAt.getTime())) {
    return { ok: false, error: { code: "validation", fieldErrors: { returnAt: "Огноо буруу." } } };
  }
  // S09: general order create/update reject a past time; postpone did not.
  if (returnAt.getTime() < Date.now()) {
    return { ok: false, error: { code: "validation", fieldErrors: { returnAt: "Өнгөрсөн цаг сонгох боломжгүй." } } };
  }

  const order = await prisma.serviceOrder.findFirst({
    where: { id: orderId, tenantId },
    select: { id: true, branchId: true, status: true, estimatedDurationMinutes: true },
  });
  if (!order) {
    return { ok: false, error: { code: "not_found", message: "Засварын хуудас олдсонгүй." } };
  }
  if (branchScope && order.branchId !== branchScope) {
    return {
      ok: false,
      error: { code: "validation", message: "Зөвхөн өөрийн салбарын засварын хуудсыг удирдана." },
    };
  }

  const allowed = ORDER_STATUS_TRANSITIONS[order.status as OrderStatus];
  if (!allowed?.includes("POSTPONED")) {
    return { ok: false, error: { code: "validation", message: "Энэ захиалгыг хойшлуулах боломжгүй." } };
  }

  const durationMinutes =
    order.estimatedDurationMinutes ?? (await getBranchSlotMinutes(tenantId, order.branchId));
  // S09: apply the same effective-hours validator general create/update
  // already use (validateScheduledOrderHours) — postpone previously only
  // checked overlaps, letting a return time land outside opening hours.
  // D-087 superseded: a return time is staff's own estimate, not a customer
  // commitment, so an hours violation is now a confirmable warning (matching
  // rescheduleOrderAction/moveLinkedAppointmentOrder), not a hard block.
  const hoursError = await validateScheduledOrderHours(tenantId, order.branchId, returnAt, durationMinutes);
  if (hoursError && !confirmed) {
    return {
      ok: false,
      error: {
        code: "conflict",
        message: `${hoursError} Үргэлжлүүлэхийн тулд дахин "Хойшлуулах" дарна уу.`,
        fieldErrors: { confirmNeeded: "true" },
      },
    };
  }
  const conflictEnd = new Date(returnAt.getTime() + durationMinutes * 60000);
  if (!confirmed) {
    const conflict = await findScheduleConflict(tenantId, order.branchId, order.id, returnAt, conflictEnd);
    if (conflict) {
      return {
        ok: false,
        error: {
          code: "conflict",
          message:
            conflict.certainty === "possible"
              ? `Товлосон цаг ${conflict.label}-тай давхцах магадлалтай. Үргэлжлүүлэхийн тулд дахин "Хойшлуулах" дарна уу.`
              : `Товлосон цаг ${conflict.label}-тай давхцаж байна. Үргэлжлүүлэхийн тулд дахин "Хойшлуулах" дарна уу.`,
          fieldErrors: { confirmNeeded: "true" },
        },
      };
    }
  }

  const now = new Date();
  // S06 fix (the worst race of this batch — see WEB_SCHEDULING_ASSESSMENT):
  // re-validate the transition against a FRESH, locked read, and — critically
  // — do the "is there already an open SCHEDULED booking?" check and the
  // resulting update-in-place-or-insert branch under that SAME lock, so two
  // concurrent postpone calls can't both see "no open row" and both insert.
  try {
    await withOrderTransaction(
      tenantId,
      orderId,
      { id: true, branchId: true, status: true },
      async (tx, freshRaw) => {
        const fresh = freshRaw as { id: string; branchId: string; status: OrderStatus } | null;
        if (!fresh) throw new PostponeTxError("not_found", "Засварын хуудас олдсонгүй.");
        if (branchScope && fresh.branchId !== branchScope) {
          throw new PostponeTxError("validation", "Зөвхөн өөрийн салбарын засварын хуудсыг удирдана.");
        }
        const freshAllowed = ORDER_STATUS_TRANSITIONS[fresh.status as OrderStatus];
        if (!freshAllowed?.includes("POSTPONED")) {
          throw new PostponeTxError("validation", "Энэ захиалгыг хойшлуулах боломжгүй.");
        }
        const previousStatus = fresh.status as OrderStatus;

        await tx.serviceOrder.update({
          where: { id: fresh.id },
          data: { status: "POSTPONED", occupiesCapacity: false },
        });
        // D-076 dual-write: close only the ACTIVE booking — an independent open
        // follow-up (if this order already had one) must survive.
        await closeOpenOrderTimeBooking(tx, fresh.id, now, "ACTIVE");
        const open = await getOpenOrderTimeBookings(tx, fresh.id);
        const openScheduled = open.find((b) => b.kind === "SCHEDULED");
        if (openScheduled) {
          await updateOpenOrderTimeBookingSchedule(tx, fresh.id, {
            startAt: returnAt,
            endAt: conflictEnd,
          });
        } else {
          await openOrderTimeBooking(tx, {
            tenantId,
            orderId: fresh.id,
            branchId: fresh.branchId,
            kind: "SCHEDULED",
            startAt: returnAt,
            endAt: conflictEnd,
            createdById: actorId,
          });
        }
        await tx.orderStatusChange.create({
          data: {
            tenantId,
            orderId: fresh.id,
            fromStatus: previousStatus,
            toStatus: "POSTPONED",
            reason: reason || null,
            reasonTag,
            changedById: actorId,
          },
        });
        await logAudit(
          {
            tenantId,
            userId: actorId,
            entity: "ServiceOrder",
            entityId: fresh.id,
            action: "STATUS_CHANGE",
            summary: `${previousStatus} → POSTPONED`,
            before: { status: previousStatus },
            after: { status: "POSTPONED", reasonTag, reason: reason || null },
          },
          tx,
        );
      },
    );
  } catch (e) {
    if (e instanceof PostponeTxError) {
      return { ok: false, error: { code: e.code, message: e.message } };
    }
    throw e;
  }

  return { ok: true };
}
