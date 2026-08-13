"use client";

import { useEffect, useState } from "react";
import { formatDaysLeft } from "@/lib/subscription";

/* toLocaleString нь server/client дээр өөр гарч hydration зөрүү үүсгэж
   болзошгүй тул тогтмол форматаар (YYYY-MM-DD HH:mm) гаргана. */
function formatDateTime(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * Дашбордын дээд талын subscription сэрэмжлүүлэг — нам, нэг мөрт. Төлвүүд:
 *  - locked: идэвхтэй багц алга → улаан, "хугацаа дууссан" (dismiss хийгдэхгүй).
 *  - trial: туршилт идэвхтэй → daysLeft <= 3 бол улаан, эс бөгөөс шар. Хаагдана.
 *  - expiringSoon: төлбөртэй багц удахгүй дуусна → шар. Хаагдана.
 *  - бусад тохиолдолд харагдахгүй.
 * Хаасан төлөв sessionStorage-д хадгалагдана — дараагийн session-д дахин гарна.
 */
export function SubscriptionBanner({
  locked,
  isTrial,
  daysLeft,
  expiresAt,
  expiringSoon,
  hasPendingPayment,
  isOwner,
}: {
  locked: boolean;
  isTrial: boolean;
  daysLeft: number;
  expiresAt: Date | null;
  expiringSoon: boolean;
  hasPendingPayment: boolean;
  isOwner: boolean;
}) {
  if (locked) {
    return (
      <BannerShell
        urgent
        title="Багцын хугацаа дууссан"
        detail={
          hasPendingPayment
            ? "Төлбөр хүлээгдэж байна. Төлбөрөө хийсэн бол “Багц харах” дээр дарж шалгана уу."
            : isOwner
              ? "Зөвхөн харах горимд шилжлээ. Үргэлжлүүлэхийн тулд багцаа сунгана уу."
              : "Зөвхөн харах горимд шилжлээ. Байгууллагын админд хандаж багцаа сунгуулна уу."
        }
      />
    );
  }

  if (isTrial) {
    return (
      /* Сануулгын тон — улааныг зөвхөн түгжигдсэн (locked) төлөвт үлдээнэ */
      <BannerShell
        urgent={false}
        dismissKey="trial"
        title={`Туршилтын хувилбар — ${formatDaysLeft(daysLeft)}`}
        detail={
          expiresAt
            ? `Хугацаа дуусах: ${formatDateTime(expiresAt)}`
            : undefined
        }
      />
    );
  }

  if (expiringSoon) {
    return (
      <BannerShell
        urgent={false}
        dismissKey="expiring"
        title={`Багц удахгүй дуусна — ${formatDaysLeft(daysLeft)}`}
        detail={
          expiresAt
            ? `Хугацаа дуусах: ${formatDateTime(expiresAt)}. Урьдчилан сунгана уу.`
            : undefined
        }
      />
    );
  }

  return null;
}

function BannerShell({
  urgent,
  title,
  detail,
  dismissKey,
}: {
  urgent: boolean;
  title: string;
  detail?: string;
  dismissKey?: string;
}) {
  const storageKey = dismissKey ? `sub-banner-dismissed:${dismissKey}` : null;
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (storageKey && sessionStorage.getItem(storageKey)) setHidden(true);
  }, [storageKey]);

  if (hidden) return null;

  return (
    <div className="px-4 sm:px-6 lg:px-8 pt-3">
      <div
        className={`flex items-center gap-3 rounded-xl border px-3.5 py-2 ${
          urgent
            ? "border-red-500/30 bg-red-500/[0.08] text-red-200 light:border-red-300 light:bg-red-50 light:text-red-700"
            : "border-amber-500/30 bg-amber-500/[0.08] text-amber-200 light:border-amber-300 light:bg-amber-50 light:text-amber-800"
        }`}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <div className="min-w-0 flex-1 truncate text-sm">
          <span className="font-medium">{title}</span>
          {detail ? (
            <span className="hidden md:inline text-xs opacity-75 ml-2">
              {detail}
            </span>
          ) : null}
        </div>
        <a
          href="/dashboard/settings/subscription"
          className="shrink-0 inline-flex items-center justify-center rounded-lg bg-white/[0.06] hover:bg-white/[0.12] transition-colors px-2.5 py-1 text-xs font-medium"
        >
          Багц харах →
        </a>
        {storageKey ? (
          <button
            type="button"
            aria-label="Хаах"
            onClick={() => {
              sessionStorage.setItem(storageKey, "1");
              setHidden(true);
            }}
            className="shrink-0 w-6 h-6 rounded-lg flex items-center justify-center opacity-60 hover:opacity-100 hover:bg-white/[0.08] transition-all"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        ) : null}
      </div>
    </div>
  );
}
