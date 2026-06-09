import { jsonError, jsonOk } from "@/lib/api";
import { PLAN_LIMIT_CODES } from "@/lib/plan-limits";
import { plansWithFeature } from "@/lib/plan-limits-server";
import { prisma } from "@/lib/prisma";

// GET /api/v1/app/orgs/[slug] — байгууллагын дэлгэрэнгүй + салбарууд (нийтэд).
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
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
    },
  });
  if (!org) return jsonError(404, "Байгууллага олдсонгүй.");
  return jsonOk({ org });
}
