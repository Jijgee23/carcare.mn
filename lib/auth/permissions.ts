// Tenant-ийн Role-уудад олгох боломжтой бүх permission-ийн төв жагсаалт.
// Resource бүрд CRUD: view / create / edit / delete (тус тусдаа сонгоно).
// Зарим эрх standalone (audit.view, orders.assignable) — CRUD-д хуваагдаагүй.

export const RESOURCES = [
  { key: "employees", label: "Ажилтан", group: "Удирдлага" },
  { key: "branches", label: "Салбар", group: "Удирдлага" },
  { key: "customers", label: "Үйлчлүүлэгч", group: "Үндсэн" },
  { key: "vehicles", label: "Тээврийн хэрэгсэл", group: "Үндсэн" },
  { key: "services", label: "Үйлчилгээ/Бараа", group: "Үндсэн" },
  { key: "diagnostics", label: "Оношилгооны загвар", group: "Үндсэн" },
  { key: "orders", label: "Захиалга", group: "Захиалга" },
  { key: "appointments", label: "Цаг захиалга", group: "Захиалга" },
  { key: "payments", label: "Төлбөр", group: "Захиалга" },
] as const;

export type ResourceKey = (typeof RESOURCES)[number]["key"];

export const ACTIONS = [
  { key: "view", label: "Харах", verb: "Харах" },
  { key: "create", label: "Үүсгэх", verb: "Үүсгэх" },
  { key: "edit", label: "Засах", verb: "Засах" },
  { key: "delete", label: "Устгах", verb: "Устгах" },
] as const;

export type ActionKey = (typeof ACTIONS)[number]["key"];

// CRUD permission code-уудыг үүсгэх (`employees.view`, `employees.create`, ...).
type CrudCode = `${ResourceKey}.${ActionKey}`;

// CRUD-д хуваагдаагүй тусгай permission-ууд.
// `services.duration` — онлайн захиалгын үргэлжлэх хугацааг (ангиллын default
// ба салбар-тусгай override) тохируулах эрх. `services.edit`-ээс тусдаа: салбар-
// мастер зөвхөн ЭНЭ эрхтэйгээр өөрийн салбарын хугацааг засах боломжтой (үнэ/
// үйлчилгээний бусад засварын эрхгүйгээр). Салбарын хамрах хүрээг код бус,
// endpoint дээр actor-ийн branchId-аар (branchScopeId/workingBranchScopeId) force
// хийж хамгаална — booking v2, D-038.
type StandaloneCode = "audit.view" | "orders.assignable" | "services.duration";

export type PermissionCode = CrudCode | StandaloneCode;

export type PermissionDef = {
  code: PermissionCode;
  label: string;
  description: string;
  group: string;
};

const CRUD_DESCRIPTIONS: Record<ActionKey, (resourceLabel: string) => string> = {
  view: (r) => `${r}-ийн жагсаалт, дэлгэрэнгүйг харах.`,
  create: (r) => `Шинэ ${r.toLowerCase()} нэмэх.`,
  edit: (r) => `${r}-ийн мэдээллийг засварлах.`,
  delete: (r) => `${r}-ийг устгах.`,
};

function buildCrudPermissions(): PermissionDef[] {
  const out: PermissionDef[] = [];
  for (const r of RESOURCES) {
    for (const a of ACTIONS) {
      out.push({
        code: `${r.key}.${a.key}` as CrudCode,
        label: `${r.label} — ${a.label}`,
        description: CRUD_DESCRIPTIONS[a.key](r.label),
        group: r.group,
      });
    }
  }
  return out;
}

export const PERMISSIONS: readonly PermissionDef[] = [
  ...buildCrudPermissions(),
  {
    code: "orders.assignable",
    label: "Захиалгад хариуцагч болох",
    description: "Захиалгын хариуцагч болгож сонгох боломжтой ажилтан.",
    group: "Захиалга",
  },
  {
    code: "audit.view",
    label: "Аудит лог үзэх",
    description: "Бүх ажилтны үйлдлийн түүхийг харах.",
    group: "Тайлан",
  },
  {
    code: "services.duration",
    label: "Үйлчилгээний хугацаа тохируулах",
    description:
      "Онлайн захиалгын ангилал бүрийн үргэлжлэх хугацааг (default ба салбар-тусгай) тохируулах. Салбар-мастер зөвхөн өөрийн салбарынхыг засна.",
    group: "Захиалга",
  },
] as const;

export const PERMISSION_CODES = PERMISSIONS.map((p) => p.code);

const PERMISSION_CODE_SET = new Set<string>(PERMISSION_CODES);

export function isValidPermissionCode(code: string): code is PermissionCode {
  return PERMISSION_CODE_SET.has(code);
}

export function permissionLabel(code: string): string {
  return PERMISSIONS.find((p) => p.code === code)?.label ?? code;
}

// Permission-уудыг group-аар нь бүлэглэж UI-д харуулахад зориулсан.
export function permissionsByGroup(): Array<{
  group: string;
  items: readonly PermissionDef[];
}> {
  const groups = new Map<string, PermissionDef[]>();
  for (const p of PERMISSIONS) {
    const arr = groups.get(p.group) ?? [];
    arr.push(p);
    groups.set(p.group, arr);
  }
  return Array.from(groups.entries()).map(([group, items]) => ({
    group,
    items,
  }));
}

// Standalone (CRUD-д ороогүй) permission-ууд (UI-д тусдаа жагсаалт болгоход).
export const STANDALONE_PERMISSIONS: ReadonlyArray<PermissionDef> = PERMISSIONS.filter(
  (p) =>
    p.code === "audit.view" ||
    p.code === "orders.assignable" ||
    p.code === "services.duration",
);
