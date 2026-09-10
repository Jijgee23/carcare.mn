/**
 * D-068 (COWORK.md) — dual-write phase. `OrderTimeBooking` rows are written
 * alongside the existing ServiceOrder scalar fields (scheduledAt/startedAt/
 * expectedFinishAt/occupiesCapacity), which remain the only thing any read
 * path actually consults for now. These helpers are the single place that
 * decides how a status/capacity change maps to booking rows, so the order
 * actions in app/_actions/orders.ts never hand-roll this logic individually.
 *
 * Invariant (D-076): an order may have at most one OPEN (closedAt: null)
 * ACTIVE booking (what it occupies right now) AND, independently, at most one
 * open SCHEDULED booking (a follow-up reserved for later — a POSTPONED
 * return time, or a next-visit booked while still IN_PROGRESS) — never two of
 * the same kind at once, but one of each MAY coexist. Every helper below that
 * touches "the open booking" therefore takes an explicit `kind` argument
 * (or, for closeOpenOrderTimeBooking, an explicit "all") — there is no safe
 * kind-agnostic default once two rows can be open simultaneously.
 */
import type { OrderBookingKind } from "@/app/generated/prisma/client";
import { prisma, type PrismaTransactionClient } from "@/lib/prisma";

/**
 * Closes whatever's open for this order, scoped by `kind`:
 * - A specific kind ("ACTIVE" or "SCHEDULED") closes only that row, leaving
 *   any other open row (e.g. an unrelated follow-up) untouched. Use this for
 *   anything that ends ONE phase without implying the order's other booking
 *   is also resolved — completing/cancelling an order (closes ACTIVE, a
 *   pending follow-up survives — see D-076), or releasing a POSTPONED bay
 *   (closes ACTIVE only).
 * - "all" closes every open row regardless of kind. Use this only where
 *   starting/resuming active work genuinely supersedes whatever was next in
 *   line for this order — entering IN_PROGRESS consumes both a prior
 *   SCHEDULED booking (the job that's now actually starting) and a prior
 *   still-open ACTIVE one (resuming without ever having released the bay),
 *   and also consumes any independent follow-up SCHEDULED reservation, since
 *   only one SCHEDULED slot can exist at a time and the car is back now.
 * A no-op when nothing matching is open.
 */
export async function closeOpenOrderTimeBooking(
  tx: PrismaTransactionClient,
  orderId: string,
  at: Date,
  kind: OrderBookingKind | "all",
): Promise<void> {
  await tx.orderTimeBooking.updateMany({
    where: kind === "all" ? { orderId, closedAt: null } : { orderId, closedAt: null, kind },
    data: { closedAt: at, endAt: at },
  });
}

/**
 * Updates the forecast end time of the currently open ACTIVE booking, without
 * closing it — a revision to work still in progress, never touches an
 * independent open SCHEDULED follow-up.
 */
export async function updateOpenOrderTimeBookingForecast(
  tx: PrismaTransactionClient,
  orderId: string,
  endAt: Date | null,
): Promise<void> {
  await tx.orderTimeBooking.updateMany({
    where: { orderId, closedAt: null, kind: "ACTIVE" },
    data: { endAt },
  });
}

/**
 * Updates the start (and optionally end) time of the currently open SCHEDULED
 * booking in place — always kind: "SCHEDULED", whether that row is a
 * not-yet-started order's own scheduledAt, a POSTPONED return time, or an
 * IN_PROGRESS order's follow-up; never touches an open ACTIVE row. A no-op
 * when no SCHEDULED row is open.
 */
export async function updateOpenOrderTimeBookingSchedule(
  tx: PrismaTransactionClient,
  orderId: string,
  input: { startAt: Date; endAt: Date | null },
): Promise<void> {
  await tx.orderTimeBooking.updateMany({
    where: { orderId, closedAt: null, kind: "SCHEDULED" },
    data: { startAt: input.startAt, endAt: input.endAt },
  });
}

export type OpenOrderTimeBooking = {
  id: string;
  kind: OrderBookingKind;
  startAt: Date;
  endAt: Date | null;
};

/**
 * Reads every currently open booking for this order (0, 1, or 2 rows — at
 * most one per kind, per the D-076 invariant above). Callers that only care
 * about one kind should filter the result (`.find(b => b.kind === "ACTIVE")`).
 * Callable with either `prisma` (normal RLS request scope) or a `tx` inside a
 * transaction.
 */
export async function getOpenOrderTimeBookings(
  client: { orderTimeBooking: typeof prisma.orderTimeBooking },
  orderId: string,
): Promise<OpenOrderTimeBooking[]> {
  return client.orderTimeBooking.findMany({
    where: { orderId, closedAt: null },
    select: { id: true, kind: true, startAt: true, endAt: true },
  });
}

/** Opens a new booking row. Caller is responsible for closing any prior open row of the same kind first (the D-076 invariant is enforced at the application level, not by a DB constraint). */
export async function openOrderTimeBooking(
  tx: PrismaTransactionClient,
  input: {
    tenantId: string;
    orderId: string;
    branchId: string;
    kind: OrderBookingKind;
    startAt: Date;
    endAt: Date | null;
    createdById: string | null;
  },
): Promise<void> {
  await tx.orderTimeBooking.create({
    data: {
      tenantId: input.tenantId,
      orderId: input.orderId,
      branchId: input.branchId,
      kind: input.kind,
      startAt: input.startAt,
      endAt: input.endAt,
      closedAt: null,
      createdById: input.createdById,
    },
  });
}
