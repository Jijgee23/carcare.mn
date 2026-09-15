import { businessDateKey, resolveEffectiveSchedule } from "@/lib/branch-effective-schedule";
import { timeToMinutes, weekdayOfDateStr } from "@/lib/branches";
import { pickActiveSegment, resolveEmployeeDay } from "@/lib/employee-schedule";
import { prisma } from "@/lib/prisma";

export type LockedBranch = { branchId: string; branchName: string };

/** Одоогийн (Улаанбаатарын цагийн бүсийн) өдрийн доторх минут. */
function nowMinutesUB(): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Ulaanbaatar",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value]),
  );
  return Number(parts.hour) * 60 + Number(parts.minute);
}

/**
 * Ажилтны өнөөдрийн ажлын хувиараар "түгжигдсэн" (сонголтгүйгээр албан
 * тодорхойлогдсон) салбарыг тодорхойлно. Зөвхөн ӨНӨӨДӨР бодит override
 * (EmployeeScheduleException эсвэл EmployeeWorkSchedule мөр) байгаа, тэр нь
 * ажилладаг гэж заасан үед л буцаана — цэвэр default (зөвхөн `User.branchId`-
 * гаа дагадаг, override-гүй) өдөр бол `null`, ердийн choose-branch/switcher
 * ажиллагаа хэвээр байна (харах: app/dashboard/layout.tsx,
 * app/_actions/auth.ts-ийн signInAction/activateAccountAction/
 * chooseBranchAction). Нэг өдөр хэд хэдэн салбарт (segment) дамжиж болдог тул
 * одоогийн (UB) цагт хамаарах segment-ийг сонгож буцаана.
 *
 * Дуудагч тал өөрөө tenant context-оо (setTenantContext/setBypassContext)
 * аль хэдийн тохируулсан байх ёстой — энд шинээр тохируулахгүй.
 */
export async function resolveTodayLockedBranch(user: {
  id: string;
  tenantId: string;
  branchId: string | null;
}): Promise<LockedBranch | null> {
  const todayStr = businessDateKey();
  const weekday = weekdayOfDateStr(todayStr);

  const emp = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      workSchedule: {
        where: { weekday },
        select: {
          weekday: true,
          isWorking: true,
          segments: {
            orderBy: { order: "asc" },
            select: { branchId: true, startTime: true, endTime: true },
          },
        },
      },
      scheduleExceptions: {
        where: { date: new Date(`${todayStr}T00:00:00.000Z`) },
        select: {
          isWorking: true,
          segments: {
            orderBy: { order: "asc" },
            select: { branchId: true, startTime: true, endTime: true },
          },
        },
      },
    },
  });
  if (!emp) return null;

  const resolved = resolveEmployeeDay({
    dateStr: todayStr,
    weekday,
    homeBranchId: user.branchId,
    weeklyRules: emp.workSchedule,
    exceptions: emp.scheduleExceptions.map((e) => ({ ...e, date: todayStr })),
  });

  if (resolved.source === "default" || !resolved.working || resolved.segments.length === 0) {
    return null;
  }

  const branchIds = [...new Set(resolved.segments.map((s) => s.branchId))];
  const branches = await prisma.branch.findMany({
    where: { id: { in: branchIds }, tenantId: user.tenantId },
    select: {
      id: true,
      name: true,
      openTime: true,
      closeTime: true,
      schedules: { select: { weekday: true, isOpen: true, openTime: true, closeTime: true } },
    },
  });
  const branchMap = new Map(branches.map((b) => [b.id, b]));

  const nowMinutes = nowMinutesUB();
  const timed = resolved.segments
    .map((seg) => {
      const b = branchMap.get(seg.branchId);
      if (!b) return null; // тухайн тенантад харьяалагдахгүй/устсан салбар — алгасна
      let start = seg.startTime;
      let end = seg.endTime;
      if (!start || !end) {
        const eff = resolveEffectiveSchedule({
          dateStr: todayStr,
          branch: { openTime: b.openTime, closeTime: b.closeTime, schedules: b.schedules },
        });
        start = start ?? eff.openTime;
        end = end ?? eff.closeTime;
      }
      return {
        branchId: seg.branchId,
        startMinutes: start ? timeToMinutes(start) : null,
        endMinutes: end ? timeToMinutes(end) : null,
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);
  if (timed.length === 0) return null;

  const active = pickActiveSegment(timed, nowMinutes);
  if (!active) return null;
  const branch = branchMap.get(active.branchId);
  if (!branch) return null;
  return { branchId: branch.id, branchName: branch.name };
}
