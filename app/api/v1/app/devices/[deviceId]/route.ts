import { jsonError, jsonOk } from "@/lib/api";
import { getApiAccountFromRequest } from "@/lib/auth/account-api-token";
import { removeDevice } from "@/lib/devices";

// DELETE /api/v1/app/devices/[deviceId] — төхөөрөмжийг бүртгэлээс хасах.
export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ deviceId: string }> },
) {
  const account = await getApiAccountFromRequest(req);
  if (!account) return jsonError(401, "Нэвтрэх шаардлагатай.");

  const { deviceId } = await ctx.params;
  await removeDevice({ accountId: account.id }, deviceId);
  return jsonOk({ ok: true });
}
