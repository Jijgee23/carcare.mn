/**
 * SMS илгээх — messagepro.mn (CallPro) gateway-аар.
 * Хэрэгтэй env:
 *   CALL_PRO_URL          - api endpoint (default: https://api.messagepro.mn/send)
 *   CALL_PRO_API_KEY      - x-api-key header
 *   CALL_PRO_SPECIAL_KEY  - "from" параметр
 */

import type { OtpType } from "@/lib/auth/otp";

// CallPro gateway нь баталгаажаагүй линк агуулсан текстийг 400 алдаа болгож
// буцаадаг тул брэндийн ".mn" TLD-ийг хасаж энгийн нэрээр илгээнэ.
const SMS_BRAND = "Carcare";

const SUBJECT_BY_TYPE: Record<OtpType, string> = {
  SIGNUP: "Бүртгэл баталгаажуулах",
  CHANGE_PASSWORD: "Нууц үг солих",
  RESET_PASSWORD: "Нууц үг сэргээх",
};

function normalizePhone(phone: string): string {
  return phone.replace(/\D+/g, "");
}

export async function sendOtpSms(
  code: string,
  type: OtpType,
  phone: string,
): Promise<boolean> {
  const apiUrl =
    process.env.CALL_PRO_URL ?? "https://api-text.callpro.mn/v1/sms/send";
  const apiKey = process.env.CALL_PRO_API_KEY ?? "10c2f933f9a9af1936b31c6ddcf59847";
  const from = process.env.CALL_PRO_SPECIAL_KEY ?? "72776399";
  if (!apiKey || !from) {
    // env тогтоогоогүй тохиолдолд илгээх боломжгүй — dev горимд анхааруулна
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `[sms] CALL_PRO_API_KEY / CALL_PRO_SPECIAL_KEY дутуу — код ${code}-ийг ${phone} рүү илгээхгүй.`,
      );
    }
    return false;
  }

  const to = normalizePhone(phone);
  if (!to) return false;

  const subject = SUBJECT_BY_TYPE[type];
  const text = `${SMS_BRAND}, ${subject} код ${code}`;

  // const url = new URL(`${apiUrl}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&text=${encodeURIComponent(text)}`);
  // url.searchParams.set("from", from);
  // url.searchParams.set("to", to);
  // url.searchParams.set("text", text);

  if (process.env.NODE_ENV !== "production") {
    console.debug(`[sms] Илгээх гэж байна: ${text} -> ${to}`);
  }
  const qs = new URLSearchParams({ from, to, text }).toString();
  try {
    const res = await fetch(`${apiUrl}?${qs}`, {
      method: "GET",
      headers: { "x-api-key": apiKey },
    });
    if (!res.ok) {
      console.error(`[sms] gateway алдаа ${res.status}: ${await res.text()}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[sms] илгээхэд алдаа:", e);
    return false;
  }
}
