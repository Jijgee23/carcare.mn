import { Prisma } from "@/app/generated/prisma/client";
import { jsonError, jsonOk, requireApiUser, requirePermission } from "@/lib/api";
import { buildMeta, getApiPageInfo } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";

const ORDER_SELECT = {
  id: true,
  number: true,
  status: true,
  paymentStatus: true,
  scheduledAt: true,
  startedAt: true,
  completedAt: true,
  totalAmount: true,
  paidAmount: true,
  notes: true,
  createdAt: true,
  customer: { select: { id: true, fullName: true, phone: true } },
  vehicle: { select: { id: true, plate: true, make: true, model: true, year: true } },
  branch: { select: { id: true, name: true } },
  assignedTo: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.ServiceOrderSelect;

export async function GET(req: Request) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;

  const url = new URL(req.url);
  const status = url.searchParams.get("status")?.trim() || undefined;
  const branchId = url.searchParams.get("branchId")?.trim() || undefined;
  const vehicleId = url.searchParams.get("vehicleId")?.trim() || undefined;
  const customerId = url.searchParams.get("customerId")?.trim() || undefined;
  const { page, pageSize, skip, take } = getApiPageInfo(url.searchParams, {
    maxSize: 100,
  });

  const where: Prisma.ServiceOrderWhereInput = {
    tenantId: auth.user.tenantId,
    ...(status && { status: status as any }),
    ...(branchId && { branchId }),
    ...(vehicleId && { vehicleId }),
    ...(customerId && { customerId }),
  };

  const [orders, total] = await Promise.all([
    prisma.serviceOrder.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      select: ORDER_SELECT,
    }),
    prisma.serviceOrder.count({ where }),
  ]);

  return jsonOk({ orders, pagination: buildMeta(total, page, pageSize) });
}

export async function POST(req: Request) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;
  const denied = requirePermission(auth.user, "orders.create");
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "JSON body шаардлагатай.");
  }

  const b = body as Record<string, unknown>;
  const branchId = typeof b.branchId === "string" ? b.branchId.trim() : "";
  const customerId = typeof b.customerId === "string" ? b.customerId.trim() : "";
  const vehicleId = typeof b.vehicleId === "string" ? b.vehicleId.trim() : "";
  const assignedToId =
    typeof b.assignedToId === "string" ? b.assignedToId.trim() || null : null;
  const scheduledAt =
    typeof b.scheduledAt === "string" && b.scheduledAt
      ? new Date(b.scheduledAt)
      : null;
  const notes =
    typeof b.notes === "string" ? b.notes.trim() || null : null;

  const fieldErrors: Record<string, string> = {};
  if (!branchId) fieldErrors.branchId = "Салбар сонгоно уу.";
  if (!customerId) fieldErrors.customerId = "Үйлчлүүлэгчээ сонгоно уу.";
  if (!vehicleId) fieldErrors.vehicleId = "Машинаа сонгоно уу.";
  if (Object.keys(fieldErrors).length)
    return jsonError(422, "Хүсэлт буруу.", { fieldErrors });

  const [branch, customer, vehicle] = await Promise.all([
    prisma.branch.findFirst({
      where: { id: branchId, tenantId: auth.user.tenantId },
    }),
    prisma.customer.findFirst({
      where: { id: customerId, tenantId: auth.user.tenantId },
    }),
    prisma.vehicle.findFirst({
      where: { id: vehicleId, tenantId: auth.user.tenantId },
    }),
  ]);

  if (!branch)
    return jsonError(422, "Хүсэлт буруу.", {
      fieldErrors: { branchId: "Салбар олдсонгүй." },
    });
  if (!customer)
    return jsonError(422, "Хүсэлт буруу.", {
      fieldErrors: { customerId: "Үйлчлүүлэгч олдсонгүй." },
    });
  if (!vehicle)
    return jsonError(422, "Хүсэлт буруу.", {
      fieldErrors: { vehicleId: "Машин олдсонгүй." },
    });

  // Generate sequential order number per tenant
  const count = await prisma.serviceOrder.count({
    where: { tenantId: auth.user.tenantId },
  });
  const number = String(count + 1).padStart(5, "0");

  const order = await prisma.serviceOrder.create({
    data: {
      number,
      tenantId: auth.user.tenantId,
      branchId,
      customerId,
      vehicleId,
      ...(assignedToId && { assignedToId }),
      ...(scheduledAt && { scheduledAt }),
      ...(notes && { notes }),
    },
    select: ORDER_SELECT,
  });

  return jsonOk({ order }, { status: 201 });
}
