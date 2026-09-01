import { Prisma, prisma } from "@/lib/prisma";
import { sendPushToAccount, sendPushToSuperAdmin, sendPushToTokens, sendPushToUser } from "@/lib/push";
import { setBypassContext } from "@/lib/tenant-context";

// Мэдэгдэлийн төв — илгээгдсэн мэдэгдэл бүрийг DB-д хадгалж (Notification), дараа нь
// best-effort push илгээнэ. Ажилтан (User) ба Account хоёуланд нэг урсгалаар.
//
// Шинэ event нэмэхдээ: (1) NOTIFICATION_TYPES-д key нэмж, (2) NOTIFICATION_REGISTRY-д
// тохирох def бичнэ. TypeScript Record нь бүх key-г шаардах тул мартагдахгүй.

export const NOTIFICATION_TYPES = [
  "appointment_confirmed",
  "appointment_rejected",
  "appointment_reminder",
  "appointment_created",
  "appointment_cancelled",
  "appointment_expired",
  "subscription_expiring",
  "feedback_replied_staff",
  "feedback_replied_account",
  "tenant_created",
  "broadcast_staff",
  "broadcast_account",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export type NotificationRealm = "staff" | "account" | "system";

// Түүх жагсаалтад харуулах төрлийн нэр (badge).
export const NOTIFICATION_TYPE_LABEL: Record<NotificationType, string> = {
  appointment_confirmed: "Цаг баталгаажсан",
  appointment_rejected: "Цаг батлагдаагүй",
  appointment_reminder: "Цаг сануулга",
  appointment_created: "Шинэ цаг захиалга",
  appointment_cancelled: "Цаг цуцлагдсан",
  appointment_expired: "Цаг хугацаа хэтэрсэн",
  subscription_expiring: "Багц дуусах",
  feedback_replied_staff: "Санал хүсэлтэд хариу ирсэн",
  feedback_replied_account: "Санал хүсэлтэд хариу ирсэн",
  tenant_created: "Шинэ байгууллага бүртгүүлсэн",
  broadcast_staff: "Мэдэгдэл",
  broadcast_account: "Мэдэгдэл",
};

// Event тус бүрд дамжуулах түүхий утгууд (бүгд string — FCM data-д ч мөн).
export type NotificationInput = Record<string, string>;

type BuiltNotification = {
  title: string;
  body: string;
  data: Record<string, string>;
  // Идемпотент event-д давхар үүсэхээс сэргийлэх түлхүүр. Заавал биш.
  dedupeKey?: string;
};

type NotificationDef = {
  // Хүлээн авагчийн talбар: "staff" → User, "account" → Account.
  realm: NotificationRealm;
  build: (input: NotificationInput) => BuiltNotification;
  // Мэдэгдэл дээр дарахад шилжих холбоос (хадгалсан data-аас).
  href: (data: Record<string, string>) => string;
};

export const NOTIFICATION_REGISTRY: Record<NotificationType, NotificationDef> = {
  appointment_confirmed: {
    realm: "account",
    build: (i) => ({
      title: "Цаг баталгаажлаа",
      body: "Таны захиалсан цаг баталгаажлаа.",
      data: { type: "appointment_confirmed", appointmentId: i.appointmentId ?? "" },
    }),
    href: () => "/account",
  },
  appointment_rejected: {
    realm: "account",
    build: (i) => ({
      title: "Цаг батлагдсангүй",
      body: "Таны захиалсан цагийг байгууллага батлаагүй байна.",
      data: { type: "appointment_rejected", appointmentId: i.appointmentId ?? "" },
    }),
    href: () => "/account",
  },
  appointment_reminder: {
    realm: "account",
    build: (i) => ({
      title: "Цаг сануулга",
      body: i.body ?? "Таны товлосон цаг ойртож байна.",
      data: { type: "appointment_reminder", appointmentId: i.appointmentId ?? "" },
      // Cron давхар дуудагдсан ч нэг л мөр үүснэ.
      dedupeKey: i.appointmentId
        ? `appointment_reminder:${i.appointmentId}`
        : undefined,
    }),
    href: () => "/account",
  },
  appointment_created: {
    realm: "staff",
    build: (i) => ({
      title: "Шинэ цаг захиалга",
      body: i.body ?? "Шинэ цаг захиалгын хүсэлт ирлээ.",
      data: { type: "appointment_created", appointmentId: i.appointmentId ?? "" },
    }),
    href: () => "/dashboard/appointments",
  },
  appointment_cancelled: {
    realm: "staff",
    build: (i) => ({
      title: "Цаг цуцлагдсан",
      body: i.body ?? "Үйлчлүүлэгч захиалсан цагаа цуцаллаа.",
      data: { type: "appointment_cancelled", appointmentId: i.appointmentId ?? "" },
    }),
    href: () => "/dashboard/appointments",
  },
  appointment_expired: {
    realm: "account",
    build: (i) => ({
      title: "Цаг цуцлагдлаа",
      body: "Таны хүссэн цагт байгууллага хариу өгөөгүй тул захиалга автоматаар цуцлагдлаа.",
      data: { type: "appointment_expired", appointmentId: i.appointmentId ?? "" },
    }),
    href: () => "/account",
  },
  subscription_expiring: {
    realm: "staff",
    build: (i) => ({
      title: "Багцын хугацаа дуусаж байна",
      body: i.body ?? "Таны багцын хугацаа удахгүй дуусна. Сунгана уу.",
      data: {
        type: "subscription_expiring",
        subscriptionId: i.subscriptionId ?? "",
      },
    }),
    href: () => "/dashboard/settings/subscription",
  },
  feedback_replied_staff: {
    realm: "staff",
    build: (i) => ({
      title: "Санал хүсэлтэд хариу ирлээ",
      body: i.message ?? "",
      data: { type: "feedback_replied_staff", feedbackId: i.feedbackId ?? "" },
    }),
    href: () => "/dashboard",
  },
  feedback_replied_account: {
    realm: "account",
    build: (i) => ({
      title: "Санал хүсэлтэд хариу ирлээ",
      body: i.message ?? "",
      data: { type: "feedback_replied_account", feedbackId: i.feedbackId ?? "" },
    }),
    href: () => "/account",
  },
  tenant_created: {
    realm: "system",
    build: (i) => ({
      title: "Шинэ байгууллага бүртгүүлсэн",
      body: i.tenantName ? `"${i.tenantName}" бүртгүүллээ.` : "Шинэ байгууллага бүртгүүллээ.",
      data: { type: "tenant_created", tenantId: i.tenantId ?? "" },
    }),
    href: (d) => (d.tenantId ? `/system/tenants/${d.tenantId}` : "/system/tenants"),
  },
  // Систем админаас гар аргаар бичсэн мэдэгдэл — доорх 2 нь зөвхөн хүлээн
  // авагчийн realm-ээрээ ялгаатай, текст нь бүрэн admin-аас ирнэ (fixed
  // template биш) — broadcastNotification (lib/notifications.ts) л дуудна.
  broadcast_staff: {
    realm: "staff",
    build: (i) => ({
      title: i.title ?? "Мэдэгдэл",
      body: i.body ?? "",
      data: { type: "broadcast_staff" },
    }),
    href: () => "/dashboard",
  },
  broadcast_account: {
    realm: "account",
    build: (i) => ({
      title: i.title ?? "Мэдэгдэл",
      body: i.body ?? "",
      data: { type: "broadcast_account" },
    }),
    href: () => "/account",
  },
};

// Клиент рүү дамжуулах хялбаршуулсан хэлбэр (server action-ууд буцаана).
export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  href: string;
  read: boolean;
  createdAt: string; // ISO
};

export function toNotificationItem(n: {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Prisma.JsonValue | null;
  readAt: Date | null;
  createdAt: Date;
}): NotificationItem {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    href: notificationHref(n.type, n.data),
    read: n.readAt != null,
    createdAt: n.createdAt.toISOString(),
  };
}

/** Мэдэгдэл дээр дарахад шилжих холбоос — type болон хадгалсан data-аас. */
export function notificationHref(
  type: string,
  data: Prisma.JsonValue | null,
): string {
  const def = NOTIFICATION_REGISTRY[type as NotificationType];
  if (!def) return "#";
  const obj =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, string>)
      : {};
  return def.href(obj);
}

type Recipient =
  | { userId: string }
  | { accountId: string }
  | { superAdminId: string };

/**
 * Нэг хүлээн авагчид мэдэгдэл үүсгэнэ — эхлээд DB-д хадгална (заавал), дараа нь
 * push илгээнэ (best-effort, алдаа гарвал залгисан урсгалыг таслахгүй).
 * dedupeKey давхцвал чимээгүй алгасна (мэдэгдэл/push давхар үүсэхгүй).
 */
export async function createNotification(args: {
  type: NotificationType;
  recipient: Recipient;
  input: NotificationInput;
  tenantId?: string | null;
}): Promise<void> {
  const def = NOTIFICATION_REGISTRY[args.type];
  const built = def.build(args.input);

  try {
    await prisma.notification.create({
      data: {
        type: args.type,
        title: built.title,
        body: built.body,
        data: built.data,
        dedupeKey: built.dedupeKey ?? null,
        tenantId: args.tenantId ?? null,
        ...("userId" in args.recipient
          ? { userId: args.recipient.userId }
          : "accountId" in args.recipient
            ? { accountId: args.recipient.accountId }
            : { superAdminId: args.recipient.superAdminId }),
      },
    });
  } catch (e) {
    // dedupeKey давхцал — өмнө нь илгээгдсэн тул дахин push хийхгүй.
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return;
    }
    throw e;
  }

  const payload = { title: built.title, body: built.body, data: built.data };
  try {
    if ("userId" in args.recipient) {
      await sendPushToUser(args.recipient.userId, payload);
    } else if ("accountId" in args.recipient) {
      await sendPushToAccount(args.recipient.accountId, payload);
    } else {
      await sendPushToSuperAdmin(args.recipient.superAdminId, payload);
    }
  } catch (err) {
    console.warn(`[notify] push (${args.type}):`, err);
  }
}

/**
 * Тенант/салбарт холбогдох ажилтны мэдэгдэл хүлээн авах хүрээ.
 * Эзэн (isOwner) + `appointments.view` эрхтэй идэвхтэй ажилтнууд. Салбарт
 * оноогдсон ажилтан зөвхөн өөрийн салбарын, оноогдоогүй (branchId=null) ба эзэн
 * бүх салбарын мэдэгдэл авна. (lib/auth/roles.ts ORDER_ASSIGNABLE_WHERE загвар.)
 */
export function staffRecipientWhere(
  tenantId: string,
  branchId: string,
): Prisma.UserWhereInput {
  return {
    tenantId,
    isActive: true,
    OR: [
      { isOwner: true },
      {
        role: { permissions: { has: "appointments.view" } },
        OR: [{ branchId: null }, { branchId }],
      },
    ],
  };
}

/**
 * Тенант/салбарын холбогдох ажилтнууд бүгдэд нэг мэдэгдэл fan-out хийнэ.
 * DB-д createMany-ээр бичээд, тус бүрд best-effort push илгээнэ.
 */
export async function notifyStaff(args: {
  type: NotificationType;
  tenantId: string;
  branchId: string;
  input: NotificationInput;
}): Promise<void> {
  const recipients = await prisma.user.findMany({
    where: staffRecipientWhere(args.tenantId, args.branchId),
    select: { id: true },
  });
  if (recipients.length === 0) return;

  const def = NOTIFICATION_REGISTRY[args.type];
  const built = def.build(args.input);

  await prisma.notification.createMany({
    data: recipients.map((r) => ({
      type: args.type,
      title: built.title,
      body: built.body,
      data: built.data,
      tenantId: args.tenantId,
      userId: r.id,
    })),
  });

  const payload = { title: built.title, body: built.body, data: built.data };
  await Promise.all(
    recipients.map((r) =>
      sendPushToUser(r.id, payload).catch((err) =>
        console.warn(`[notify] staff push (${args.type}):`, err),
      ),
    ),
  );
}

/**
 * Бүх систем админд (SuperAdmin) нэг мэдэгдэл fan-out хийнэ. `SuperAdmin`-д
 * тенант/эрх/идэвх зэрэг шүүх багана байхгүй тул `staffRecipientWhere`-ийн
 * адил шүүлт алга — бүх мөр хүлээн авна. Cross-tenant (bypass) query.
 */
export async function notifySuperAdmins(args: {
  type: NotificationType;
  input: NotificationInput;
}): Promise<void> {
  setBypassContext();
  const recipients = await prisma.superAdmin.findMany({ select: { id: true } });
  if (recipients.length === 0) return;

  const def = NOTIFICATION_REGISTRY[args.type];
  const built = def.build(args.input);

  await prisma.notification.createMany({
    data: recipients.map((r) => ({
      type: args.type,
      title: built.title,
      body: built.body,
      data: built.data,
      superAdminId: r.id,
    })),
  });

  const payload = { title: built.title, body: built.body, data: built.data };
  await Promise.all(
    recipients.map((r) =>
      sendPushToSuperAdmin(r.id, payload).catch((err) =>
        console.warn(`[notify] superadmin push (${args.type}):`, err),
      ),
    ),
  );
}

const BROADCAST_BATCH_SIZE = 500;

/**
 * Систем админаас бүх ажилтан (User) болон/эсвэл бүх хэрэглэгч (Account) руу
 * гар аргаар мэдэгдэл илгээнэ ("Мэдэгдэл илгээх" хуудас). Cross-tenant тул
 * bypass context — `id`-аар cursor-pagination хийж багц (500)-аар боловсруулна,
 * бүх мөрийг нэг дор санах ойд ачаалахгүй.
 */
export async function broadcastNotification(args: {
  title: string;
  body: string;
  targets: ("staff" | "account")[];
}): Promise<{ staffNotified: number; accountsNotified: number }> {
  setBypassContext();

  const built = { title: args.title, body: args.body, data: {} as Record<string, string> };
  let staffNotified = 0;
  let accountsNotified = 0;

  if (args.targets.includes("staff")) {
    staffNotified = await broadcastToRealm("staff", "broadcast_staff", {
      ...built,
      data: { type: "broadcast_staff" },
    });
  }
  if (args.targets.includes("account")) {
    accountsNotified = await broadcastToRealm("account", "broadcast_account", {
      ...built,
      data: { type: "broadcast_account" },
    });
  }

  return { staffNotified, accountsNotified };
}

async function broadcastToRealm(
  realm: "staff" | "account",
  type: "broadcast_staff" | "broadcast_account",
  built: BuiltNotification,
): Promise<number> {
  const ownerField = realm === "staff" ? "userId" : "accountId";
  let cursor: string | undefined;
  let total = 0;

  for (;;) {
    const rows =
      realm === "staff"
        ? await prisma.user.findMany({
            select: { id: true },
            take: BROADCAST_BATCH_SIZE,
            orderBy: { id: "asc" },
            ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
          })
        : await prisma.account.findMany({
            select: { id: true },
            take: BROADCAST_BATCH_SIZE,
            orderBy: { id: "asc" },
            ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
          });
    if (rows.length === 0) break;

    await prisma.notification.createMany({
      data: rows.map((r) => ({
        type,
        title: built.title,
        body: built.body,
        data: built.data,
        [ownerField]: r.id,
      })),
    });

    const ids = rows.map((r) => r.id);
    const tokens = await prisma.device.findMany({
      where: { [ownerField]: { in: ids }, firebaseToken: { not: null } },
      select: { firebaseToken: true },
    });
    try {
      await sendPushToTokens(
        tokens.map((t) => t.firebaseToken).filter((t): t is string => Boolean(t)),
        { title: built.title, body: built.body, data: built.data },
      );
    } catch (err) {
      console.warn(`[notify] broadcast push (${type}):`, err);
    }

    total += rows.length;
    cursor = ids[ids.length - 1];
    if (rows.length < BROADCAST_BATCH_SIZE) break;
  }

  return total;
}
