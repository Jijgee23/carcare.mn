import { jsonOk, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;

  const result = await prisma.notification.updateMany({
    where: { userId: auth.user.id, readAt: null },
    data: { readAt: new Date() },
  });

  return jsonOk({ ok: true, count: result.count });
}
