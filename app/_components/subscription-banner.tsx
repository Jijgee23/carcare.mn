import { formatDaysLeft } from "@/lib/subscription";

/**
 * Дашбордын дээд талын subscription сэрэмжлүүлэг. Төлвүүд:
 *  - locked: идэвхтэй багц алга → улаан, "хугацаа дууссан" (read-only).
 *  - trial: туршилт идэвхтэй → daysLeft <= 3 бол улаан, эс бөгөөс шар.
 *  - expiringSoon: төлбөртэй багц удахгүй дуусна → шар.
 *  - бусад тохиолдолд харагдахгүй.
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
      <BannerShell urgent>
        <div className="font-medium">Багцын хугацаа дууссан</div>
        <div className="text-xs opacity-80">
          {hasPendingPayment
            ? "Төлбөр хүлээгдэж байна. Төлбөрөө хийсэн бол “Багц харах” дээр дарж шалгана уу."
            : isOwner
              ? "Зөвхөн харах горимд шилжлээ. Үргэлжлүүлэхийн тулд багцаа сунгана уу."
              : "Зөвхөн харах горимд шилжлээ. Байгууллагын админд хандаж багцаа сунгуулна уу."}
        </div>
      </BannerShell>
    );
  }

  if (isTrial) {
    const left = Math.max(0, daysLeft);
    return (
      <BannerShell urgent={left <= 3}>
        <div className="font-medium">
          Туршилтын хувилбар — {formatDaysLeft(daysLeft)}
        </div>
        {expiresAt ? (
          <div className="text-xs opacity-80">
            Хугацаа дуусах: {expiresAt.toLocaleString("mn-MN")}
          </div>
        ) : null}
      </BannerShell>
    );
  }

  if (expiringSoon) {
    return (
      <BannerShell urgent={Math.max(0, daysLeft) <= 3}>
        <div className="font-medium">Багц удахгүй дуусна — {formatDaysLeft(daysLeft)}</div>
        {expiresAt ? (
          <div className="text-xs opacity-80">
            Хугацаа дуусах: {expiresAt.toLocaleString("mn-MN")}. Тасралтгүй
            ажиллахын тулд урьдчилан сунгана уу.
          </div>
        ) : null}
      </BannerShell>
    );
  }

  return null;
}

function BannerShell({
  urgent,
  children,
}: {
  urgent: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="px-4 sm:px-6 lg:px-8 pt-4">
      <div
        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-2xl border px-4 py-3 text-sm ${
          urgent
            ? "border-red-500/30 bg-red-500/[0.08] text-red-200"
            : "border-amber-500/30 bg-amber-500/[0.08] text-amber-200"
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div className="min-w-0">{children}</div>
        </div>
        <a
          href="/dashboard/settings/subscription"
          className="shrink-0 inline-flex items-center justify-center rounded-xl bg-white/[0.06] hover:bg-white/[0.12] transition-colors px-3 py-1.5 text-xs font-medium"
        >
          Багц харах →
        </a>
      </div>
    </div>
  );
}
