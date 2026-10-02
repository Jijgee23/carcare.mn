import { stat } from "node:fs/promises";
import { resolveUploadPath } from "@/lib/storage";
import { INTAKE_NOTES_MAX, INTAKE_PHOTOS_MAX, intakeStagingSubdir } from "@/lib/orders/order-intake";

const SAFE_ID = /^[A-Za-z0-9_-]+$/;
const FILE_NAME = /^[0-9a-f]{24}\.(png|jpg|webp)$/;

/** Энэ хэрэглэгчийн staging хавтсанд saveUpload-ийн үүсгэсэн файл мөн эсэх. */
export function isOwnStagedIntakePath(path: string, tenantId: string, userId: string): boolean {
  if (!SAFE_ID.test(tenantId) || !SAFE_ID.test(userId)) return false;
  const prefix = `/uploads/${intakeStagingSubdir(tenantId, userId)}/`;
  return path.startsWith(prefix) && FILE_NAME.test(path.slice(prefix.length));
}

export const INTAKE_PATH_CLAIMED_MESSAGE =
  "Энэ зураг өөр засварын хуудсанд аль хэдийн хавсаргагдсан. Дахин оруулна уу.";

/** Өгөгдсөн замуудаас аль хэдийн (энэ tenant-ийн) засварын хуудсанд хавсаргагдсан нь байгаа эсэх. */
export type IntakePathClaimedLookup = (tenantId: string, paths: string[]) => Promise<boolean>;

const defaultClaimedLookup: IntakePathClaimedLookup = async (tenantId, paths) => {
  // Динамик import: цэвэр шалгалтын тест DB/env-д хүрэхгүй.
  const { prisma } = await import("@/lib/prisma");
  const [photo, signature] = await Promise.all([
    prisma.serviceOrderIntakePhoto.findFirst({ where: { tenantId, path: { in: paths } }, select: { id: true } }),
    prisma.serviceOrder.findFirst({ where: { tenantId, intakeSignaturePath: { in: paths } }, select: { id: true } }),
  ]);
  return Boolean(photo || signature);
};

export type IntakeInput = {
  notes: string | null;
  photoPaths: string[];
  signaturePath: string | null;
};

/**
 * Энгийн утгууд дээр хүлээн авах хэсгийг шалгана (web FormData болон API JSON
 * хоёрт нийтлэг). Хоосон бол `null` (хүлээн авах бүртгээгүй захиалга).
 */
export async function validateIntakeFields(
  fields: { notes?: string | null; photoPaths?: string[]; signaturePath?: string | null },
  tenantId: string,
  userId: string,
  isClaimed: IntakePathClaimedLookup = defaultClaimedLookup,
): Promise<{ intake: IntakeInput | null; error?: string }> {
  const notes = (fields.notes ?? "").trim();
  const photoPaths = [...new Set((fields.photoPaths ?? []).filter(Boolean))];
  const signaturePath = (fields.signaturePath ?? "").trim() || null;

  if (!notes && photoPaths.length === 0 && !signaturePath) return { intake: null };
  if (notes.length > INTAKE_NOTES_MAX) {
    return { intake: null, error: `Хүлээн авах тэмдэглэл ${INTAKE_NOTES_MAX} тэмдэгтээс хэтрэхгүй.` };
  }
  if (photoPaths.length > INTAKE_PHOTOS_MAX) {
    return { intake: null, error: `Хамгийн ихдээ ${INTAKE_PHOTOS_MAX} зураг.` };
  }
  // Нэг зураг photo ба signature хоёуланд хавсаргагдахгүй.
  if (signaturePath && photoPaths.includes(signaturePath)) {
    return { intake: null, error: INTAKE_PATH_CLAIMED_MESSAGE };
  }
  for (const p of [...photoPaths, ...(signaturePath ? [signaturePath] : [])]) {
    if (!isOwnStagedIntakePath(p, tenantId, userId)) {
      return { intake: null, error: "Хүлээн авах зураг буруу байна. Дахин оруулна уу." };
    }
    try {
      await stat(resolveUploadPath(p));
    } catch {
      return { intake: null, error: "Хүлээн авах зураг олдсонгүй. Дахин оруулна уу." };
    }
  }
  // Өөр захиалгад аль хэдийн хавсаргагдсан эсэх (DB):
  const all = [...photoPaths, ...(signaturePath ? [signaturePath] : [])];
  if (all.length > 0 && (await isClaimed(tenantId, all))) {
    return { intake: null, error: INTAKE_PATH_CLAIMED_MESSAGE };
  }
  return { intake: { notes: notes || null, photoPaths, signaturePath } };
}

/** FormData-аас хүлээн авах хэсгийг уншиж `validateIntakeFields`-ээр шалгана. */
export async function parseIntakeInput(
  fd: FormData,
  tenantId: string,
  userId: string,
): Promise<{ intake: IntakeInput | null; error?: string }> {
  return validateIntakeFields(
    {
      notes: String(fd.get("intakeNotes") ?? ""),
      photoPaths: fd.getAll("intakePhotoPaths").map(String),
      signaturePath: String(fd.get("intakeSignaturePath") ?? ""),
    },
    tenantId,
    userId,
  );
}

/**
 * API JSON body-н `intake` талбарын төрлийг шалгана (undefined/null = заасангүй).
 * Буруу төрөл бол `error`.
 */
export function readIntakeBody(raw: unknown): {
  fields: { notes: string | null; photoPaths: string[]; signaturePath: string | null } | null;
  error?: string;
} {
  if (raw === undefined || raw === null) return { fields: null };
  const bad = { fields: null, error: "intake нь { notes, photoPaths, signaturePath } object байна." };
  if (typeof raw !== "object" || Array.isArray(raw)) return bad;
  const r = raw as Record<string, unknown>;
  if (r.notes !== undefined && r.notes !== null && typeof r.notes !== "string") return bad;
  if (r.signaturePath !== undefined && r.signaturePath !== null && typeof r.signaturePath !== "string") return bad;
  if (r.photoPaths !== undefined && r.photoPaths !== null) {
    if (!Array.isArray(r.photoPaths) || r.photoPaths.some((p) => typeof p !== "string")) return bad;
  }
  return {
    fields: {
      notes: (r.notes as string | null | undefined) ?? null,
      photoPaths: (r.photoPaths as string[] | null | undefined) ?? [],
      signaturePath: (r.signaturePath as string | null | undefined) ?? null,
    },
  };
}
