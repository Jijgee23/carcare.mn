import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * Хэрэглэгчийн машины нэгдсэн жагсаалт: өөрийн нэмсэн (AccountVehicle) +
 * сервисээс бүртгэгдэж холбогдсон (TenantVehicle, account эсвэл утсаар).
 * Global vehicleId-аар давхардлыг арилгана. `/org/[slug]` болон `/book/branch`
 * захиалгын хуудсуудын хооронд хуваалцсан (өмнө нь org/[slug]-д л байсан).
 */
export async function loadAccountVehicles(accountId: string, phone: string) {
  const VEH_SELECT = { plate: true, make: true, model: true } as const;
  const [avLinks, ownedTV] = await Promise.all([
    prisma.accountVehicle.findMany({
      where: { accountId },
      orderBy: { createdAt: "desc" },
      select: { vehicleId: true, vehicle: { select: VEH_SELECT } },
    }),
    prisma.tenantVehicle.findMany({
      where: {
        OR: [
          { customer: { accountId } },
          { customer: { phone: { endsWith: phone } } },
        ],
      },
      select: { vehicleId: true, vehicle: { select: VEH_SELECT } },
      distinct: ["vehicleId"],
    }),
  ]);
  const map = new Map<
    string,
    { id: string; plate: string; make: string; model: string }
  >();
  for (const r of [...avLinks, ...ownedTV]) {
    if (!map.has(r.vehicleId)) map.set(r.vehicleId, { id: r.vehicleId, ...r.vehicle });
  }
  return [...map.values()];
}
