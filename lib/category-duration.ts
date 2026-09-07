import type { PrismaTransactionClient } from "@/lib/prisma";
import { DEFAULT_SLOT_MINUTES } from "@/lib/appointment-slots";

// Ангилалд хугацаа тохируулаагүй үеийн эцсийн fallback (минут). Slot-ийн
// анхдагч урттай санаатай нийцүүлэв — booking v2-ийн шатлал:
//   BranchCategoryDuration.durationMinutes  (салбар-тусгай override)
//     ?? Category.durationMinutes            (tenant-ийн default)
//     ?? DEFAULT_CATEGORY_DURATION_MINUTES   (платформын fallback)
export const DEFAULT_CATEGORY_DURATION_MINUTES = DEFAULT_SLOT_MINUTES;

/**
 * Нэг ангиллын effective хугацааг шатлан сонгоно — pure. `branchOverride` ба
 * `categoryDefault` аль аль нь null байж болно (тохируулаагүй).
 */
export function resolveCategoryDurationMinutes(opts: {
  branchOverride: number | null | undefined;
  categoryDefault: number | null | undefined;
}): number {
  return (
    opts.branchOverride ??
    opts.categoryDefault ??
    DEFAULT_CATEGORY_DURATION_MINUTES
  );
}

export type ResolvedCategoryDuration = {
  categoryId: string;
  minutes: number;
  source: "branch" | "tenant" | "default";
};

/**
 * Тухайн салбар дээр өгөгдсөн ангилалуудын effective хугацааг DB-ээс уншиж
 * шийднэ. Одоо байгаа `Branch↔Category` гишүүнчлэлд ХҮРэлгүйгээр зөвхөн
 * `Category.durationMinutes` + `BranchCategoryDuration` override-ыг уншина.
 *
 * Буцаах: ангилал тус бүрийн шийдэгдсэн хугацаа (эх сурвалжтай) + нийлбэр.
 * Санал болгосон ангилал бүрийн категори олдоно гэж үзнэ (endpoint талд
 * tenant/branch-д харьяалагдахыг тусдаа шалгах ёстой).
 */
export async function resolveBranchCategoryDurations(
  client: PrismaTransactionClient,
  branchId: string,
  categoryIds: string[],
): Promise<{ perCategory: ResolvedCategoryDuration[]; totalMinutes: number }> {
  const uniqueIds = [...new Set(categoryIds)];
  if (uniqueIds.length === 0) return { perCategory: [], totalMinutes: 0 };

  const [categories, overrides] = await Promise.all([
    client.category.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, durationMinutes: true },
    }),
    client.branchCategoryDuration.findMany({
      where: { branchId, categoryId: { in: uniqueIds } },
      select: { categoryId: true, durationMinutes: true },
    }),
  ]);

  const defaultById = new Map(categories.map((c) => [c.id, c.durationMinutes]));
  const overrideById = new Map(
    overrides.map((o) => [o.categoryId, o.durationMinutes]),
  );

  const perCategory: ResolvedCategoryDuration[] = uniqueIds.map((id) => {
    const branchOverride = overrideById.get(id) ?? null;
    const categoryDefault = defaultById.get(id) ?? null;
    const minutes = resolveCategoryDurationMinutes({
      branchOverride,
      categoryDefault,
    });
    const source =
      branchOverride != null
        ? "branch"
        : categoryDefault != null
          ? "tenant"
          : "default";
    return { categoryId: id, minutes, source };
  });

  const totalMinutes = perCategory.reduce((sum, c) => sum + c.minutes, 0);
  return { perCategory, totalMinutes };
}
