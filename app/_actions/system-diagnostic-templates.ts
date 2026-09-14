"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@/app/generated/prisma/client";
import { requireSuperAdmin } from "@/lib/auth/system";
import {
  DIAGNOSTIC_TYPES,
  type DiagnosticType,
  type TemplateSchema,
  emptySchema,
  validateSchema,
} from "@/lib/diagnostics";
import { prisma } from "@/lib/prisma";

// Тенантын app/_actions/diagnostic-templates.ts-тэй адил, ялгаа: ангилал
// (categoryId) шаардахгүй, тенантын багц/эрхийн шалгалт (subscription,
// feature flag, тоо-хязгаар) хамаарахгүй — эдгээр нь тенантын өөрийн багцын
// ойлголт тул систем admin-д хамаагүй.
function parseDecimal(v: string): Prisma.Decimal | null {
  if (!v) return null;
  const cleaned = v.replace(/[,\s]/g, "");
  const n = Number.parseFloat(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return new Prisma.Decimal(cleaned);
}

export type SystemTemplateActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
} | null;

function s(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

type Parsed = {
  name: string;
  description: string | null;
  type: DiagnosticType;
  isActive: boolean;
  schema: TemplateSchema;
  price: Prisma.Decimal | null;
  durationMin: number | null;
  errors: Record<string, string>;
};

function parse(fd: FormData): Parsed {
  const name = s(fd, "name");
  const description = s(fd, "description");
  const typeRaw = s(fd, "type");
  const isActive = fd.get("isActive") === "on";
  const schemaRaw = s(fd, "schema");
  const priceRaw = s(fd, "price");
  const durationRaw = s(fd, "durationMin");

  const errors: Record<string, string> = {};
  if (!name) errors.name = "Хуудасны нэрээ оруулна уу.";
  if (!DIAGNOSTIC_TYPES.includes(typeRaw as DiagnosticType))
    errors.type = "Төрлөө сонгоно уу.";

  let schema: TemplateSchema = emptySchema();
  if (!schemaRaw) {
    errors.schema = "Хуудасны бүтэц алга байна.";
  } else {
    try {
      const parsed: unknown = JSON.parse(schemaRaw);
      schema = validateSchema(parsed);
    } catch (e) {
      errors.schema = e instanceof Error ? e.message : "Бүтэц JSON буруу.";
    }
  }

  let price: Prisma.Decimal | null = null;
  if (priceRaw) {
    price = parseDecimal(priceRaw);
    if (!price) errors.price = "Үнэ буруу.";
  }

  let durationMin: number | null = null;
  if (durationRaw) {
    const n = Number.parseInt(durationRaw, 10);
    if (!Number.isFinite(n) || n < 0) {
      errors.durationMin = "Хугацаа буруу.";
    } else {
      durationMin = n;
    }
  }

  return {
    name,
    description: description || null,
    type: typeRaw as DiagnosticType,
    isActive,
    schema,
    price,
    durationMin,
    errors,
  };
}

export async function createSystemTemplateAction(
  _prev: SystemTemplateActionState,
  formData: FormData,
): Promise<SystemTemplateActionState> {
  const actor = await requireSuperAdmin();

  const { name, description, type, isActive, schema, price, durationMin, errors } =
    parse(formData);
  if (Object.keys(errors).length > 0) {
    return { ok: false, fieldErrors: errors };
  }

  let created;
  try {
    created = await prisma.diagnosticTemplate.create({
      data: {
        name,
        description,
        type,
        isActive,
        schema,
        price,
        durationMin,
        version: 1,
        tenantId: null,
        createdBySystemAdminId: actor.id,
      },
      select: { id: true },
    });
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Үүсгэхэд алдаа гарлаа.",
    };
  }

  revalidatePath("/system/diagnostic-templates");
  redirect(`/system/diagnostic-templates/${created.id}`);
}

export async function updateSystemTemplateAction(
  id: string,
  _prev: SystemTemplateActionState,
  formData: FormData,
): Promise<SystemTemplateActionState> {
  await requireSuperAdmin();

  const { name, description, type, isActive, schema, price, durationMin, errors } =
    parse(formData);
  if (Object.keys(errors).length > 0) {
    return { ok: false, fieldErrors: errors };
  }

  // Бөглөгдсөн тайлантай бол schema өөрчилбөл version-г өсгөнө (тенантын
  // үйлдэлтэй адил зарчим) — эндхийн тайлан аль ч грант авсан тенантынх байж болно.
  const existing = await prisma.diagnosticTemplate.findFirst({
    where: { id, tenantId: null },
    select: {
      schema: true,
      version: true,
      _count: { select: { reports: true } },
    },
  });
  if (!existing) return { ok: false, message: "Загвар олдсонгүй." };

  const schemaChanged =
    JSON.stringify(existing.schema) !== JSON.stringify(schema);
  const bump = schemaChanged && existing._count.reports > 0;

  try {
    await prisma.diagnosticTemplate.update({
      where: { id },
      data: {
        name,
        description,
        type,
        isActive,
        schema,
        price,
        durationMin,
        version: bump ? existing.version + 1 : existing.version,
      },
    });
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Шинэчлэхэд алдаа гарлаа.",
    };
  }

  revalidatePath("/system/diagnostic-templates");
  revalidatePath(`/system/diagnostic-templates/${id}`);
  redirect(`/system/diagnostic-templates/${id}`);
}

export async function deleteSystemTemplateAction(
  formData: FormData,
): Promise<void> {
  await requireSuperAdmin();
  const id = s(formData, "id");
  if (!id) return;

  // Тайлантай бол устгахгүй, зөвхөн идэвхгүй болгоно (тенантын үйлдэлтэй адил).
  const t = await prisma.diagnosticTemplate.findFirst({
    where: { id, tenantId: null },
    select: { _count: { select: { reports: true } } },
  });
  if (!t) return;

  if (t._count.reports > 0) {
    await prisma.diagnosticTemplate.update({
      where: { id },
      data: { isActive: false },
    });
  } else {
    await prisma.diagnosticTemplate.delete({ where: { id } });
  }

  revalidatePath("/system/diagnostic-templates");
}

// Тухайн загварыг ямар байгууллагад ашиглуулахыг нэг дор тохируулна —
// одоо байгаа грантуудыг шинэ жагсаалттай тааруулж, зөрүүг л бичнэ. Checkbox
// list-тэй энгийн <form action>-оор дуудагдана (харах: grant-tenants-form.tsx).
export async function setTemplateGrantsAction(
  templateId: string,
  formData: FormData,
): Promise<void> {
  await requireSuperAdmin();

  const template = await prisma.diagnosticTemplate.findFirst({
    where: { id: templateId, tenantId: null },
    select: { id: true },
  });
  if (!template) return;

  const tenantIds = formData.getAll("tenantIds").filter(
    (v): v is string => typeof v === "string",
  );
  const wanted = new Set(tenantIds);
  const existing = await prisma.diagnosticTemplateGrant.findMany({
    where: { templateId },
    select: { tenantId: true },
  });
  const existingIds = new Set(existing.map((g) => g.tenantId));

  const toAdd = [...wanted].filter((id) => !existingIds.has(id));
  const toRemove = [...existingIds].filter((id) => !wanted.has(id));

  // Тайлбар: `prisma.$transaction([...])` (batch хэлбэр) энд ашиглахгүй —
  // lib/prisma.ts-ийн RLS extension query бүрийг өөрийн дотоод
  // transaction-д ороодог тул batch-тай зэрэгцэн ажиллахгүй (харах:
  // withBookingTransaction-ийн тайлбар). Энд аль хэдийн `requireSuperAdmin()`-ээр
  // bypass context тавигдсан, дараалсан 2 үйлдэл хангалттай.
  if (toRemove.length > 0) {
    await prisma.diagnosticTemplateGrant.deleteMany({
      where: { templateId, tenantId: { in: toRemove } },
    });
  }
  if (toAdd.length > 0) {
    await prisma.diagnosticTemplateGrant.createMany({
      data: toAdd.map((tenantId) => ({ templateId, tenantId })),
    });
  }

  revalidatePath(`/system/diagnostic-templates/${templateId}`);
  revalidatePath("/system/diagnostic-templates");
}
