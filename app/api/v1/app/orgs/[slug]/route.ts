import { jsonError, jsonOk } from "@/lib/api";
import { resolveCategoryDurationMinutes } from "@/lib/category-duration";
import { PLAN_LIMIT_CODES } from "@/lib/plan-limits";
import { plansWithFeature } from "@/lib/plan-limits-server";
import { prisma } from "@/lib/prisma";
import { setBypassContext } from "@/lib/tenant-context";

// GET /api/v1/app/orgs/[slug] — байгууллагын дэлгэрэнгүй + салбарууд (нийтэд).
// Booking v2: салбар бүрд санал болгох ангилалуудыг шийдэгдсэн хугацаатай нь
// (branch override ?? category default ?? 30) хавсаргана.
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  // Нийтэд нээлттэй, slug-аар Tenant олохоос өмнө tenant тодорхойгүй тул bypass.
  setBypassContext();
  const { slug } = await ctx.params;
  const allowedPlans = await plansWithFeature(PLAN_LIMIT_CODES.ONLINE_BOOKING);
  const org = await prisma.tenant.findFirst({
    where: {
      slug,
      acceptsOnlineBooking: true,
      suspended: false,
      plan: { in: allowedPlans },
    },
    select: {
      slug: true,
      name: true,
      logoUrl: true,
      phone1: true,
      branches: {
        orderBy: { isPrimary: "desc" },
        select: {
          id: true,
          name: true,
          city: true,
          district: true,
          khoroo: true,
          address: true,
          latitude: true,
          longitude: true,
          openTime: true,
          closeTime: true,
        },
      },
      // Онлайн захиалгад санал болгох идэвхтэй ангилалууд. `branches` хоосон бол
      // тухайн ангилал БҮХ салбарт хамаарна (categories.ts-ийн дүрэмтэй нийцтэй).
      categories: {
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          durationMinutes: true,
          branches: { select: { id: true } },
        },
      },
    },
  });
  if (!org) return jsonError(404, "Байгууллага олдсонгүй.");

  const branchIds = org.branches.map((b) => b.id);

  // Салбар-тусгай хугацааны override-ууд (branchId+categoryId → минут).
  const overrides =
    branchIds.length > 0
      ? await prisma.branchCategoryDuration.findMany({
          where: { branchId: { in: branchIds } },
          select: { branchId: true, categoryId: true, durationMinutes: true },
        })
      : [];
  const overrideKey = (branchId: string, categoryId: string) =>
    `${branchId}:${categoryId}`;
  const overrideByKey = new Map(
    overrides.map((o) => [overrideKey(o.branchId, o.categoryId), o.durationMinutes]),
  );

  const { categories, branches, ...orgRest } = org;

  // Салбар бүрд: тухайн салбарт хамаарах ангилалуудыг шийдэгдсэн хугацаатай нь.
  const branchesWithCategories = branches.map((b) => {
    const offered = categories.filter(
      (c) => c.branches.length === 0 || c.branches.some((cb) => cb.id === b.id),
    );
    return {
      ...b,
      categories: offered.map((c) => ({
        id: c.id,
        name: c.name,
        durationMinutes: resolveCategoryDurationMinutes({
          branchOverride: overrideByKey.get(overrideKey(b.id, c.id)) ?? null,
          categoryDefault: c.durationMinutes,
        }),
      })),
    };
  });

  return jsonOk({ org: { ...orgRest, branches: branchesWithCategories } });
}
