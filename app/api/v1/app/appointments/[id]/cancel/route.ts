import { jsonError, jsonOk } from "@/lib/api";
import { getApiAccountFromRequest } from "@/lib/auth/account-api-token";
import { prisma } from "@/lib/prisma";

// POST /api/v1/app/appointments/[id]/cancel — өөрийн цагаа цуцлах (auth).
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const account = await getApiAccountFromRequest(req);
  if (!account) return jsonError(401, "Нэвтрэх шаардлагатай.");

  const { id } = await ctx.params;
  const appt = await prisma.appointment.findFirst({
    where: { id, accountId: account.id },
    select: { id: true, status: true },
  });
  if (!appt) return jsonError(404, "Цаг олдсонгүй.");
  if (appt.status !== "PENDING" && appt.status !== "CONFIRMED") {
    return jsonError(409, "Энэ цагийг цуцлах боломжгүй.");
  }

  await prisma.appointment.update({
    where: { id: appt.id },
    data: { status: "CANCELLED" },
  });
  return jsonOk({ ok: true });
}
