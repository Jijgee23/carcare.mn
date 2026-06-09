import { jsonOk } from "@/lib/api";
import { PLAN_LIMIT_CODES } from "@/lib/plan-limits";
import { plansWithFeature } from "@/lib/plan-limits-server";
import { prisma } from "@/lib/prisma";

// GET /api/v1/app/orgs — онлайн захиалга нээлттэй байгууллагуудын каталог (нийтэд).
export async function GET() {
  const allowedPlans = await plansWithFeature(PLAN_LIMIT_CODES.ONLINE_BOOKING);
  const orgs = await prisma.tenant.findMany({
    where: {
      acceptsOnlineBooking: true,
      suspended: false,
      plan: { in: allowedPlans },
    },
    orderBy: { name: "asc" },
    select: {
      slug: true,
      name: true,
      logoUrl: true,
      branches: {
        select: {
          id: true,
          name: true,
          city: true,
          district: true,
          latitude: true,
          longitude: true,
        },
      },
    },
  });
  return jsonOk({ orgs });
}
