"use client";

import { useResendCountdown } from "./use-resend-countdown";

const DEFAULT_CLASS =
  "text-center text-xs text-[var(--oc-accent)] hover:text-[var(--oc-accent-hi)] disabled:text-[var(--oc-muted3)] disabled:cursor-not-allowed disabled:hover:text-[var(--oc-muted3)] transition-colors";

/** OTP шаардсан бүх урсгалд (нэвтрэх, идэвхжүүлэх, нууц үг сэргээх) адилхан
    ашиглах "Код дахин илгээх" товч — cooldown-той, дарахад `onResend`-ийг дуудна. */
export function ResendOtpButton({
  pending,
  onResend,
  className = DEFAULT_CLASS,
}: {
  pending: boolean;
  onResend: () => void;
  className?: string;
}) {
  const { secondsLeft, canResend, reset } = useResendCountdown();

  return (
    <button
      type="button"
      disabled={pending || !canResend}
      onClick={() => {
        reset();
        onResend();
      }}
      className={className}
    >
      {canResend
        ? "Код дахин илгээх"
        : `Код дахин илгээх (${secondsLeft}с)`}
    </button>
  );
}
