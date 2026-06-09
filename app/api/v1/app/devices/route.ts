import { jsonError, jsonOk } from "@/lib/api";
import { getApiAccountFromRequest } from "@/lib/auth/account-api-token";
import { parseDeviceInput, registerDevice } from "@/lib/devices";

// POST /api/v1/app/devices — хэрэглэгчийн төхөөрөмж (FCM token + meta) бүртгэх.
// { deviceId, platform, firebaseToken?, name?, model?, os? }
export async function POST(req: Request) {
  const account = await getApiAccountFromRequest(req);
  if (!account) return jsonError(401, "Нэвтрэх шаардлагатай.");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "JSON body шаардлагатай.");
  }
  const parsed = parseDeviceInput(body);
  if (!parsed.ok) return jsonError(400, parsed.error);

  const device = await registerDevice({ accountId: account.id }, parsed.data);
  return jsonOk({ device: { id: device.id, deviceId: device.deviceId } });
}
