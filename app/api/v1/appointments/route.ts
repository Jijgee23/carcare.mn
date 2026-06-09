import { Prisma } from "@/app/generated/prisma/client";
import { jsonOk, requireApiUser, requirePermission } from "@/lib/api";
import { branchScopeId } from "@/lib/auth/roles";
import { APPOINTMENT_STATUSES, type AppointmentStatus } from "@/lib/appointments";
import { buildMeta, getApiPageInfo } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";

const APPT_SELECT = {
  id: true,
  status: true,
  requestedAt: true,
  note: true,
  createdAt: true,
  branch: { select: { id: true, name: true } },
  account: { select: { name: true, phone: true } },
  customer: { select: { id: true, fullName: true, phone: true } },
  accountVehicle: { select: { plate: true, make: true, model: true } },
  vehicle: { select: { id: true, plate: true, make: true, model: true } },
  serviceOrder: { select: { id: true, number: true } },
} satisfies Prisma.AppointmentSelect;

// GET /api/v1/appointments
// Query: status?, date? (YYYY-MM-DD), branchId?, page?, pageSize?
// Permission: appointments.view
export async function GET(req: Request) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;
  const denied = requirePermission(auth.user, "appointments.view");
  if (denied) return denied;

  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status")?.trim();
  const status =
    statusParam &&
    (APPOINTMENT_STATUSES as readonly string[]).includes(statusParam)
      ? (statusParam as AppointmentStatus)
      : null;
  const dateParam = url.searchParams.get("date")?.trim();
  const branchIdParam = url.searchParams.get("branchId")?.trim() || undefined;
  const { page, pageSize, skip, take } = getApiPageInfo(url.searchParams, {
    maxSize: 100,
  });

  // Салбараар хязгаарлагдсан ажилтан зөвхөн өөрийн салбарын захиалгыг харна.
  const scope = branchScopeId(auth.user);

  const where: Prisma.AppointmentWhereInput = {
    tenantId: auth.user.tenantId,
    ...(status ? { status } : {}),
    ...(scope
      ? { branchId: scope }
      : branchIdParam
        ? { branchId: branchIdParam }
        : {}),
  };

  if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    const dayStart = new Date(`${dateParam}T00:00:00`);
    if (Number.isFinite(dayStart.getTime())) {
      where.requestedAt = {
        gte: dayStart,
        lt: new Date(dayStart.getTime() + 86_400_000),
      };
    }
  }

  const [total, items] = await Promise.all([
    prisma.appointment.count({ where }),
    prisma.appointment.findMany({
      where,
      orderBy: { requestedAt: "asc" },
      skip,
      take,
      select: APPT_SELECT,
    }),
  ]);

  return jsonOk({
    appointments: items,
    pagination: buildMeta({ page, pageSize, total }),
  });
}
