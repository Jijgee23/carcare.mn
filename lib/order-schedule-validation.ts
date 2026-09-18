// Extracted from app/_actions/orders.ts (S12 follow-up) so other modules can
// share the exact same business-hours check used by the create/update/
// reschedule flows in that file, instead of duplicating it. Pure validation
// helpers — no writes, no "use server" boundary.
//
// D-111 removed this module's other export, `findScheduleConflict` — the
// overlap detector behind the "press Хадгалах again" prompts. It never
// blocked a save and ignored `slotCapacity`, so it warned about overlaps that
// the branch had room for. What remains here is working hours, which is a
// real constraint that still hard-blocks.

import { DEFAULT_SLOT_MINUTES } from "@/lib/appointment-slots";
import { bookingDateKey, bookingDayBounds } from "@/lib/booking-time";
import { resolveEffectiveSchedule } from "@/lib/branch-effective-schedule";
import { branchScheduleForDateSelect } from "@/lib/branch-effective-schedule-server";
import { timeToMinutes } from "@/lib/branches";
import { prisma } from "@/lib/prisma";

export async function validateScheduledOrderHours(
  tenantId: string,
  branchId: string,
  scheduledAt: Date | null,
  durationMinutes: number,
): Promise<string | null> {
  if (!scheduledAt) return null;
  if (!Number.isFinite(scheduledAt.getTime())) return "Товлосон огноо буруу.";
  const dateStr = bookingDateKey(scheduledAt);
  const branch = await prisma.branch.findFirst({
    where: { id: branchId, tenantId, isActive: true },
    select: { ...branchScheduleForDateSelect(dateStr) },
  });
  if (!branch) return "Салбар олдсонгүй.";
  const schedule = resolveEffectiveSchedule({ dateStr, branch });
  const start = timeToMinutes(schedule.openTime);
  const end = timeToMinutes(schedule.closeTime);
  const dayStart = bookingDayBounds(dateStr).start.getTime();
  const minutes = Math.floor((scheduledAt.getTime() - dayStart) / 60000);
  if (!schedule.open || start == null || end == null || minutes < start || minutes + durationMinutes > end) {
    return "Товлосон ажиллах цагийн гадуур байна.";
  }
  return null;
}

export async function getBranchSlotMinutes(tenantId: string, branchId: string): Promise<number> {
  const branch = await prisma.branch.findFirst({
    where: { id: branchId, tenantId },
    select: { slotMinutes: true },
  });
  return branch?.slotMinutes && branch.slotMinutes > 0
    ? branch.slotMinutes
    : DEFAULT_SLOT_MINUTES;
}
