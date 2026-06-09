import { jsonError, jsonOk } from "@/lib/api";
import { isSlotAvailable } from "@/lib/appointment-slots";
import { getApiAccountFromRequest } from "@/lib/auth/account-api-token";
import { PLAN_LIMIT_CODES } from "@/lib/plan-limits";
import { isFeatureEnabled } from "@/lib/plan-limits-server";
import { prisma } from "@/lib/prisma";

// GET /api/v1/app/appointments — миний цагууд (auth).
export async function GET(req: Request) {
  const account = await getApiAccountFromRequest(req);
  if (!account) return jsonError(401, "Нэвтрэх шаардлагатай.");

  const appointments = await prisma.appointment.findMany({
    where: { accountId: account.id },
    orderBy: { requestedAt: "desc" },
    select: {
      id: true,
      status: true,
      requestedAt: true,
      note: true,
      tenant: { select: { name: true, slug: true } },
      branch: { select: { name: true } },
      accountVehicle: { select: { plate: true } },
    },
  });
  return jsonOk({ appointments });
}

// POST /api/v1/app/appointments — цаг захиалах (auth).
// { branchId, requestedAt (ISO), accountVehicleId?, note? }
export async function POST(req: Request) {
  const account = await getApiAccountFromRequest(req);
  if (!account) return jsonError(401, "Нэвтрэх шаардлагатай.");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "JSON body шаардлагатай.");
  }
  const b = body as {
    branchId?: unknown;
    requestedAt?: unknown;
    accountVehicleId?: unknown;
    note?: unknown;
  };
  const branchId = typeof b.branchId === "string" ? b.branchId.trim() : "";
  const requestedRaw = typeof b.requestedAt === "string" ? b.requestedAt : "";
  const note = typeof b.note === "string" ? b.note.trim() : "";
  const accountVehicleId =
    typeof b.accountVehicleId === "string" && b.accountVehicleId
      ? b.accountVehicleId
      : null;

  if (!branchId) return jsonError(400, "branchId шаардлагатай.");
  const when = new Date(requestedRaw);
  if (!requestedRaw || !Number.isFinite(when.getTime())) {
    return jsonError(400, "requestedAt буруу (ISO огноо шаардлагатай).");
  }
  if (when.getTime() < Date.now()) {
    return jsonError(400, "Өнгөрсөн цаг сонгох боломжгүй.");
  }

  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: {
      id: true,
      tenantId: true,
      tenant: { select: { acceptsOnlineBooking: true, suspended: true } },
    },
  });
  if (!branch) return jsonError(404, "Салбар олдсонгүй.");
  if (!branch.tenant.acceptsOnlineBooking || branch.tenant.suspended) {
    return jsonError(403, "Энэ байгууллага онлайн цаг захиалга хүлээн авахгүй.");
  }
  if (!(await isFeatureEnabled(branch.tenantId, PLAN_LIMIT_CODES.ONLINE_BOOKING))) {
    return jsonError(403, "Энэ байгууллага онлайн цаг захиалга хүлээн авахгүй.");
  }

  if (!(await isSlotAvailable(prisma, branch.id, when))) {
    return jsonError(409, "Энэ цаг дүүрсэн байна. Өөр цаг сонгоно уу.");
  }

  if (accountVehicleId) {
    const owned = await prisma.accountVehicle.findFirst({
      where: { id: accountVehicleId, accountId: account.id },
      select: { id: true },
    });
    if (!owned) return jsonError(400, "Машин олдсонгүй.");
  }

  const appt = await prisma.appointment.create({
    data: {
      tenantId: branch.tenantId,
      branchId: branch.id,
      accountId: account.id,
      accountVehicleId,
      requestedAt: when,
      note: note || null,
      status: "PENDING",
    },
    select: { id: true, status: true, requestedAt: true },
  });
  return jsonOk({ appointment: appt }, { status: 201 });
}
