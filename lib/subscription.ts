import type {
  BillingPeriod,
  Plan,
  Subscription,
  SubscriptionStatus,
} from "@/app/generated/prisma/client";

export const BILLING_PERIODS: BillingPeriod[] = ["MONTH", "QUARTER", "YEAR"];

export const BILLING_PERIOD_LABEL: Record<BillingPeriod, string> = {
  MONTH: "Сар",
  QUARTER: "Улирал",
  YEAR: "Жил",
};

export const BILLING_PERIOD_MONTHS: Record<BillingPeriod, number> = {
  MONTH: 1,
  QUARTER: 3,
  YEAR: 12,
};

export function periodEndDate(
  start: Date,
  period: BillingPeriod,
): Date {
  const months = BILLING_PERIOD_MONTHS[period];
  const end = new Date(start);
  end.setMonth(end.getMonth() + months);
  return end;
}

export const TRIAL_DAYS = 14;

// Идэвхтэй subscription дуусахад ийм өдрөөс цөөн үлдвэл "удахгүй дуусна"
// сэрэмжлүүлэг харуулна.
export const SUBSCRIPTION_WARN_DAYS = 7;

// Багц дууссан үед mutation (үүсгэх/засах/устгах) хийх гэж оролдвол буцаах мессеж.
export const SUBSCRIPTION_LOCKED_MESSAGE =
  "Таны багцын хугацаа дууссан байна. Үргэлжлүүлэхийн тулд багцаа сунгаж төлбөрөө төлнө үү.";

export const SUBSCRIPTION_STATUS_LABEL: Record<SubscriptionStatus, string> = {
  TRIAL: "Туршилт",
  ACTIVE: "Идэвхтэй",
  EXPIRED: "Дууссан",
  CANCELLED: "Цуцлагдсан",
};

export const SUBSCRIPTION_STATUS_BADGE: Record<SubscriptionStatus, string> = {
  TRIAL: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
  ACTIVE: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
  EXPIRED: "bg-red-500/15 text-red-300 border border-red-500/30",
  CANCELLED: "bg-white/10 text-white/50 border border-white/15",
};

export const PLAN_LABEL: Record<Plan, string> = {
  FREE: "FREE",
  BUSINESS: "BUSINESS",
  ENTERPRISE: "ENTERPRISE",
};

export type ActiveSubscriptionInfo = {
  subscription: Pick<
    Subscription,
    "id" | "plan" | "status" | "startsAt" | "endsAt"
  >;
  isTrial: boolean;
  daysLeft: number; // 0 эсвэл сөрөг — дууссан
  expiresAt: Date | null;
};

export function trialEndDate(startsAt: Date = new Date()): Date {
  const end = new Date(startsAt);
  end.setDate(end.getDate() + TRIAL_DAYS);
  return end;
}

/**
 * Тенант идэвхтэй subscription байгаа эсэхийг тогтооно. Trial хугацаа дууссан
 * subscription-ийг "expired" гэж үзнэ.
 */
export function resolveActiveSubscription(
  subs: Pick<Subscription, "id" | "plan" | "status" | "startsAt" | "endsAt">[],
  now: Date = new Date(),
): ActiveSubscriptionInfo | null {
  // Хамгийн сүүлд эхэлсэн идэвхтэй (TRIAL/ACTIVE) subscription-г сонгоно
  const candidate = [...subs]
    .filter(
      (s) =>
        (s.status === "TRIAL" || s.status === "ACTIVE") &&
        s.startsAt.getTime() <= now.getTime(),
    )
    .sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime())[0];
  if (!candidate) return null;

  const expiresAt = candidate.endsAt ?? null;
  const daysLeft = expiresAt
    ? Math.ceil((expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
    : Number.POSITIVE_INFINITY;

  return {
    subscription: candidate,
    isTrial: candidate.status === "TRIAL",
    daysLeft: Number.isFinite(daysLeft) ? daysLeft : Number.POSITIVE_INFINITY,
    expiresAt,
  };
}

export function formatDaysLeft(daysLeft: number): string {
  if (daysLeft <= 0) return "өнөөдөр дуусна";
  if (daysLeft === 1) return "маргааш дуусна";
  return `${daysLeft} хоног үлдсэн`;
}
