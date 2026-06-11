import { jsonError, jsonOk, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;

  const { id } = await params;

  const notification = await prisma.notification.findFirst({
    where: { id, userId: auth.user.id },
  });
  if (!notification) return jsonError(404, "Мэдэгдэл олдсонгүй.");
  if (notification.readAt) return jsonOk({ ok: true });

  await prisma.notification.update({
    where: { id },
    data: { readAt: new Date() },
  });

  return jsonOk({ ok: true });
}
