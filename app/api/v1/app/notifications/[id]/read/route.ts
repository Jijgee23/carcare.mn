import { jsonError, jsonOk } from "@/lib/api";
import { getApiAccountFromRequest } from "@/lib/auth/account-api-token";
import { prisma } from "@/lib/prisma";

// PATCH /api/v1/app/notifications/:id/read — нэг мэдэгдлийг уншсан болгоно.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const account = await getApiAccountFromRequest(req);
  if (!account) return jsonError(401, "Нэвтрэх шаардлагатай.");

  const { id } = await params;

  // `accountId` шүүлтгүйгээр өөр хэрэглэгчийн (эсвэл ажилтны) мэдэгдлийг
  // id-гаар нь уншсан болгож болох тул энэ шалгалт заавал findFirst дээр байна
  // — `update({ where: { id } })` дангаараа хангалтгүй.
  const notification = await prisma.notification.findFirst({
    where: { id, accountId: account.id },
    select: { id: true, readAt: true },
  });
  if (!notification) return jsonError(404, "Мэдэгдэл олдсонгүй.");
  if (notification.readAt) return jsonOk({ ok: true });

  await prisma.notification.update({
    where: { id: notification.id },
    data: { readAt: new Date() },
  });

  return jsonOk({ ok: true });
}
