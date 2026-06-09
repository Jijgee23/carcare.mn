import { jsonError, jsonOk } from "@/lib/api";
import { getApiAccountFromRequest } from "@/lib/auth/account-api-token";
import { prisma } from "@/lib/prisma";

// DELETE /api/v1/app/vehicles/[id] — өөрийн машинаа устгах (auth).
export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const account = await getApiAccountFromRequest(req);
  if (!account) return jsonError(401, "Нэвтрэх шаардлагатай.");

  const { id } = await ctx.params;
  const res = await prisma.accountVehicle.deleteMany({
    where: { id, accountId: account.id },
  });
  if (res.count === 0) return jsonError(404, "Машин олдсонгүй.");
  return jsonOk({ ok: true });
}
