import { enforceRateLimit, jsonError, jsonOk } from "@/lib/api";
import { issueOtp } from "@/lib/auth/otp";
import { maskPhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { sendOtpSms } from "@/lib/sms";

/**
 * POST /api/v1/auth/activate/request-otp  { email } → идэвхжүүлэх OTP дахин илгээх
 *
 * Веб дэх requestActivationAction-ийн мобайл хувилбар. Идэвхжүүлэх дэлгэц дэх
 * "Код дахин илгээх" товчинд зориулсан.
 *
 * Enumeration-safe: бүртгэлгүй / аль хэдийн идэвхжсэн имэйлд ч ерөнхий
 * "илгээгдсэн" хариу буцаана. OTP нь зөвхөн идэвхжээгүй жинхэнэ ажилтанд л
 * илгээгдэнэ. Хэт олон хүсэлтэд issueOtp throttle 429 буцаана.
 */
export async function POST(req: Request) {
  const limited = enforceRateLimit(req, "api-activate-otp", {
    limit: 5,
    windowMs: 60_000,
  });
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "Body нь JSON байх ёстой.");
  }
  const { email } = (body ?? {}) as { email?: unknown };
  if (typeof email !== "string") {
    return jsonError(400, "Имэйлээ текстээр илгээнэ үү.");
  }
  const normalizedEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return jsonError(400, "Имэйл хаяг буруу.");
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, phone: true, verified: true },
  });

  if (user && !user.verified) {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      null;
    try {
      const { code } = await issueOtp({
        email: normalizedEmail,
        type: "SET_PASSWORD",
        userId: user.id,
        userAgent: req.headers.get("user-agent"),
        ip,
      });
      await sendOtpSms(code, "SET_PASSWORD", user.phone);
    } catch (e) {
      return jsonError(
        429,
        e instanceof Error ? e.message : "Код илгээхэд алдаа гарлаа.",
      );
    }
    return jsonOk({
      sent: true,
      maskedPhone: maskPhone(user.phone),
      message: "Бүртгэлтэй утсанд 6 оронтой код илгээлээ.",
    });
  }

  // Бүртгэлгүй эсвэл аль хэдийн идэвхжсэн — enumeration-аас сэргийлж ерөнхий хариу.
  return jsonOk({
    sent: true,
    maskedPhone: "**",
    message: "Хэрэв энэ имэйл идэвхжээгүй бүртгэлтэй бол утсанд код илгээгдсэн.",
  });
}
