// Client- ба server-аас хоёулангаас нь ашиглах ЦЭВЭР тогтмол/түр (no prisma).
// Runtime enforcement helper-уудыг `lib/plan-limits-server.ts` дотроос унш.

import type { Plan } from "@/app/generated/prisma/enums";

/**
 * Plan хязгаарын кодуудын төвлөрсөн жагсаалт. Бүгд snake_case (DB-д ингэж
 * хадгалагдана). Шинэ хязгаар нэмэхдээ:
 *   1. `PLAN_LIMIT_CODES`-д код нэмнэ
 *   2. `PLAN_LIMIT_META`-д label/description/kind нэмнэ
 *   3. `DEFAULT_PLAN_LIMITS`-д 3 plan бүрд default утга зааж өгнө
 *   4. Шаардлагатай action дотор `enforceLimit`-ийг дуудна
 */
export const PLAN_LIMIT_CODES = {
  MAX_USERS: "max_users",
  MAX_BRANCHES: "max_branches",
  MAX_CUSTOMERS: "max_customers",
  MAX_VEHICLES: "max_vehicles",
  MAX_SERVICES: "max_services",
  DAILY_ORDERS: "daily_orders",
  MAX_ACTIVE_ORDERS: "max_active_orders",
  MAX_DIAGNOSTIC_TEMPLATES: "max_diagnostic_templates",
  ENABLE_DIAGNOSTICS: "enable_diagnostics",
  ENABLE_REPORTS: "enable_reports",
  ENABLE_API: "enable_api",
  ONLINE_BOOKING: "online_booking",
} as const;

export type PlanLimitCode =
  (typeof PLAN_LIMIT_CODES)[keyof typeof PLAN_LIMIT_CODES];

export type PlanLimitKind = "COUNT" | "BOOLEAN";

export const PLAN_LIMIT_META: Record<
  PlanLimitCode,
  {
    label: string;
    description: string;
    kind: PlanLimitKind;
    sortOrder: number;
  }
> = {
  max_users: {
    label: "Ажилтны тоо",
    description: "Бүртгэх боломжтой нийт хэрэглэгч (OWNER + бусад)",
    kind: "COUNT",
    sortOrder: 10,
  },
  max_branches: {
    label: "Салбарын тоо",
    description: "Бүртгэх боломжтой салбарын тоо",
    kind: "COUNT",
    sortOrder: 20,
  },
  max_customers: {
    label: "Үйлчлүүлэгчийн тоо",
    description: "Бүртгэх боломжтой нийт үйлчлүүлэгч",
    kind: "COUNT",
    sortOrder: 30,
  },
  max_vehicles: {
    label: "Машины тоо",
    description: "Бүртгэх боломжтой нийт машин",
    kind: "COUNT",
    sortOrder: 40,
  },
  max_services: {
    label: "Үйлчилгээний тоо",
    description: "Каталогт байх нийт үйлчилгээ/бараа",
    kind: "COUNT",
    sortOrder: 50,
  },
  daily_orders: {
    label: "Өдрийн захиалга",
    description: "Нэг өдөрт үүсгэх захиалгын тоо",
    kind: "COUNT",
    sortOrder: 60,
  },
  max_active_orders: {
    label: "Идэвхтэй захиалга",
    description: "Дуусаагүй (SCHEDULED/IN_PROGRESS/WAITING_PARTS) захиалгын тоо",
    kind: "COUNT",
    sortOrder: 70,
  },
  max_diagnostic_templates: {
    label: "Оношилгооны загвар",
    description: "Зохиох боломжтой нийт оношилгооны загвар",
    kind: "COUNT",
    sortOrder: 80,
  },
  enable_diagnostics: {
    label: "Оношилгооны модуль",
    description: "Оношилгооны загвар + тайлан ашиглах боломж",
    kind: "BOOLEAN",
    sortOrder: 100,
  },
  enable_reports: {
    label: "Тайлан",
    description: "Тайлангийн модулийг нээх",
    kind: "BOOLEAN",
    sortOrder: 110,
  },
  enable_api: {
    label: "API хандалт",
    description: "Гадаад API/Mobile token ашиглах",
    kind: "BOOLEAN",
    sortOrder: 120,
  },
  online_booking: {
    label: "Онлайн цаг захиалга",
    description: "Хэрэглэгчийн вэб каталогт харагдаж, онлайнаар цаг авах",
    kind: "BOOLEAN",
    sortOrder: 130,
  },
};

export const ALL_LIMIT_CODES: PlanLimitCode[] = Object.values(PLAN_LIMIT_CODES);

type DefaultValue = { intValue: number | null; boolValue: boolean | null };

/**
 * 3 plan тус бүрийн анхдагч хязгаар. SuperAdmin-аас өөрчилнө.
 *   - intValue: null → COUNT-д хязгааргүй
 *   - boolValue: true/false → BOOLEAN-д заавал тогтоно
 */
export const DEFAULT_PLAN_LIMITS: Record<
  Plan,
  Record<PlanLimitCode, DefaultValue>
> = {
  FREE: {
    max_users: { intValue: 3, boolValue: null },
    max_branches: { intValue: 1, boolValue: null },
    max_customers: { intValue: 50, boolValue: null },
    max_vehicles: { intValue: 50, boolValue: null },
    max_services: { intValue: 20, boolValue: null },
    daily_orders: { intValue: 10, boolValue: null },
    max_active_orders: { intValue: 20, boolValue: null },
    max_diagnostic_templates: { intValue: 3, boolValue: null },
    enable_diagnostics: { intValue: null, boolValue: true },
    enable_reports: { intValue: null, boolValue: false },
    enable_api: { intValue: null, boolValue: false },
    online_booking: { intValue: null, boolValue: false },
  },
  BUSINESS: {
    max_users: { intValue: 20, boolValue: null },
    max_branches: { intValue: 5, boolValue: null },
    max_customers: { intValue: 5000, boolValue: null },
    max_vehicles: { intValue: 5000, boolValue: null },
    max_services: { intValue: 500, boolValue: null },
    daily_orders: { intValue: 100, boolValue: null },
    max_active_orders: { intValue: 500, boolValue: null },
    max_diagnostic_templates: { intValue: 50, boolValue: null },
    enable_diagnostics: { intValue: null, boolValue: true },
    enable_reports: { intValue: null, boolValue: true },
    enable_api: { intValue: null, boolValue: false },
    online_booking: { intValue: null, boolValue: true },
  },
  ENTERPRISE: {
    max_users: { intValue: null, boolValue: null },
    max_branches: { intValue: null, boolValue: null },
    max_customers: { intValue: null, boolValue: null },
    max_vehicles: { intValue: null, boolValue: null },
    max_services: { intValue: null, boolValue: null },
    daily_orders: { intValue: null, boolValue: null },
    max_active_orders: { intValue: null, boolValue: null },
    max_diagnostic_templates: { intValue: null, boolValue: null },
    enable_diagnostics: { intValue: null, boolValue: true },
    enable_reports: { intValue: null, boolValue: true },
    enable_api: { intValue: null, boolValue: true },
    online_booking: { intValue: null, boolValue: true },
  },
};
