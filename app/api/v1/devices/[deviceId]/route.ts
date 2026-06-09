import { jsonOk, requireApiUser } from "@/lib/api";
import { removeDevice } from "@/lib/devices";

// DELETE /api/v1/devices/[deviceId] — ажилтны төхөөрөмжийг бүртгэлээс хасах.
export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ deviceId: string }> },
) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;

  const { deviceId } = await ctx.params;
  await removeDevice({ userId: auth.user.id }, deviceId);
  return jsonOk({ ok: true });
}
