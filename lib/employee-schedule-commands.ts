// P6-B1 — `app/_actions/employee-schedule.ts`-ийн бизнес логикийг (segment
// parse, upsert/reset/bulk) framework-гүй `lib/`-рүү зөөв: FormData,
// redirect, revalidatePath, cookies байхгүй — үйлдэл (action) нь эрх
// шалгаад, энэ core-г дуудаад, audit + revalidatePath хийнэ. Загвар:
// `lib/customers/customer-commands.ts` (typed input/output), гэхдээ энд throw
// биш **typed discriminated result** ашиглана — учир нь эх action-ууд `{ok,
// message, fieldErrors}`-г ХАРИУ маягаар (throw биш) шууд буцаадаг байсан бөгөөд
// сурвалж мессежийг (Монгол хэлээр, үг үсэгчилэн) яг хэвээр хадгалахыг
// шаарддаг. Prisma клиентийг параметр байдлаар авна (tenant-context RLS
// extension-той жинхэнэ instance эсвэл $transaction-ий доторх client аль аль
// нь тохирно) — `lib/` доторх код server-action directive/next-specific импортгүй.

import type { prisma as PrismaSingleton } from "@/lib/prisma";
import { isValidTime, isWeekday, type Weekday } from "@/lib/branches";

/** Дуудагч талын tenant-scoped Prisma instance. */
export type ScheduleDb = typeof PrismaSingleton;

export type EmployeeScheduleActor = { id: string; tenantId: string };

export type EmployeeScheduleTarget = {
  id: string;
  firstName: string;
  lastName: string;
};

export type ParsedSegment = {
  branchId: string;
  startTime: string | null;
  endTime: string | null;
};

/** Бүх core функцийн буцаах discriminated result — `code` нь тогтвортой машин ID. */
export type ScheduleCommandError =
  | { ok: false; code: "FORBIDDEN"; message: string }
  | { ok: false; code: "NOT_FOUND"; message: string }
  | { ok: false; code: "VALIDATION"; message?: string; fieldErrors?: Record<string, string> };

export type AuthorizeTargetResult =
  | { ok: true; target: EmployeeScheduleTarget }
  | { ok: false; code: "FORBIDDEN" | "NOT_FOUND"; message: string };

const ERR_NO_SCHEDULE_PERMISSION = "Танд ажлын хувиар засах эрх байхгүй.";
const ERR_EMPLOYEE_NOT_FOUND = "Ажилтан олдсонгүй.";

/**
 * Эрх (`employees.schedule`) болон зорилтот ажилтан tenant-д харьяалагдах
 * эсэхийг шалгана. Эрхийн шалгалт өөрөө (`hasPermission`) дуудагч талд
 * үлдэнэ (`lib/auth/roles`-ийг `lib/`-ээс dependency болгож нэмэхгүй байх
 * зорилготой) — энд зөвхөн урьдчилж тооцоолсон `hasSchedulePermission`-ийг
 * boolean-аар авна.
 */
export async function authorizeScheduleTarget(
  db: ScheduleDb,
  input: { hasSchedulePermission: boolean; tenantId: string; userId: string },
): Promise<AuthorizeTargetResult> {
  if (!input.hasSchedulePermission) {
    return { ok: false, code: "FORBIDDEN", message: ERR_NO_SCHEDULE_PERMISSION };
  }
  const target = await db.user.findFirst({
    where: { id: input.userId, tenantId: input.tenantId },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!target) {
    return { ok: false, code: "NOT_FOUND", message: ERR_EMPLOYEE_NOT_FOUND };
  }
  return { ok: true, target };
}

/**
 * Клиент талаас нэг өдрийн бүх segment (аль салбарт, ямар цагаар)-ыг нэг
 * JSON массив болгож (`segmentsJson`) ирүүлдэг — өдөр нэг зэрэг хэд хэдэн
 * салбарт дамжиж ажиллаж болдог тул хэдэн ч мөр байж болно. Энд шалгаж
 * бодит `ParsedSegment[]`-рүү хөрвүүлнэ.
 */
export async function parseSegments(
  db: ScheduleDb,
  tenantId: string,
  raw: string,
  errors: Record<string, string>,
): Promise<ParsedSegment[]> {
  let list: unknown;
  try {
    list = JSON.parse(raw || "[]");
  } catch {
    errors.segments = "Салбарын мэдээлэл уншигдсангүй.";
    return [];
  }
  if (!Array.isArray(list) || list.length === 0) {
    errors.segments = "Дор хаяж нэг салбар сонгоно уу.";
    return [];
  }

  const branchIds = [
    ...new Set(
      list
        .map((item) => (item && typeof item === "object" ? (item as Record<string, unknown>).branchId : null))
        .filter((v): v is string => typeof v === "string" && v.length > 0),
    ),
  ];
  const found = await db.branch.findMany({
    where: { id: { in: branchIds }, tenantId },
    select: { id: true },
  });
  const validBranchIds = new Set(found.map((b) => b.id));

  const parsed: ParsedSegment[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") {
      errors.segments = "Салбарын мэдээлэл буруу.";
      continue;
    }
    const rec = item as Record<string, unknown>;
    const branchId = typeof rec.branchId === "string" ? rec.branchId : "";
    if (!branchId || !validBranchIds.has(branchId)) {
      errors.segments = "Сонгосон салбар олдсонгүй.";
      continue;
    }
    const startTime = typeof rec.startTime === "string" && rec.startTime ? rec.startTime : null;
    const endTime = typeof rec.endTime === "string" && rec.endTime ? rec.endTime : null;
    if (startTime && !isValidTime(startTime)) errors.segments = "Цаг буруу (HH:MM).";
    if (endTime && !isValidTime(endTime)) errors.segments = "Цаг буруу (HH:MM).";
    if ((startTime && !endTime) || (!startTime && endTime)) {
      errors.segments = "Эхлэх, дуусах цаг хоёуланг нь оруулна уу (эсвэл хоёуланг нь хоосон орхино).";
    } else if (startTime && endTime && endTime <= startTime) {
      errors.segments = "Дуусах цаг эхлэх цагаас хойш байна.";
    }
    parsed.push({ branchId, startTime, endTime });
  }
  return parsed;
}

function segmentCreateInput(segments: ParsedSegment[]) {
  return segments.map((seg, i) => ({
    order: i,
    branchId: seg.branchId,
    startTime: seg.startTime,
    endTime: seg.endTime,
  }));
}

export type UpsertShiftInput = {
  tenantId: string;
  userId: string;
  scope: string;
  isWorking: boolean;
  segmentsJson: string;
  date: string;
  weekday: string;
};

export type UpsertShiftResult =
  | { ok: true; message: string; scope: "date" | "weekday"; date?: string; weekday?: Weekday }
  | ScheduleCommandError;

/**
 * Ажилтны нэг өдрийн хувиарыг тохируулна (нэг буюу хэд хэдэн салбарын
 * segment-тэйгээр). `scope=date` бол зөвхөн тухайн өдөрт
 * (`EmployeeScheduleException`), `scope=weekday` бол тухайн гараг бүрт
 * давтагдах байнгын дүрэм (`EmployeeWorkSchedule`) болгож бичнэ. Audit
 * бичих, `revalidatePath` дуудах нь дуудагч (action wrapper)-ийн үүрэг.
 */
export async function upsertEmployeeShiftCommand(
  db: ScheduleDb,
  input: UpsertShiftInput,
): Promise<UpsertShiftResult> {
  const errors: Record<string, string> = {};
  const segments = input.isWorking
    ? await parseSegments(db, input.tenantId, input.segmentsJson, errors)
    : [];
  if (Object.keys(errors).length > 0) {
    return { ok: false, code: "VALIDATION", fieldErrors: errors };
  }

  const segmentCreate = segmentCreateInput(segments);

  if (input.scope === "date") {
    const dateStr = input.date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return { ok: false, code: "VALIDATION", message: "Огноо буруу." };
    }
    const date = new Date(`${dateStr}T00:00:00.000Z`);
    await db.employeeScheduleException.upsert({
      where: { userId_date: { userId: input.userId, date } },
      create: { userId: input.userId, date, isWorking: input.isWorking, segments: { create: segmentCreate } },
      update: { isWorking: input.isWorking, segments: { deleteMany: {}, create: segmentCreate } },
    });
    return { ok: true, message: "Хадгалагдлаа.", scope: "date", date: dateStr };
  }

  const weekday = input.weekday;
  if (!isWeekday(weekday)) {
    return { ok: false, code: "VALIDATION", message: "Гараг буруу." };
  }
  await db.employeeWorkSchedule.upsert({
    where: { userId_weekday: { userId: input.userId, weekday } },
    create: { userId: input.userId, weekday, isWorking: input.isWorking, segments: { create: segmentCreate } },
    update: { isWorking: input.isWorking, segments: { deleteMany: {}, create: segmentCreate } },
  });
  return { ok: true, message: "Хадгалагдлаа.", scope: "weekday", weekday };
}

export type ResetShiftInput = {
  userId: string;
  scope: string;
  date: string;
  weekday: string;
};

export type ResetShiftResult =
  | { ok: true; scope: "date" | "weekday" }
  | { ok: false; code: "VALIDATION" };

/** Override мөрийг арилгаж, платформын анхны утга (үндсэн салбарын хуваарь) руу буцаана. */
export async function resetEmployeeShiftCommand(
  db: ScheduleDb,
  input: ResetShiftInput,
): Promise<ResetShiftResult> {
  if (input.scope === "date") {
    const dateStr = input.date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return { ok: false, code: "VALIDATION" };
    const date = new Date(`${dateStr}T00:00:00.000Z`);
    await db.employeeScheduleException.deleteMany({ where: { userId: input.userId, date } });
    return { ok: true, scope: "date" };
  }
  const weekday = input.weekday;
  if (!isWeekday(weekday)) return { ok: false, code: "VALIDATION" };
  await db.employeeWorkSchedule.deleteMany({ where: { userId: input.userId, weekday } });
  return { ok: true, scope: "weekday" };
}

export type BulkTarget = { userId: string; date: string; weekday: string };

export type BulkUpsertShiftInput = {
  tenantId: string;
  scope: string;
  isWorking: boolean;
  segmentsJson: string;
  targetsJson: string;
};

export type BulkUpsertShiftResult =
  | { ok: true; applied: number; scope: "date" | "weekday" }
  | ScheduleCommandError;

/**
 * Олон (ажилтан × өдөр) нүдэнд НЭГ зэрэг ижил хувиар (салбар(ууд)/цаг/
 * амарна эсэх) тохируулна — grid дээр хэд хэдэн нүд сонгоод "Тохируулах"
 * дарахад дуудагдана (харах: schedule-grid.tsx BulkShiftEditor). `scope=date`
 * бол сонгосон ХАРГАЛЗАХ өдөр бүрт (`EmployeeScheduleException`), `scope=
 * weekday` бол сонгосон нүдний (ажилтан, гараг) хосол бүрт байнга давтагдах
 * дүрэм (`EmployeeWorkSchedule`) болгож бичнэ — сүүлийнх нь нэг ажилтны хэд
 * хэдэн сонгосон огноо ижил гарагт унавал нэг л удаа бичигдэнэ (dedupe).
 */
export async function bulkUpsertEmployeeShiftCommand(
  db: ScheduleDb,
  input: BulkUpsertShiftInput,
): Promise<BulkUpsertShiftResult> {
  const errors: Record<string, string> = {};
  const segments = input.isWorking
    ? await parseSegments(db, input.tenantId, input.segmentsJson, errors)
    : [];
  if (Object.keys(errors).length > 0) {
    return { ok: false, code: "VALIDATION", fieldErrors: errors };
  }

  let targets: BulkTarget[];
  try {
    const parsed: unknown = JSON.parse(input.targetsJson || "[]");
    if (!Array.isArray(parsed)) throw new Error("not array");
    targets = parsed.filter(
      (t): t is BulkTarget =>
        Boolean(t) &&
        typeof t === "object" &&
        typeof (t as BulkTarget).userId === "string" &&
        typeof (t as BulkTarget).date === "string" &&
        typeof (t as BulkTarget).weekday === "string",
    );
  } catch {
    return { ok: false, code: "VALIDATION", message: "Сонголт уншигдсангүй." };
  }
  if (targets.length === 0) {
    return { ok: false, code: "VALIDATION", message: "Дор хаяж нэг нүд сонгоно уу." };
  }

  const userIds = [...new Set(targets.map((t) => t.userId))];
  const validUsers = await db.user.findMany({
    where: { id: { in: userIds }, tenantId: input.tenantId },
    select: { id: true },
  });
  const validUserIds = new Set(validUsers.map((u) => u.id));

  const segmentCreate = segmentCreateInput(segments);

  let applied = 0;
  if (input.scope === "date") {
    for (const t of targets) {
      if (!validUserIds.has(t.userId) || !/^\d{4}-\d{2}-\d{2}$/.test(t.date)) continue;
      const date = new Date(`${t.date}T00:00:00.000Z`);
      await db.employeeScheduleException.upsert({
        where: { userId_date: { userId: t.userId, date } },
        create: { userId: t.userId, date, isWorking: input.isWorking, segments: { create: segmentCreate } },
        update: { isWorking: input.isWorking, segments: { deleteMany: {}, create: segmentCreate } },
      });
      applied++;
    }
  } else {
    const seen = new Set<string>();
    for (const t of targets) {
      if (!validUserIds.has(t.userId) || !isWeekday(t.weekday)) continue;
      const key = `${t.userId}:${t.weekday}`;
      if (seen.has(key)) continue;
      seen.add(key);
      await db.employeeWorkSchedule.upsert({
        where: { userId_weekday: { userId: t.userId, weekday: t.weekday } },
        create: { userId: t.userId, weekday: t.weekday, isWorking: input.isWorking, segments: { create: segmentCreate } },
        update: { isWorking: input.isWorking, segments: { deleteMany: {}, create: segmentCreate } },
      });
      applied++;
    }
  }

  return { ok: true, applied, scope: input.scope === "date" ? "date" : "weekday" };
}
