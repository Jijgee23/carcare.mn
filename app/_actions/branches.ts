"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@/app/generated/prisma/client";
import { logAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { canCreate, canDelete, canEdit } from "@/lib/auth/roles";
import { assertActiveSubscription } from "@/lib/subscription-server";
import {
  ALL_WEEKDAYS,
  DEFAULT_OPEN_DAYS,
  type Weekday,
  isValidTime,
  isWeekday,
} from "@/lib/branches";
import { isValidPhone, normalizePhone } from "@/lib/phone";
import { PLAN_LIMIT_CODES } from "@/lib/plan-limits";
import { enforceCountLimit } from "@/lib/plan-limits-server";
import { prisma } from "@/lib/prisma";

export type BranchActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
} | null;

function s(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

async function authorize(action: "create" | "edit" | "delete") {
  const user = await requireUser();
  const ok =
    action === "create"
      ? canCreate(user, "branches")
      : action === "edit"
        ? canEdit(user, "branches")
        : canDelete(user, "branches");
  if (!ok) {
    throw new Error("Танд салбарт энэ үйлдэл хийх эрх байхгүй.");
  }
  await assertActiveSubscription(user.tenantId);
  return user;
}

type Parsed = {
  name: string;
  phone: string | null;
  city: string | null;
  district: string | null;
  khoroo: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  openTime: string | null;
  closeTime: string | null;
  slotMinutes: number | null;
  slotCapacity: number | null;
  openDays: Weekday[];
  isPrimary: boolean;
  errors: Record<string, string>;
};

function parseFloatOrNull(v: string): number | null {
  if (!v) return null;
  const n = Number.parseFloat(v.replace(",", "."));
  return Number.isFinite(n) ? n : Number.NaN;
}

function validate(fd: FormData): Parsed {
  const name = s(fd, "name");
  const phone = s(fd, "phone");
  const city = s(fd, "city");
  const district = s(fd, "district");
  const khoroo = s(fd, "khoroo");
  const address = s(fd, "address");
  const latRaw = s(fd, "latitude");
  const lngRaw = s(fd, "longitude");
  const openTimeRaw = s(fd, "openTime");
  const closeTimeRaw = s(fd, "closeTime");

  const errors: Record<string, string> = {};

  if (!name) errors.name = "Салбарын нэрээ оруулна уу.";
  // Утас заавал биш — оруулсан бол 8 оронтой зөв байх ёстой.
  if (phone && !isValidPhone(phone))
    errors.phone = "Утасны дугаар 8 оронтой тоо байх ёстой.";

  // Координат
  let latitude: number | null = null;
  if (latRaw) {
    const n = parseFloatOrNull(latRaw);
    if (n === null || Number.isNaN(n) || n < -90 || n > 90) {
      errors.latitude = "Latitude -90 ба 90-ийн хооронд байна.";
    } else {
      latitude = n;
    }
  }
  let longitude: number | null = null;
  if (lngRaw) {
    const n = parseFloatOrNull(lngRaw);
    if (n === null || Number.isNaN(n) || n < -180 || n > 180) {
      errors.longitude = "Longitude -180 ба 180-ийн хооронд байна.";
    } else {
      longitude = n;
    }
  }

  // Цаг
  const openTime = openTimeRaw || null;
  const closeTime = closeTimeRaw || null;
  if (openTime && !isValidTime(openTime))
    errors.openTime = "Цагийн форматыг HH:MM (24 цаг) хэлбэрээр оруулна уу.";
  if (closeTime && !isValidTime(closeTime))
    errors.closeTime = "Цагийн форматыг HH:MM (24 цаг) хэлбэрээр оруулна уу.";

  // Онлайн цаг захиалгын slot тохиргоо (заавал биш)
  const slotMinutesRaw = s(fd, "slotMinutes");
  const slotCapacityRaw = s(fd, "slotCapacity");
  let slotMinutes: number | null = null;
  if (slotMinutesRaw) {
    const n = Number.parseInt(slotMinutesRaw, 10);
    if (!Number.isFinite(n) || n < 5 || n > 480)
      errors.slotMinutes = "5-480 минут хооронд байна.";
    else slotMinutes = n;
  }
  let slotCapacity: number | null = null;
  if (slotCapacityRaw) {
    const n = Number.parseInt(slotCapacityRaw, 10);
    if (!Number.isFinite(n) || n < 1 || n > 100)
      errors.slotCapacity = "1-100 хооронд байна.";
    else slotCapacity = n;
  }

  // Ажиллах өдрүүд (workDays нь олон утгатай checkbox-уудаар Weekday enum-ээр ирнэ)
  const rawDays = fd.getAll("workDays");
  const openDaysSet = new Set<Weekday>();
  for (const d of rawDays) {
    if (isWeekday(d)) openDaysSet.add(d);
  }
  const openDays =
    openDaysSet.size > 0 ? Array.from(openDaysSet) : DEFAULT_OPEN_DAYS.slice();

  return {
    name,
    phone: phone ? (normalizePhone(phone) ?? phone) : null,
    city: city || null,
    district: district || null,
    khoroo: khoroo || null,
    address: address || null,
    latitude,
    longitude,
    openTime,
    closeTime,
    slotMinutes,
    slotCapacity,
    openDays,
    isPrimary: fd.get("isPrimary") === "on",
    errors,
  };
}

function toBranchData(p: Parsed) {
  return {
    name: p.name,
    phone: p.phone,
    city: p.city,
    district: p.district,
    khoroo: p.khoroo,
    address: p.address,
    latitude: p.latitude,
    longitude: p.longitude,
    openTime: p.openTime,
    closeTime: p.closeTime,
    slotMinutes: p.slotMinutes,
    slotCapacity: p.slotCapacity,
    isPrimary: p.isPrimary,
  };
}

function scheduleCreateMany(branchId: string, openDays: Weekday[]) {
  const open = new Set(openDays);
  return ALL_WEEKDAYS.map((wd) => ({
    branchId,
    weekday: wd,
    isOpen: open.has(wd),
  }));
}

export async function createBranchAction(
  _prev: BranchActionState,
  formData: FormData,
): Promise<BranchActionState> {
  let user;
  try {
    user = await authorize("create");
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Алдаа" };
  }

  const p = validate(formData);
  if (Object.keys(p.errors).length > 0) {
    return { ok: false, fieldErrors: p.errors };
  }

  // Багцын хязгаар: max_branches
  const limit = await enforceCountLimit(
    user.tenantId,
    PLAN_LIMIT_CODES.MAX_BRANCHES,
    () => prisma.branch.count({ where: { tenantId: user.tenantId } }),
  );
  if (!limit.allowed) {
    return { ok: false, message: limit.message };
  }

  let createdId: string | null = null;
  try {
    await prisma.$transaction(async (tx) => {
      // Хэрэв isPrimary=true бол бусад салбаруудыг false болгоно
      if (p.isPrimary) {
        await tx.branch.updateMany({
          where: { tenantId: user.tenantId, isPrimary: true },
          data: { isPrimary: false },
        });
      }
      // Тенант дотор анхных нь автоматаар үндсэн салбар болно
      const existing = await tx.branch.count({
        where: { tenantId: user.tenantId },
      });
      const isPrimary = p.isPrimary || existing === 0;
      const branch = await tx.branch.create({
        data: { ...toBranchData(p), isPrimary, tenantId: user.tenantId },
        select: { id: true },
      });
      createdId = branch.id;
      await tx.branchSchedule.createMany({
        data: scheduleCreateMany(branch.id, p.openDays),
      });
    });
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Үүсгэх явцад алдаа гарлаа.",
    };
  }

  if (createdId) {
    await logAudit({
      tenantId: user.tenantId,
      userId: user.id,
      entity: "Branch",
      entityId: createdId,
      action: "CREATE",
      summary: p.name,
      after: toBranchData(p),
    });
  }

  revalidatePath("/dashboard/branches");
  revalidatePath("/dashboard");
  redirect("/dashboard/branches");
}

export async function updateBranchAction(
  id: string,
  _prev: BranchActionState,
  formData: FormData,
): Promise<BranchActionState> {
  let user;
  try {
    user = await authorize("edit");
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Алдаа" };
  }

  const p = validate(formData);
  if (Object.keys(p.errors).length > 0) {
    return { ok: false, fieldErrors: p.errors };
  }

  try {
    const updatedCount = await prisma.$transaction(async (tx) => {
      const current = await tx.branch.findFirst({
        where: { id, tenantId: user.tenantId },
        select: { isPrimary: true },
      });
      if (!current) return 0;

      // Үндсэнийг нь өөр болгох гэж байвал зөвшөөрөхгүй
      // (үндсэн салбарыг хасах нь тенантэд нэгээс ч бага үлдээх эрсдэлтэй)
      if (current.isPrimary && !p.isPrimary) {
        throw new Error(
          "Үндсэн салбарыг идэвхгүй болгохын тулд эхлээд өөр салбарыг үндсэн болгоно уу.",
        );
      }

      if (p.isPrimary && !current.isPrimary) {
        await tx.branch.updateMany({
          where: { tenantId: user.tenantId, isPrimary: true },
          data: { isPrimary: false },
        });
      }

      const r = await tx.branch.updateMany({
        where: { id, tenantId: user.tenantId },
        data: toBranchData(p),
      });
      if (r.count > 0) {
        const openSet = new Set<Weekday>(p.openDays);
        for (const wd of ALL_WEEKDAYS) {
          await tx.branchSchedule.upsert({
            where: { branchId_weekday: { branchId: id, weekday: wd } },
            create: { branchId: id, weekday: wd, isOpen: openSet.has(wd) },
            update: { isOpen: openSet.has(wd) },
          });
        }
      }
      return r.count;
    });

    if (updatedCount === 0) {
      return { ok: false, message: "Салбар олдсонгүй." };
    }
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Шинэчлэх явцад алдаа гарлаа.",
    };
  }

  await logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    entity: "Branch",
    entityId: id,
    action: "UPDATE",
    summary: p.name,
    after: toBranchData(p),
  });

  revalidatePath("/dashboard/branches");
  revalidatePath(`/dashboard/branches/${id}`);
  redirect("/dashboard/branches");
}

export async function deleteBranchAction(formData: FormData): Promise<void> {
  const user = await authorize("delete");
  const id = s(formData, "id");
  if (!id) return;

  const target = await prisma.branch.findFirst({
    where: { id, tenantId: user.tenantId },
    select: { isPrimary: true, name: true },
  });
  if (!target) return;
  if (target.isPrimary) {
    throw new Error(
      "Үндсэн салбарыг устгах боломжгүй. Эхлээд өөр салбарыг үндсэн болгоно уу.",
    );
  }

  try {
    await prisma.branch.delete({
      where: { id, tenantId: user.tenantId },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
      throw new Error(
        "Энэ салбар захиалга/ажилтантай холбогдсон тул устгах боломжгүй.",
      );
    }
    throw e;
  }

  await logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    entity: "Branch",
    entityId: id,
    action: "DELETE",
    summary: target.name,
  });

  revalidatePath("/dashboard/branches");
  revalidatePath("/dashboard");
}
