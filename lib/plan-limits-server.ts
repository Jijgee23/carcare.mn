// Зөвхөн server-аас дуудах (Prisma-тай) runtime enforcement helper-ууд.
// Client component-аас ЭНЭ ФАЙЛЫГ ИМПОРТЛОХ ХЭРЭГГҮЙ — `lib/plan-limits.ts`
// дотроос тогтмол өгөгдлийг авна.

import type { Plan } from "@/app/generated/prisma/enums";
import {
  DEFAULT_PLAN_LIMITS,
  PLAN_LIMIT_META,
  type PlanLimitCode,
} from "./plan-limits";
import { prisma } from "./prisma";

const ALL_PLANS: Plan[] = ["FREE", "BUSINESS", "ENTERPRISE"];

/**
 * Тенантын идэвхтэй plan-аас хязгаарыг авна. PlanLimit-д бичлэг байхгүй бол
 * DEFAULT_PLAN_LIMITS-аас уншина.
 */
export async function getLimit(
  tenantId: string,
  code: PlanLimitCode,
): Promise<{ plan: Plan; intValue: number | null; boolValue: boolean | null }> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { plan: true },
  });
  if (!tenant) throw new Error("Тенант олдсонгүй.");

  const limit = await prisma.planLimit.findUnique({
    where: { plan_code: { plan: tenant.plan, code } },
    select: { intValue: true, boolValue: true },
  });
  if (limit) {
    return {
      plan: tenant.plan,
      intValue: limit.intValue,
      boolValue: limit.boolValue,
    };
  }
  const def = DEFAULT_PLAN_LIMITS[tenant.plan][code];
  return { plan: tenant.plan, intValue: def.intValue, boolValue: def.boolValue };
}

/**
 * COUNT хязгаарыг шалгана. Тоологч функцийг өгөх ёстой (одоо хэдэн ширхэг
 * байгааг буцаана).
 */
export async function enforceCountLimit(
  tenantId: string,
  code: PlanLimitCode,
  count: () => Promise<number>,
): Promise<{ allowed: boolean; current: number; limit: number | null; message?: string }> {
  const { plan, intValue } = await getLimit(tenantId, code);
  if (intValue == null) {
    return { allowed: true, current: 0, limit: null };
  }
  const current = await count();
  if (current >= intValue) {
    const meta = PLAN_LIMIT_META[code];
    return {
      allowed: false,
      current,
      limit: intValue,
      message: `${meta.label}: таны багц (${plan}) дээр ${intValue} хязгаартай. Одоо ${current}. Багцаа сайжруулна уу.`,
    };
  }
  return { allowed: true, current, limit: intValue };
}

/**
 * BOOLEAN хязгаарыг шалгана.
 */
export async function isFeatureEnabled(
  tenantId: string,
  code: PlanLimitCode,
): Promise<boolean> {
  const { boolValue } = await getLimit(tenantId, code);
  return boolValue === true;
}

/**
 * Тухайн BOOLEAN feature идэвхтэй байгаа бүх plan-уудыг буцаана (override +
 * default). Каталог гэх мэт олон тенантыг нэг where-ээр шүүхэд:
 *   where: { plan: { in: await plansWithFeature("online_booking") } }
 */
export async function plansWithFeature(code: PlanLimitCode): Promise<Plan[]> {
  const overrides = await prisma.planLimit.findMany({
    where: { code },
    select: { plan: true, boolValue: true },
  });
  const overrideMap = new Map(overrides.map((o) => [o.plan, o.boolValue]));
  return ALL_PLANS.filter((p) => {
    const ov = overrideMap.get(p);
    if (ov != null) return ov === true;
    return DEFAULT_PLAN_LIMITS[p][code].boolValue === true;
  });
}
