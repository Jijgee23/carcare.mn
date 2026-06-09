import { Prisma } from "@/app/generated/prisma/client";
import { jsonError, jsonOk, requireApiUser, requirePermission } from "@/lib/api";
import { branchScopeId } from "@/lib/auth/roles";
import {
  APPOINTMENT_STATUS_TRANSITIONS,
  type AppointmentStatus,
  resolveCustomerForAccount,
  snapshotVehicleForAccount,
} from "@/lib/appointments";
import { logAudit } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";
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

// PATCH /api/v1/appointments/[id]
// Body: { status: AppointmentStatus }
// Permission: appointments.edit
// CONFIRMED шилжилт нь Account → Customer resolve + Vehicle snapshot хийнэ.
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;
  const denied = requirePermission(auth.user, "appointments.edit");
  if (denied) return denied;

  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "JSON body шаардлагатай.");
  }
  const newStatus =
    typeof (body as { status?: unknown }).status === "string"
      ? ((body as { status: string }).status as AppointmentStatus)
      : null;
  if (!newStatus) return jsonError(400, "status шаардлагатай.");

  const appt = await prisma.appointment.findFirst({
    where: { id, tenantId: auth.user.tenantId },
    include: {
      account: { select: { id: true, phone: true, name: true, email: true } },
      accountVehicle: {
        select: {
          plate: true,
          make: true,
          model: true,
          year: true,
          vin: true,
          fuelType: true,
          wheelPosition: true,
          mileage: true,
        },
      },
    },
  });
  if (!appt) return jsonError(404, "Цаг захиалга олдсонгүй.");

  // Салбараар хязгаарлагдсан ажилтан зөвхөн өөрийнхийг засна.
  const scope = branchScopeId(auth.user);
  if (scope && appt.branchId !== scope) {
    return jsonError(403, "Зөвхөн өөрийн салбарын цаг захиалгыг удирдана.");
  }

  const allowed =
    APPOINTMENT_STATUS_TRANSITIONS[appt.status as AppointmentStatus] ?? [];
  if (!allowed.includes(newStatus)) {
    return jsonError(
      409,
      `${appt.status} → ${newStatus} шилжилт боломжгүй.`,
    );
  }

  if (newStatus === "CONFIRMED") {
    // Онлайн захиалга (Account-той) л баталгаажуулна.
    // Phone-in захиалга CONFIRMED-ээр үүсдэг тул энд хүрэхгүй.
    if (!appt.account) {
      return jsonError(400, "Онлайн бус захиалгыг энэ замаар баталгаажуулах боломжгүй.");
    }
    const account = appt.account;
    await prisma.$transaction(async (tx) => {
      const customerId = await resolveCustomerForAccount(
        tx,
        appt.tenantId,
        account,
      );
      let vehicleId: string | null = null;
      if (appt.accountVehicle) {
        vehicleId = await snapshotVehicleForAccount(
          tx,
          appt.tenantId,
          customerId,
          appt.accountVehicle,
        );
      }
      await tx.appointment.update({
        where: { id: appt.id },
        data: {
          status: "CONFIRMED",
          customerId,
          vehicleId,
          respondedAt: new Date(),
          respondedById: auth.user.id,
        },
      });
      await logAudit(
        {
          tenantId: appt.tenantId,
          userId: auth.user.id,
          branchId: appt.branchId,
          entity: "Appointment",
          entityId: appt.id,
          action: "STATUS_CHANGE",
          summary: "Цаг баталгаажуулсан (мобайл)",
          after: { status: "CONFIRMED", customerId, vehicleId },
        },
        tx,
      );
    });
    try {
      await createNotification({
        type: "appointment_confirmed",
        recipient: { accountId: account.id },
        input: { appointmentId: appt.id },
      });
    } catch (e) {
      console.warn("[notify] confirmAppointment (mobile):", e);
    }
  } else {
    await prisma.appointment.update({
      where: { id: appt.id },
      data: {
        status: newStatus,
        respondedAt: new Date(),
        respondedById: auth.user.id,
      },
    });
    await logAudit({
      tenantId: appt.tenantId,
      userId: auth.user.id,
      branchId: appt.branchId,
      entity: "Appointment",
      entityId: appt.id,
      action: "STATUS_CHANGE",
      summary: `Цаг → ${newStatus} (мобайл)`,
      after: { status: newStatus },
    });
    // Онлайн захиалга татгалзсан бол хэрэглэгчид мэдэгдэнэ.
    if (newStatus === "REJECTED" && appt.account) {
      try {
        await createNotification({
          type: "appointment_rejected",
          recipient: { accountId: appt.account.id },
          input: { appointmentId: appt.id },
        });
      } catch (e) {
        console.warn("[notify] rejectAppointment (mobile):", e);
      }
    }
  }

  const updated = await prisma.appointment.findUnique({
    where: { id },
    select: APPT_SELECT,
  });
  return jsonOk({ appointment: updated });
}
