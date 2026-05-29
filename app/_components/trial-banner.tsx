import {
  formatDaysLeft,
  type ActiveSubscriptionInfo,
} from "@/lib/subscription";

/**
 * FREE / TRIAL багц дээр байгаа тенант бүх хуудсанд дашбордын дээд талд
 * "хэдэн хоног үлдсэн" сэрэмжлүүлэг харуулна. Хугацаа дууссан үед яаралтай
 * улаан banner-аар "багц шинэчлэх" заавар гаргана. ACTIVE багц дээр харагдахгүй.
 */
export function TrialBanner({
  active,
  plan,
}: {
  active: ActiveSubscriptionInfo | null;
  plan: "FREE" | "BUSINESS" | "ENTERPRISE";
}) {
  // Туршилт идэвхтэй
  if (active?.isTrial) {
    const daysLeft = Math.max(0, active.daysLeft);
    const phrase = formatDaysLeft(active.daysLeft);
    const urgent = daysLeft <= 3;
    return (
      <BannerShell urgent={urgent}>
        <div className="font-medium">Туршилтын хувилбар — {phrase}</div>
        {active.expiresAt ? (
          <div className="text-xs opacity-80">
            Хугацаа дуусах: {active.expiresAt.toLocaleString("mn-MN")}
          </div>
        ) : null}
      </BannerShell>
    );
  }

  // Туршилт ч биш, үнэтэй ч биш — FREE багцанд байгаа гэхдээ идэвхтэй sub алга
  // (туршилт дууссан, эсвэл цуцлагдсан) — яаралтай улаан banner.
  if (plan === "FREE" && !active) {
    return (
      <BannerShell urgent>
        <div className="font-medium">Туршилтын хугацаа дууссан</div>
        <div className="text-xs opacity-80">
          Үргэлжлүүлэн ашиглахын тулд багцаа шинэчилнэ үү.
        </div>
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
    <div className="px-6 sm:px-8 pt-4">
      <div
        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-2xl border px-4 py-3 text-sm ${
          urgent
            ? "border-red-500/30 bg-red-500/[0.08] text-red-200"
            : "border-amber-500/30 bg-amber-500/[0.08] text-amber-200"
        }`}
      >
        <div className="flex items-center gap-3">
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
          <div>{children}</div>
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
