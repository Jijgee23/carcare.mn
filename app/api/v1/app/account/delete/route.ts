import { enforceRateLimit, jsonError, jsonOk } from "@/lib/api";
import { deleteAccount } from "@/lib/account-closure/customer";
import { getApiAccountFromRequest } from "@/lib/auth/account-api-token";
import { verifyPhoneOtp } from "@/lib/auth/otp";

// POST /api/v1/app/account/delete  { code } — OTP-оор баталгаажуулж бүрмөсөн
// устгана (буцаагдахгүй). Account anonymize хийгдэж, tenant Customer бичлэг
// хадгалагдаад Account-аас салгагдана.
export async function POST(req: Request) {
  const account = await getApiAccountFromRequest(req); // sets bypass context
  if (!account) return jsonError(401, "Нэвтрэх шаардлагатай.");
  const limited = enforceRateLimit(req, "app-account-close", {
    limit: 10,
    windowMs: 10 * 60_000,
  });
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "JSON body шаардлагатай.");
  }
  const code =
    typeof (body as { code?: unknown })?.code === "string"
      ? (body as { code: string }).code.trim()
      : "";
  if (!/^\d{6}$/.test(code)) {
    return jsonError(400, "6 оронтой код шаардлагатай.");
  }

  const result = await verifyPhoneOtp({ phone: account.phone, type: "ACCOUNT_CLOSE", code });
  if (!result.ok) {
    return jsonError(422, "Код буруу эсвэл хугацаа дууссан.", { code: "OTP_INVALID" });
  }

  await deleteAccount(account.id);
  return jsonOk({ ok: true });
}
