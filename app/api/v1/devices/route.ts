import { jsonError, jsonOk, requireApiUser } from "@/lib/api";
import { parseDeviceInput, registerDevice } from "@/lib/devices";

// POST /api/v1/devices — ажилтны (User) төхөөрөмж бүртгэх.
// { deviceId, platform, firebaseToken?, name?, model?, os? }
export async function POST(req: Request) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "JSON body шаардлагатай.");
  }
  const parsed = parseDeviceInput(body);
  if (!parsed.ok) return jsonError(400, parsed.error);

  const device = await registerDevice({ userId: auth.user.id }, parsed.data);
  return jsonOk({ device: { id: device.id, deviceId: device.deviceId } });
}
