import { enforceRateLimit, jsonError, jsonOk, requireApiUser } from "@/lib/api";
import { issueOtp } from "@/lib/auth/otp";
import { maskPhone } from "@/lib/phone";
import { sendOtpSms } from "@/lib/sms";

// POST /api/v1/me/close/request-otp  {} — deactivate/delete-д зориулсан
// ACCOUNT_CLOSE OTP-г auth.user.email-ээр (имэйл-keyed) үүсгэж, ажилтны
// бүртгэлтэй утсанд SMS-ээр илгээнэ (app/api/v1/auth/activate/request-otp
// шиг). Зөвхөн auth.user.id дээр ажиллана.
export async function POST(req: Request) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;

  const limited = enforceRateLimit(req, "me-account-close-otp", {
    limit: 5,
    windowMs: 10 * 60_000,
  });
  if (limited) return limited;

  const userAgent = req.headers.get("user-agent");
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null;

  try {
    const { code } = await issueOtp({
      email: auth.user.email,
      type: "ACCOUNT_CLOSE",
      userId: auth.user.id,
      userAgent,
      ip,
    });
    await sendOtpSms(code, "ACCOUNT_CLOSE", auth.user.phone);
  } catch (e) {
    return jsonError(429, e instanceof Error ? e.message : "Код илгээхэд алдаа.");
  }

  return jsonOk({ ok: true, maskedPhone: maskPhone(auth.user.phone) });
}
