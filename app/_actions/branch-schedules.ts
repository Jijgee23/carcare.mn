"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { canEdit } from "@/lib/auth/roles";
import { assertActiveSubscription } from "@/lib/subscription-server";
import { ALL_WEEKDAYS, isValidTime, type Weekday } from "@/lib/branches";
import { bookingDayBounds } from "@/lib/booking-time";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { resolveEffectiveSchedule } from "@/lib/branch-effective-schedule";
import { applyScheduleClips, inspectScheduleImpact, type ScheduleImpact } from "@/lib/branch-schedule-impact";

export type BranchScheduleActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  // S13 Phase 4 — see app/dashboard/branches/_components/schedule-impact-preview.tsx.
  impact?: ScheduleImpact;
  needsConfirm?: boolean;
} | null;

function s(fd: FormData, key: string): string {
  const value = fd.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  try {
    bookingDayBounds(value);
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(date.getTime()) ? date : null;
  } catch {
    return null;
  }
}

async function authorizeBranch(branchId: string) {
  const user = await requireUser();
  if (!canEdit(user, "branches")) throw new Error("Танд салбарын хуваарь засах эрх байхгүй.");
  await assertActiveSubscription(user.tenantId);
  const branch = await prisma.branch.findFirst({
    where: { id: branchId, tenantId: user.tenantId },
    select: { id: true, tenantId: true, name: true },
  });
  if (!branch) throw new Error("Салбар олдсонгүй.");
  return { user, branch };
}

function parseOpenTimes(
  fd: FormData,
  prefix: string,
  errors: Record<string, string>,
) {
  const isOpen = fd.get(`${prefix}_isOpen`) === "on";
  const openTime = s(fd, `${prefix}_openTime`) || null;
  const closeTime = s(fd, `${prefix}_closeTime`) || null;
  if (isOpen) {
    if (!openTime || !isValidTime(openTime)) errors[`${prefix}_openTime`] = "Нээх цаг шаардлагатай.";
    if (!closeTime || !isValidTime(closeTime)) errors[`${prefix}_closeTime`] = "Хаах цаг шаардлагатай.";
    if (openTime && closeTime && isValidTime(openTime) && isValidTime(closeTime) && closeTime <= openTime) {
      errors[`${prefix}_closeTime`] = "Хаах цаг нээх цагаас хойш байна.";
    }
  }
  return { isOpen, openTime, closeTime };
}

export async function upsertBranchScheduleExceptionAction(
  branchId: string,
  _prev: BranchScheduleActionState,
  formData: FormData,
): Promise<BranchScheduleActionState> {
  let auth;
  try { auth = await authorizeBranch(branchId); } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Эрх шалгахад алдаа гарлаа." };
  }

  const dateStr = s(formData, "date");
  const exceptionId = s(formData, "exceptionId") || null;
  const label = s(formData, "label");
  const date = parseDate(dateStr);
  const errors: Record<string, string> = {};
  if (!date) errors.date = "Огноог YYYY-MM-DD хэлбэрээр оруулна уу.";
  if (label.length > 120) errors.label = "Тайлбар 120 тэмдэгтээс урт байж болохгүй.";
  const times = parseOpenTimes(formData, "exception", errors);
  if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors };
  const confirmed = s(formData, "confirmed") === "true";

  try {
    const result = await prisma.$transaction(async (tx) => {
      // S13: same branch-row lock as lib/appointment-reservations.ts, so the
      // overlap check + impact inspection + save serialize against concurrent
      // bookings on this branch.
      await tx.$queryRaw`SELECT id FROM "Branch" WHERE id = ${branchId} AND "tenantId" = ${auth.branch.tenantId} FOR UPDATE`;
      const current = await tx.branch.findFirst({
        where: { id: branchId, tenantId: auth.branch.tenantId },
        include: { schedules: true, scheduleExceptions: true, scheduleSeasons: { include: { days: true } } },
      });
      if (!current) throw new Error("Салбар олдсонгүй.");
      const previous = exceptionId
        ? current.scheduleExceptions.find((item) => item.id === exceptionId)
        : null;
      if (exceptionId && !previous) throw new Error("Тусгай өдрийн хуваарь олдсонгүй.");
      const conflictingDate = current.scheduleExceptions.find(
        (item) => item.date.getTime() === date!.getTime() && item.id !== exceptionId,
      );
      if (conflictingDate) throw new Error("Энэ өдөр аль хэдийн тусгай хуваарьтай байна.");
      const proposedException = {
        date: date!,
        isOpen: times.isOpen,
        openTime: times.isOpen ? times.openTime : null,
        closeTime: times.isOpen ? times.closeTime : null,
        label: label || null,
      };
      const branch = {
        openTime: current.openTime,
        closeTime: current.closeTime,
        schedules: current.schedules,
        scheduleExceptions: [
          ...current.scheduleExceptions.filter(
            (item) => item.id !== exceptionId && item.date.getTime() !== date!.getTime(),
          ),
          proposedException,
        ],
        scheduleSeasons: current.scheduleSeasons,
      };
      const affectedDates = [dateStr];
      if (previous) affectedDates.push(previous.date.toISOString().slice(0, 10));
      const affectedDateValues = affectedDates.sort();
      const impact = await inspectScheduleImpact(tx, {
        tenantId: auth.branch.tenantId,
        branchId,
        from: bookingDayBounds(affectedDateValues[0]!).start,
        to: bookingDayBounds(affectedDateValues.at(-1)!).end,
        resolve: (key) => resolveEffectiveSchedule({ dateStr: key, branch }),
        fallbackDurationMinutes: current.slotMinutes ?? 30,
      });
      if (impact.erased.length > 0) {
        return {
          blocked: true as const,
          needsConfirm: false,
          impact,
          message: `Энэ өөрчлөлт ${impact.erased.length} захиалгыг бүрэн хүчингүй болгоно. Ажилтан эхлээд шийднэ үү.`,
        };
      }
      if (impact.clipped.length > 0 && !confirmed) {
        return {
          blocked: true as const,
          needsConfirm: true,
          impact,
          message: `Энэ өөрчлөлт ${impact.clipped.length} захиалгын үргэлжлэх хугацааг богиносгоно. Доор жагсаалтыг харж баталгаажуулна уу.`,
        };
      }
      const existing = await tx.branchScheduleException.findUnique({
        where: { branchId_date: { branchId, date: date! } },
        select: { id: true, isOpen: true, openTime: true, closeTime: true, label: true },
      });
      const saved = await tx.branchScheduleException.upsert({
        where: { branchId_date: { branchId, date: date! } },
        create: { branchId, date: date!, isOpen: times.isOpen, openTime: times.isOpen ? times.openTime : null, closeTime: times.isOpen ? times.closeTime : null, label: label || null },
        update: { isOpen: times.isOpen, openTime: times.isOpen ? times.openTime : null, closeTime: times.isOpen ? times.closeTime : null, label: label || null },
        select: { id: true },
      });
      if (previous && previous.date.getTime() !== date!.getTime()) {
        await tx.branchScheduleException.delete({ where: { id: previous.id } });
      }
      await applyScheduleClips(tx, impact);
      return {
        blocked: false as const,
        existing: existing ?? previous,
        saved,
        clipped: impact.clipped.length,
      };
    });
    if (result.blocked) {
      return { ok: false, message: result.message, impact: result.impact, needsConfirm: result.needsConfirm };
    }
    await logAudit({
      tenantId: auth.branch.tenantId,
      userId: auth.user.id,
      branchId,
      entity: "Branch",
      entityId: branchId,
      action: result.existing ? "UPDATE" : "CREATE",
      summary: `Тусгай өдөр · ${dateStr}`,
      before: result.existing ?? undefined,
      after: { id: result.saved.id, date: dateStr, isOpen: times.isOpen, openTime: times.openTime, closeTime: times.closeTime, label: label || null },
    });
    revalidatePath(`/dashboard/branches/${branchId}/schedule`);
    revalidatePath(`/dashboard/branches/${branchId}`);
    revalidatePath("/dashboard/branches");
    return { ok: true, message: result.clipped ? `Хадгаллаа. ${result.clipped} захиалгын үргэлжлэх хугацааг хаах цагт таарууллаа.` : "Тусгай өдрийн хуваарь хадгалагдлаа." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Тусгай өдөр хадгалахад алдаа гарлаа." };
  }
}

export async function deleteBranchScheduleExceptionAction(formData: FormData): Promise<void> {
  const branchId = s(formData, "branchId");
  const id = s(formData, "id");
  if (!branchId || !id) return;
  const { user } = await authorizeBranch(branchId);
  const deleted = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Branch" WHERE id = ${branchId} AND "tenantId" = ${user.tenantId} FOR UPDATE`;
    const current = await tx.branch.findFirst({
      where: { id: branchId, tenantId: user.tenantId },
      include: { schedules: true, scheduleExceptions: true, scheduleSeasons: { include: { days: true } } },
    });
    const target = current?.scheduleExceptions.find((item) => item.id === id);
    if (!current || !target) return { count: 0 };
    const targetDate = target.date.toISOString().slice(0, 10);
    const branch = {
      openTime: current.openTime,
      closeTime: current.closeTime,
      schedules: current.schedules,
      scheduleExceptions: current.scheduleExceptions.filter((item) => item.id !== id),
      scheduleSeasons: current.scheduleSeasons,
    };
    const impact = await inspectScheduleImpact(tx, {
      tenantId: user.tenantId,
      branchId,
      from: bookingDayBounds(targetDate).start,
      to: bookingDayBounds(targetDate).end,
      resolve: (dateStr) => resolveEffectiveSchedule({ dateStr, branch }),
      fallbackDurationMinutes: current.slotMinutes ?? 30,
    });
    if (impact.erased.length > 0) {
      throw new Error(`Энэ өөрчлөлт ${impact.erased.length} захиалгыг бүрэн хүчингүй болгоно. Ажилтан эхлээд шийднэ үү.`);
    }
    const result = await tx.branchScheduleException.deleteMany({ where: { id, branchId } });
    await applyScheduleClips(tx, impact);
    return result;
  });
  if (deleted.count > 0) {
    await logAudit({ tenantId: user.tenantId, userId: user.id, branchId, entity: "Branch", entityId: branchId, action: "DELETE", summary: "Тусгай өдрийн хуваарь устгав" });
  }
  revalidatePath(`/dashboard/branches/${branchId}/schedule`);
  revalidatePath(`/dashboard/branches/${branchId}`);
}

export async function upsertBranchScheduleSeasonAction(
  branchId: string,
  _prev: BranchScheduleActionState,
  formData: FormData,
): Promise<BranchScheduleActionState> {
  let auth;
  try { auth = await authorizeBranch(branchId); } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Эрх шалгахад алдаа гарлаа." };
  }

  const id = s(formData, "seasonId") || null;
  const name = s(formData, "name");
  const startsOn = s(formData, "startsOn");
  const endsOn = s(formData, "endsOn");
  const starts = parseDate(startsOn);
  const ends = parseDate(endsOn);
  const errors: Record<string, string> = {};
  if (!name) errors.name = "Улирлын нэр шаардлагатай.";
  if (name.length > 120) errors.name = "Улирлын нэр 120 тэмдэгтээс урт байж болохгүй.";
  if (!starts) errors.startsOn = "Эхлэх огноо буруу.";
  if (!ends) errors.endsOn = "Дуусах огноо буруу.";
  if (starts && ends && ends <= starts) errors.endsOn = "Дуусах огноо эхлэх огнооноос хойш байна.";
  const days = {} as Record<Weekday, ReturnType<typeof parseOpenTimes>>;
  for (const wd of ALL_WEEKDAYS) days[wd] = parseOpenTimes(formData, `season_${wd}`, errors);
  if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors };
  const confirmed = s(formData, "confirmed") === "true";

  try {
    const txResult = await prisma.$transaction(async (tx) => {
      // S13: previously this whole action (overlap check through save) ran as
      // bare `prisma.*` calls with no transaction and no lock at all — the
      // overlap check could pass against a stale snapshot that a concurrent
      // write already invalidated. Now matches the branch-row lock pattern
      // used by lib/appointment-reservations.ts and the other 4 mutation
      // actions in this file/branches.ts.
      await tx.$queryRaw`SELECT id FROM "Branch" WHERE id = ${branchId} AND "tenantId" = ${auth.branch.tenantId} FOR UPDATE`;

      const overlap = await tx.branchScheduleSeason.findFirst({
        where: {
          branchId,
          isActive: true,
          ...(id ? { id: { not: id } } : {}),
          startsOn: { lt: ends! },
          endsOn: { gt: starts! },
        },
        select: { id: true, name: true },
      });
      if (overlap) return { ok: false as const, message: `Энэ хугацаа "${overlap.name}" улиралтай давхцаж байна.` };

      const existing = id
        ? await tx.branchScheduleSeason.findFirst({ where: { id, branchId }, include: { days: true } })
        : null;
      if (id && !existing) return { ok: false as const, message: "Улирал олдсонгүй." };
      const currentBranch = await tx.branch.findFirst({
        where: { id: branchId, tenantId: auth.branch.tenantId },
        include: { schedules: true, scheduleExceptions: true, scheduleSeasons: { include: { days: true } } },
      });
      if (!currentBranch) return { ok: false as const, message: "Салбар олдсонгүй." };
      const proposedSeason = {
        name,
        startsOn: starts!,
        endsOn: ends!,
        isActive: true,
        days: ALL_WEEKDAYS.map((weekday) => ({ weekday, ...days[weekday] })),
      };
      const now = new Date();
      const seasonImpactStart = bookingDayBounds(startsOn).start;
      const seasonImpactEnd = bookingDayBounds(endsOn).start;
      const impactFrom = seasonImpactStart.getTime() > now.getTime() ? seasonImpactStart : now;
      const impact = impactFrom < seasonImpactEnd
        ? await inspectScheduleImpact(tx, {
            tenantId: auth.branch.tenantId,
            branchId,
            from: impactFrom,
            to: seasonImpactEnd,
            resolve: (dateStr) => resolveEffectiveSchedule({
              dateStr,
              branch: {
                openTime: currentBranch.openTime,
                closeTime: currentBranch.closeTime,
                schedules: currentBranch.schedules,
                scheduleExceptions: currentBranch.scheduleExceptions,
                scheduleSeasons: [
                  ...currentBranch.scheduleSeasons.filter((item) => item.id !== id),
                  proposedSeason,
                ],
              },
            }),
            fallbackDurationMinutes: currentBranch.slotMinutes ?? 30,
          })
        : { erased: [], clipped: [] };
      if (impact.erased.length > 0) {
        return {
          ok: false as const,
          message: `Энэ улирал ${impact.erased.length} захиалгыг бүрэн хүчингүй болгоно. Ажилтан эхлээд шийднэ үү.`,
          impact,
          needsConfirm: false,
        };
      }
      if (impact.clipped.length > 0 && !confirmed) {
        return {
          ok: false as const,
          message: `Энэ улирал ${impact.clipped.length} захиалгын үргэлжлэх хугацааг богиносгоно. Доор жагсаалтыг харж баталгаажуулна уу.`,
          impact,
          needsConfirm: true,
        };
      }
      const saved = existing
        ? await tx.branchScheduleSeason.update({
            where: { id: id! },
            data: { name, startsOn: starts!, endsOn: ends!, isActive: true, days: { deleteMany: {}, create: ALL_WEEKDAYS.map((weekday) => ({ weekday, isOpen: days[weekday].isOpen, openTime: days[weekday].isOpen ? days[weekday].openTime : undefined, closeTime: days[weekday].isOpen ? days[weekday].closeTime : undefined })) } },
            select: { id: true },
          })
        : await tx.branchScheduleSeason.create({
            data: { branchId, name, startsOn: starts!, endsOn: ends!, isActive: true, days: { create: ALL_WEEKDAYS.map((weekday) => ({ weekday, isOpen: days[weekday].isOpen, openTime: days[weekday].openTime || undefined, closeTime: days[weekday].closeTime || undefined })) } },
            select: { id: true },
          });
      await applyScheduleClips(tx, impact);
      return { ok: true as const, existing, saved, clipped: impact.clipped.length };
    });
    if (!txResult.ok) {
      return {
        ok: false,
        message: txResult.message,
        impact: "impact" in txResult ? txResult.impact : undefined,
        needsConfirm: "needsConfirm" in txResult ? txResult.needsConfirm : undefined,
      };
    }
    const { existing, saved, clipped } = txResult;
    await logAudit({
      tenantId: auth.branch.tenantId,
      userId: auth.user.id,
      branchId,
      entity: "Branch",
      entityId: branchId,
      action: existing ? "UPDATE" : "CREATE",
      summary: `Улирлын хуваарь · ${name}`,
      before: existing ? { id: existing.id, name: existing.name, startsOn: existing.startsOn.toISOString(), endsOn: existing.endsOn.toISOString(), days: existing.days } : undefined,
      after: { id: saved.id, name, startsOn, endsOn, days },
    });
    revalidatePath(`/dashboard/branches/${branchId}/schedule`);
    revalidatePath(`/dashboard/branches/${branchId}`);
    revalidatePath("/dashboard/branches");
    return { ok: true, message: clipped ? `Хадгаллаа. ${clipped} захиалгын үргэлжлэх хугацааг хаах цагт таарууллаа.` : "Улирлын хуваарь хадгалагдлаа." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Улирлын хуваарь хадгалахад алдаа гарлаа." };
  }
}

export async function deleteBranchScheduleSeasonAction(formData: FormData): Promise<void> {
  const branchId = s(formData, "branchId");
  const id = s(formData, "id");
  if (!branchId || !id) return;
  const { user } = await authorizeBranch(branchId);
  const deleted = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Branch" WHERE id = ${branchId} AND "tenantId" = ${user.tenantId} FOR UPDATE`;
    const current = await tx.branch.findFirst({
      where: { id: branchId, tenantId: user.tenantId },
      include: { schedules: true, scheduleExceptions: true, scheduleSeasons: { include: { days: true } } },
    });
    const target = current?.scheduleSeasons.find((item) => item.id === id);
    if (!current || !target) return { count: 0 };
    const branch = {
      openTime: current.openTime,
      closeTime: current.closeTime,
      schedules: current.schedules,
      scheduleExceptions: current.scheduleExceptions,
      scheduleSeasons: current.scheduleSeasons.filter((item) => item.id !== id),
    };
    const seasonEnd = target.endsOn.toISOString().slice(0, 10);
    const impactFrom = bookingDayBounds(target.startsOn.toISOString().slice(0, 10)).start;
    const now = new Date();
    const from = impactFrom.getTime() > now.getTime() ? impactFrom : now;
    const to = bookingDayBounds(seasonEnd).start;
    const impact = from < to
      ? await inspectScheduleImpact(tx, {
          tenantId: user.tenantId,
          branchId,
          from,
          to,
          resolve: (dateStr) => resolveEffectiveSchedule({ dateStr, branch }),
          fallbackDurationMinutes: current.slotMinutes ?? 30,
        })
      : { erased: [], clipped: [] };
    if (impact.erased.length > 0) {
      throw new Error(`Энэ өөрчлөлт ${impact.erased.length} захиалгыг бүрэн хүчингүй болгоно. Ажилтан эхлээд шийднэ үү.`);
    }
    const result = await tx.branchScheduleSeason.deleteMany({ where: { id, branchId } });
    await applyScheduleClips(tx, impact);
    return result;
  });
  if (deleted.count > 0) {
    await logAudit({ tenantId: user.tenantId, userId: user.id, branchId, entity: "Branch", entityId: branchId, action: "DELETE", summary: "Улирлын хуваарь устгав" });
  }
  revalidatePath(`/dashboard/branches/${branchId}/schedule`);
  revalidatePath(`/dashboard/branches/${branchId}`);
}
