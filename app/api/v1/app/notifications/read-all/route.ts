import { jsonError, jsonOk } from "@/lib/api";
import { getApiAccountFromRequest } from "@/lib/auth/account-api-token";
import { prisma } from "@/lib/prisma";

// POST /api/v1/app/notifications/read-all — бүх уншаагүйг уншсан болгоно.
export async function POST(req: Request) {
  const account = await getApiAccountFromRequest(req);
  if (!account) return jsonError(401, "Нэвтрэх шаардлагатай.");

  const result = await prisma.notification.updateMany({
    where: { accountId: account.id, readAt: null },
    data: { readAt: new Date() },
  });

  return jsonOk({ ok: true, count: result.count });
}
