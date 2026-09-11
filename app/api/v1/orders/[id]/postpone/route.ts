// S12: the ONLY API path to POSTPONED — the generic PATCH
// (app/api/v1/orders/[id]/route.ts) rejects it outright. Mirrors the
// dashboard's postponeOrderAction (app/_actions/orders.ts) via the shared
// lib/order-postpone.ts postponeOrderCore: mandatory reason and/or
// reasonTag, mandatory future returnAt (hours + conflict validated), a
// SCHEDULED OrderTimeBooking for the return, and a structured
// OrderStatusChange row — all under the same withOrderTransaction lock.
import { Prisma } from "@/app/generated/prisma/client";
import { jsonError, jsonOk, requireApiUser, requirePermission } from "@/lib/api";
import { branchScopeId } from "@/lib/auth/roles";
import { requireActiveSubscriptionApi } from "@/lib/subscription-server";
import { prisma } from "@/lib/prisma";
import { postponeOrderCore } from "@/lib/order-postpone";
import { canEditOrder } from "@/lib/auth/order-access";

const ORDER_DETAIL_SELECT = {
  id: true,
  number: true,
  status: true,
  paymentStatus: true,
  scheduledAt: true,
  startedAt: true,
  completedAt: true,
  paidAt: true,
  totalAmount: true,
  paidAmount: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  customer: { select: { id: true, fullName: true, phone: true, email: true } },
  vehicle: {
    select: {
      id: true,
      plate: true,
      make: true,
      model: true,
      year: true,
      vin: true,
      mileage: true,
    },
  },
  branch: { select: { id: true, name: true } },
  assignedTo: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.ServiceOrderSelect;

// Body: { reason?: string; reasonTag?: string; returnAt: string; confirmed?: boolean }
// At least one of reason/reasonTag is required; returnAt is required and must
// parse to a future, in-hours, (optionally) non-conflicting time — same rules
// as the dashboard's postpone modal (see lib/order-postpone.ts).
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;
  const denied = requirePermission(auth.user, "orders.edit");
  if (denied && !auth.user.role?.permissions.includes("orders.editOwn")) return denied;
  const locked = await requireActiveSubscriptionApi(auth.user);
  if (locked) return locked;
  const { id } = await ctx.params;
  const scope = branchScopeId(auth.user);
  const access = await prisma.serviceOrder.findFirst({ where: { id, tenantId: auth.user.tenantId, ...(scope ? { branchId: scope } : {}) }, select: { assignedToId: true } });
  if (!access) return jsonError(404, "Засварын хуудас олдсонгүй.");
  if (!canEditOrder(auth.user, access)) return jsonError(403, "Танд энэ засварын хуудсыг засах эрх байхгүй.");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "JSON body шаардлагатай.");
  }
  const b = body as Record<string, unknown>;

  const result = await postponeOrderCore({
    tenantId: auth.user.tenantId,
    orderId: id,
    branchScope: scope,
    reasonRaw: typeof b.reason === "string" ? b.reason : "",
    reasonTagRaw: typeof b.reasonTag === "string" ? b.reasonTag : "",
    returnAtRaw: typeof b.returnAt === "string" ? b.returnAt : "",
    confirmed: b.confirmed === true,
    actorId: auth.user.id,
  });

  if (!result.ok) {
    const status =
      result.error.code === "not_found" ? 404 : result.error.code === "conflict" ? 409 : 422;
    return jsonError(
      status,
      result.error.message ?? "Хойшлуулах боломжгүй.",
      result.error.fieldErrors ? { fieldErrors: result.error.fieldErrors } : undefined,
    );
  }

  const order = await prisma.serviceOrder.findFirst({
    where: { id, tenantId: auth.user.tenantId },
    select: ORDER_DETAIL_SELECT,
  });
  if (!order) return jsonError(404, "Засварын хуудас олдсонгүй.");
  return jsonOk({ order });
}
