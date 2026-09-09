import { Prisma } from "@/app/generated/prisma/client";
import { jsonError, jsonOk } from "@/lib/api";
import { getApiAccountFromRequest } from "@/lib/auth/account-api-token";
import { buildMeta, getApiPageInfo } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { ownedVehicleIdsForAccount } from "@/lib/vehicles";

// GET /api/v1/app/diagnostics — миний оношилгооны тайлангуудын жагсаалт (auth,
// бүх байгууллага дамнасан) — тухайн засварын хуудасны дотор нуугдаад байсныг
// дербан "миний оношилгоонууд" харагдацад зориулав. Товч мэдээлэл л буцаана —
// бүрэн бөглөлтийг [id] дуудлагаас авна (харах: order-уудын ижил зарчим).
export async function GET(req: Request) {
  const account = await getApiAccountFromRequest(req);
  if (!account) return jsonError(401, "Нэвтрэх шаардлагатай.");

  const url = new URL(req.url);
  const vehicleIdFilter = url.searchParams.get("vehicleId")?.trim() || undefined;
  const { page, pageSize, skip, take } = getApiPageInfo(url.searchParams);

  const ownedVehicleIds = await ownedVehicleIdsForAccount(account.id, account.phone);

  const where: Prisma.DiagnosticReportWhereInput = {
    OR: [
      { customer: { accountId: account.id } },
      ...(ownedVehicleIds.length
        ? [{ vehicleId: { in: ownedVehicleIds } }]
        : []),
    ],
  };
  if (vehicleIdFilter) where.vehicleId = vehicleIdFilter;

  const [reports, total] = await Promise.all([
    prisma.diagnosticReport.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      select: {
        id: true,
        mileageAtReport: true,
        maxSeverity: true,
        createdAt: true,
        template: { select: { name: true, type: true } },
        vehicle: { select: { plate: true, make: true, model: true, year: true } },
        branch: { select: { name: true } },
        order: { select: { id: true, number: true } },
      },
    }),
    prisma.diagnosticReport.count({ where }),
  ]);

  const shaped = reports.map((r) => ({
    id: r.id,
    type: r.template.type,
    templateName: r.template.name,
    mileageAtReport: r.mileageAtReport,
    severity: r.maxSeverity,
    createdAt: r.createdAt,
    vehicle: r.vehicle,
    branch: r.branch,
    order: r.order,
  }));

  return jsonOk({ reports: shaped, pagination: buildMeta(total, page, pageSize) });
}
