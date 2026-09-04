"use client";

import { useEffect, useState } from "react";

const DEFAULT_COOLDOWN_SECONDS = 60;

/**
 * OTP "Код дахин илгээх" товчны UX cooldown — server талын жинхэнэ хамгаалалт
 * (lib/auth/otp.ts-ийн issueOtp/issuePhoneOtp, 10 минутад имэйл/утас тутамд 3
 * удаа) үүнээс үл хамааран тусад нь ажилладаг; энэ бол зөвхөн товчийг
 * дараачийн секундуудад дахин дарахаас сэргийлэх дэлгэцийн timer.
 */
export function useResendCountdown(seconds = DEFAULT_COOLDOWN_SECONDS) {
  const [secondsLeft, setSecondsLeft] = useState(seconds);

  useEffect(() => {
    const id = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return {
    secondsLeft,
    canResend: secondsLeft <= 0,
    reset: () => setSecondsLeft(seconds),
  };
}
