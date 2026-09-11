// S13 Phase 4: detailed affected-bookings preview, replacing the old
// count-only banner/error string. Shared by the branch hours form
// (app/dashboard/branches/branch-form.tsx) and the exception/season forms
// (app/dashboard/branches/[id]/schedule/schedule-manager.tsx) so all three
// schedule-mutation flows render the same shape.
import type { ScheduleImpact, ScheduleImpactKind } from "@/lib/branch-schedule-impact";

const KIND_LABEL: Record<ScheduleImpactKind, string> = {
  APPOINTMENT: "Цаг захиалга",
  ORDER_TIME_BOOKING: "Захиалгын цагийн блок",
};

function fmtWhen(d: Date): string {
  return new Date(d).toLocaleString("mn-MN", { dateStyle: "medium", timeStyle: "short" });
}

function fmtDuration(minutes: number | null): string {
  if (minutes == null || minutes <= 0) return "тодорхойгүй";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m}м`;
  return m ? `${h}ц${m}м` : `${h}ц`;
}

/**
 * Renders a ScheduleImpact (see lib/branch-schedule-impact.ts) as a grouped,
 * human-readable list — erased (no longer fits at all, needs rescheduling)
 * first, clipped (shortened but still valid) second. Duration fields are
 * shown before/after using the S13 Phase 5 original-* snapshot columns when
 * available; `null` (pre-migration rows) falls back to "тодорхойгүй".
 */
export function ScheduleImpactPreview({ impact }: { impact: ScheduleImpact }) {
  if (impact.erased.length === 0 && impact.clipped.length === 0) return null;
  return (
    <div className="space-y-3 rounded-[10px] border border-[var(--oc-warn)]/30 bg-[var(--oc-warn)]/10 px-4 py-3 text-sm">
      {impact.erased.length > 0 ? (
        <div>
          <p className="font-medium text-red-600">
            {impact.erased.length} захиалга шинэ хуваарьт огт багтахгүй болно — эхлээд ажилтан гараар шийдвэрлэх шаардлагатай:
          </p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[var(--oc-ink)]">
            {impact.erased.map((item) => (
              <li key={`erased-${item.kind}-${item.id}`}>
                {KIND_LABEL[item.kind] ?? item.kind} · {fmtWhen(item.requestedAt)}
                {" — "}анх {fmtDuration(item.originalDurationMinutes)} товлогдсон, дахин товлох шаардлагатай
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {impact.clipped.length > 0 ? (
        <div>
          <p className="font-medium text-[var(--oc-warn)]">
            {impact.clipped.length} захиалгын үргэлжлэх хугацаа шинэ хаах цагт таарч богиносно:
          </p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[var(--oc-ink)]">
            {impact.clipped.map((item) => (
              <li key={`clipped-${item.kind}-${item.id}`}>
                {KIND_LABEL[item.kind] ?? item.kind} · {fmtWhen(item.requestedAt)}
                {" — "}анх {fmtDuration(item.originalDurationMinutes)}, одоо {fmtDuration(item.durationMinutes)} болно
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
