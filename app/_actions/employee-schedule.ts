"use server";

import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/roles";
import { isValidTime, isWeekday } from "@/lib/branches";
import { prisma } from "@/lib/prisma";

export type EmployeeScheduleActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
} | null;

type ParsedSegment = { branchId: string; startTime: string | null; endTime: string | null };

function s(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

async function authorize(userId: string) {
  const actor = await requireUser();
  if (!hasPermission(actor, "employees.schedule")) {
    throw new Error("Танд ажлын хувиар засах эрх байхгүй.");
  }
  const target = await prisma.user.findFirst({
    where: { id: userId, tenantId: actor.tenantId },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!target) throw new Error("Ажилтан олдсонгүй.");
  return { actor, target };
}

/**
 * Клиент талаас нэг өдрийн бүх segment (аль салбарт, ямар цагаар)-ыг нэг
 * JSON массив болгож (`segmentsJson`) ирүүлдэг — өдөр нэг зэрэг хэд хэдэн
 * салбарт дамжиж ажиллаж болдог тул хэдэн ч мөр байж болно. Энд шалгаж
 * бодит `ParsedSegment[]`-рүү хөрвүүлнэ.
 */
async function parseSegments(
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
  const found = await prisma.branch.findMany({
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

/**
 * Ажилтны нэг өдрийн хувиарыг тохируулна (нэг буюу хэд хэдэн салбарын
 * segment-тэйгээр). `scope=date` бол зөвхөн тухайн өдөрт
 * (`EmployeeScheduleException`), `scope=weekday` бол тухайн гараг бүрт
 * давтагдах байнгын дүрэм (`EmployeeWorkSchedule`) болгож бичнэ.
 */
export async function upsertEmployeeShiftAction(
  userId: string,
  _prev: EmployeeScheduleActionState,
  formData: FormData,
): Promise<EmployeeScheduleActionState> {
  let auth;
  try {
    auth = await authorize(userId);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Алдаа" };
  }

  const scope = s(formData, "scope");
  const isWorking = formData.get("isWorking") === "on";
  const errors: Record<string, string> = {};
  const segments = isWorking
    ? await parseSegments(auth.actor.tenantId, s(formData, "segmentsJson"), errors)
    : [];
  if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors };

  const segmentCreate = segments.map((seg, i) => ({
    order: i,
    branchId: seg.branchId,
    startTime: seg.startTime,
    endTime: seg.endTime,
  }));

  if (scope === "date") {
    const dateStr = s(formData, "date");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return { ok: false, message: "Огноо буруу." };
    const date = new Date(`${dateStr}T00:00:00.000Z`);
    await prisma.employeeScheduleException.upsert({
      where: { userId_date: { userId, date } },
      create: { userId, date, isWorking, segments: { create: segmentCreate } },
      update: { isWorking, segments: { deleteMany: {}, create: segmentCreate } },
    });
    await logAudit({
      tenantId: auth.actor.tenantId,
      userId: auth.actor.id,
      entity: "User",
      entityId: userId,
      action: "UPDATE",
      summary: `${auth.target.lastName} ${auth.target.firstName} — ажлын хувиар, тусгай өдөр (${dateStr})`,
    });
  } else {
    const weekday = s(formData, "weekday");
    if (!isWeekday(weekday)) return { ok: false, message: "Гараг буруу." };
    await prisma.employeeWorkSchedule.upsert({
      where: { userId_weekday: { userId, weekday } },
      create: { userId, weekday, isWorking, segments: { create: segmentCreate } },
      update: { isWorking, segments: { deleteMany: {}, create: segmentCreate } },
    });
    await logAudit({
      tenantId: auth.actor.tenantId,
      userId: auth.actor.id,
      entity: "User",
      entityId: userId,
      action: "UPDATE",
      summary: `${auth.target.lastName} ${auth.target.firstName} — ажлын хувиар, ${weekday} гараг`,
    });
  }

  revalidatePath("/dashboard/employees/schedule");
  return { ok: true, message: "Хадгалагдлаа." };
}

/** Override мөрийг арилгаж, платформын анхны утга (үндсэн салбарын хуваарь) руу буцаана. */
export async function resetEmployeeShiftAction(formData: FormData): Promise<void> {
  const userId = s(formData, "userId");
  const scope = s(formData, "scope");
  if (!userId) return;
  let auth;
  try {
    auth = await authorize(userId);
  } catch {
    return;
  }

  if (scope === "date") {
    const dateStr = s(formData, "date");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return;
    const date = new Date(`${dateStr}T00:00:00.000Z`);
    await prisma.employeeScheduleException.deleteMany({ where: { userId, date } });
  } else {
    const weekday = s(formData, "weekday");
    if (!isWeekday(weekday)) return;
    await prisma.employeeWorkSchedule.deleteMany({ where: { userId, weekday } });
  }

  await logAudit({
    tenantId: auth.actor.tenantId,
    userId: auth.actor.id,
    entity: "User",
    entityId: userId,
    action: "DELETE",
    summary: `${auth.target.lastName} ${auth.target.firstName} — ажлын хувиарын override арилгав`,
  });

  revalidatePath("/dashboard/employees/schedule");
}
