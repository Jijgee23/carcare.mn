import { normalizePhone } from "@/lib/phone";
import type { PrismaTransactionClient } from "@/lib/prisma";

export const APPOINTMENT_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "REJECTED",
  "CANCELLED",
  "NO_SHOW",
] as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const APPOINTMENT_STATUS_LABEL: Record<AppointmentStatus, string> = {
  PENDING: "Хүлээгдэж буй",
  CONFIRMED: "Баталгаажсан",
  REJECTED: "Татгалзсан",
  CANCELLED: "Цуцлагдсан",
  NO_SHOW: "Ирээгүй",
};

export const APPOINTMENT_STATUS_BADGE: Record<AppointmentStatus, string> = {
  PENDING:
    "bg-amber-500/15 text-amber-400 border border-amber-500/25 light:bg-amber-100 light:border-amber-300 light:text-amber-700",
  CONFIRMED:
    "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 light:bg-emerald-100 light:border-emerald-300 light:text-emerald-700",
  REJECTED:
    "bg-red-500/10 text-red-400 border border-red-500/20 light:bg-red-100 light:border-red-300 light:text-red-700",
  CANCELLED:
    "bg-zinc-500/15 text-zinc-300 border border-zinc-500/25 light:bg-zinc-100 light:border-zinc-300 light:text-zinc-600",
  NO_SHOW:
    "bg-purple-500/15 text-purple-300 border border-purple-500/25 light:bg-purple-100 light:border-purple-300 light:text-purple-700",
};

// Ажилтны хийж болох төлвийн шилжилт.
export const APPOINTMENT_STATUS_TRANSITIONS: Record<
  AppointmentStatus,
  AppointmentStatus[]
> = {
  PENDING: ["CONFIRMED", "REJECTED"],
  CONFIRMED: ["NO_SHOW", "CANCELLED"],
  REJECTED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

type Client = PrismaTransactionClient;

/**
 * Гүүр — global Account-ийг тенантын дотоод Customer-той утсаар нь холбоно.
 *
 *  1) Аль хэдийн холбогдсон Customer байвал түүнийг буцаана.
 *  2) Эс бөгөөс утсаар тааруулж (холбогдоогүй Customer) олвол холбож буцаана.
 *  3) Олдохгүй бол шинэ Customer үүсгэнэ.
 *
 * $transaction client дамжуулж дуудах нь зөв — Customer resolve + appointment
 * шинэчлэлт нэг атомт үйлдэл болно.
 */
export async function resolveCustomerForAccount(
  client: Client,
  tenantId: string,
  account: {
    id: string;
    phone: string;
    name: string | null;
    email: string | null;
  },
): Promise<string> {
  // 1) Аль хэдийн холбогдсон
  const linked = await client.customer.findUnique({
    where: { tenantId_accountId: { tenantId, accountId: account.id } },
    select: { id: true },
  });
  if (linked) return linked.id;

  const phone = normalizePhone(account.phone) ?? account.phone;

  // 2) Утсаар тааруулж холбоно (холбогдоогүй Customer). Хадгалагдсан дугаар нь
  // өөр форматтай (ж: +976...) байж болзошгүй тул endsWith-ээр ч шалгана.
  const candidate = await client.customer.findFirst({
    where: {
      tenantId,
      accountId: null,
      OR: [{ phone }, { phone: { endsWith: phone } }],
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (candidate) {
    await client.customer.update({
      where: { id: candidate.id },
      data: { accountId: account.id },
    });
    return candidate.id;
  }

  // 3) Шинээр үүсгэнэ
  const created = await client.customer.create({
    data: {
      tenantId,
      accountId: account.id,
      // Нэргүй бол placeholder бичихгүй — хоосон үлдээж, дэлгэцэнд утсаар нь
      // харуулна ([[customerLabel]]).
      fullName: account.name?.trim() || "",
      phone,
      email: account.email,
    },
    select: { id: true },
  });
  return created.id;
}

