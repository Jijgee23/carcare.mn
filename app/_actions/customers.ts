"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@/app/generated/prisma/client";
import { logAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { canCreate, canDelete, canEdit, hasPermission } from "@/lib/auth/roles";
import { assertActiveSubscription } from "@/lib/subscription-server";
import { isValidPhone, normalizePhone } from "@/lib/phone";
import { broadcastTenantPromo } from "@/lib/notifications";
import { PLAN_LIMIT_CODES } from "@/lib/plan-limits";
import { enforceCountLimit } from "@/lib/plan-limits-server";
import { prisma } from "@/lib/prisma";

export type CustomerActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
} | null;

export type CustomerNotifyActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
} | null;

function s(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

async function authorize(action: "create" | "edit" | "delete") {
  const user = await requireUser();
  const ok =
    action === "create"
      ? canCreate(user, "customers")
      : action === "edit"
        ? canEdit(user, "customers")
        : canDelete(user, "customers");
  if (!ok) {
    throw new Error("Танд үйлчлүүлэгчид энэ үйлдэл хийх эрх байхгүй.");
  }
  await assertActiveSubscription(user.tenantId);
  return user;
}

function validate(fd: FormData) {
  const fullName = s(fd, "fullName");
  const phone = s(fd, "phone");
  const email = s(fd, "email");
  const note = s(fd, "note");
  const errors: Record<string, string> = {};

  // Зөвхөн утас заавал. Овог нэр заавал биш — хоосон бол "" хадгална.
  if (!phone) errors.phone = "Утасны дугаар оруулна уу.";
  else if (!isValidPhone(phone))
    errors.phone = "Утасны дугаар 8 оронтой тоо байх ёстой.";
  if (email && !isEmail(email)) errors.email = "Имэйл хаяг буруу.";

  return {
    data: {
      fullName,
      // Канон 8 оронтой хэлбэрт хадгална (Account-той утсаар холбогддог).
      phone: normalizePhone(phone) ?? phone,
      email: email || null,
      note: note || null,
    },
    errors,
  };
}

export async function createCustomerAction(
  _prev: CustomerActionState,
  formData: FormData,
): Promise<CustomerActionState> {
  let user;
  try {
    user = await authorize("create");
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Алдаа" };
  }

  const { data, errors } = validate(formData);
  if (Object.keys(errors).length > 0) {
    return { ok: false, fieldErrors: errors };
  }

  // Багцын хязгаар: max_customers
  const limit = await enforceCountLimit(
    user.tenantId,
    PLAN_LIMIT_CODES.MAX_CUSTOMERS,
    () => prisma.customer.count({ where: { tenantId: user.tenantId } }),
  );
  if (!limit.allowed) {
    return { ok: false, message: limit.message };
  }

  // Утасны дугаараар онлайн Account олж, байвал холбоно — quick-create.ts-ийн
  // adил шалтгаанаар (2026-09-08: ажилтны шууд бүртгэсэн үйлчлүүлэгч
  // харилцагчийн апп/веб-д хожим захиалгаа харахгүй байсан).
  const account = await prisma.account.findUnique({
    where: { phone: data.phone },
    select: { id: true },
  });

  if (account) {
    const existingForAccount = await prisma.customer.findUnique({
      where: { tenantId_accountId: { tenantId: user.tenantId, accountId: account.id } },
      select: { id: true },
    });
    if (existingForAccount) {
      redirect(`/dashboard/customers/${existingForAccount.id}`);
    }
  }

  let created;
  try {
    const unclaimed = account
      ? await prisma.customer.findFirst({
          where: { tenantId: user.tenantId, phone: data.phone, accountId: null },
          select: { id: true },
        })
      : null;

    created = unclaimed
      ? await prisma.customer.update({
          where: { id: unclaimed.id },
          data: { ...data, fullName: data.fullName || undefined, accountId: account!.id },
          select: { id: true },
        })
      : await prisma.customer.create({
          data: { ...data, tenantId: user.tenantId, accountId: account?.id ?? null },
          select: { id: true },
        });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return {
        ok: false,
        fieldErrors: { phone: "Энэ утасны дугаартай үйлчлүүлэгч аль хэдийн бүртгэлтэй байна." },
      };
    }
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Үүсгэх явцад алдаа гарлаа.",
    };
  }

  await logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    entity: "Customer",
    entityId: created.id,
    action: "CREATE",
    summary: data.fullName || data.phone,
    after: data,
  });

  revalidatePath("/dashboard/customers");
  revalidatePath("/dashboard");
  redirect(`/dashboard/customers/${created.id}`);
}

export async function updateCustomerAction(
  id: string,
  _prev: CustomerActionState,
  formData: FormData,
): Promise<CustomerActionState> {
  let user;
  try {
    user = await authorize("edit");
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Алдаа" };
  }

  const { data, errors } = validate(formData);
  if (Object.keys(errors).length > 0) {
    return { ok: false, fieldErrors: errors };
  }

  try {
    const updated = await prisma.customer.updateMany({
      where: { id, tenantId: user.tenantId },
      data,
    });
    if (updated.count === 0) {
      return { ok: false, message: "Үйлчлүүлэгч олдсонгүй." };
    }
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return {
        ok: false,
        fieldErrors: { phone: "Энэ утасны дугаартай үйлчлүүлэгч аль хэдийн бүртгэлтэй байна." },
      };
    }
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Шинэчлэх явцад алдаа гарлаа.",
    };
  }

  await logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    entity: "Customer",
    entityId: id,
    action: "UPDATE",
    summary: data.fullName || data.phone,
    after: data,
  });

  revalidatePath("/dashboard/customers");
  revalidatePath(`/dashboard/customers/${id}`);
  redirect("/dashboard/customers");
}

export async function deleteCustomerAction(formData: FormData): Promise<void> {
  const user = await authorize("delete");
  const id = s(formData, "id");
  if (!id) return;

  const target = await prisma.customer.findFirst({
    where: { id, tenantId: user.tenantId },
    select: { fullName: true },
  });

  try {
    await prisma.customer.delete({
      where: { id, tenantId: user.tenantId },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
      throw new Error(
        "Энэ үйлчлүүлэгчтэй холбоотой засварын хуудас байгаа тул устгах боломжгүй.",
      );
    }
    throw e;
  }

  await logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    entity: "Customer",
    entityId: id,
    action: "DELETE",
    summary: target?.fullName,
  });

  revalidatePath("/dashboard/customers");
  revalidatePath("/dashboard");
}

// --- NOTIFY (broadcast to own customers) -----------------------------------

/**
 * Тухайн тенантын онлайн бүртгэлтэй (Account холбогдсон) бүх үйлчлүүлэгчид
 * зар/урамслал (жишээ нь хямдрал) push мэдэгдэл илгээнэ. `customers.notify`
 * тусгай эрхтэй хэрэглэгч л ашиглана — `customers.view`/`edit`-ээс тусдаа
 * (харах: lib/auth/permissions.ts тайлбар).
 */
export async function sendCustomerBroadcastAction(
  _prev: CustomerNotifyActionState,
  formData: FormData,
): Promise<CustomerNotifyActionState> {
  const user = await requireUser();
  if (!hasPermission(user, "customers.notify")) {
    return { ok: false, message: "Танд үйлчлүүлэгчид зар илгээх эрх байхгүй." };
  }
  await assertActiveSubscription(user.tenantId);

  const title = s(formData, "title");
  const body = s(formData, "body");

  const fieldErrors: Record<string, string> = {};
  if (!title) fieldErrors.title = "Гарчиг оруулна уу.";
  if (!body) fieldErrors.body = "Агуулга оруулна уу.";
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  // Багцын хязгаар: daily_customer_notifications — "илгээх" ДАРАЛТЫН тоог
  // хязгаарлана (хүлээн авагчийн тоог биш), тул тоологч нь тухайн өдөр бичигдсэн
  // AuditLog-ийн "Notification" мөрүүд (send бүрт 1 мөр) байна.
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const dailyLimit = await enforceCountLimit(
    user.tenantId,
    PLAN_LIMIT_CODES.DAILY_CUSTOMER_NOTIFICATIONS,
    () =>
      prisma.auditLog.count({
        where: { tenantId: user.tenantId, entity: "Notification", createdAt: { gte: todayStart } },
      }),
  );
  if (!dailyLimit.allowed) {
    return { ok: false, message: dailyLimit.message };
  }

  const notified = await broadcastTenantPromo({ tenantId: user.tenantId, title, body });

  await logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    entity: "Notification",
    entityId: user.tenantId,
    action: "OTHER",
    summary: `Үйлчлүүлэгчид зар илгээв: "${title}" · ${notified.toLocaleString("mn-MN")} хүлээн авагч`,
  });

  if (notified === 0) {
    return {
      ok: true,
      message: "Илгээгдлээ, гэхдээ онлайн бүртгэлтэй (апп/веб холбогдсон) үйлчлүүлэгч алга байна.",
    };
  }
  return {
    ok: true,
    message: `Илгээгдлээ — ${notified.toLocaleString("mn-MN")} үйлчлүүлэгчид хүрлээ.`,
  };
}
