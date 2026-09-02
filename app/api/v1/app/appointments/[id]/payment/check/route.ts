import { jsonError, jsonOk } from "@/lib/api";
import { confirmAppointmentPayment } from "@/lib/appointment-payments";
import { getApiAccountFromRequest } from "@/lib/auth/account-api-token";
import { prisma } from "@/lib/prisma";

// POST /api/v1/app/appointments/[id]/payment/check — QPay-аас төлбөр
// баталгаажсан эсэхийг шалгана (polling). Бүрэн төлөгдсөн бол ЭНД анх удаа
// Invoice үүсч, тенант рүү мэдэгдэл очно. Дахин дуудсан ч idempotent.
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const account = await getApiAccountFromRequest(req);
  if (!account) return jsonError(401, "Нэвтрэх шаардлагатай.");

  const { id } = await ctx.params;
  const appt = await prisma.appointment.findFirst({
    where: { id, accountId: account.id },
    select: { id: true },
  });
  if (!appt) return jsonError(404, "Цаг олдсонгүй.");

  const result = await confirmAppointmentPayment(appt.id);
  if (!result.ok) return jsonError(422, result.message ?? "Шалгах боломжгүй.");
  return jsonOk({
    paid: result.paid,
    underpaidAmount: result.underpaidAmount ?? null,
    message: result.message ?? null,
  });
}
