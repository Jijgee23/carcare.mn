export type FeedbackThreadMessage = {
  id: string;
  author: "ADMIN" | "SUBMITTER";
  message: string;
  createdAt: Date;
};

function fmt(d: Date): string {
  return d.toLocaleString("mn-MN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

const ADMIN_BUBBLE_TONE = {
  accent: {
    box: "border-[var(--oc-accent)]/20 bg-[var(--oc-accent)]/[0.06]",
    label: "text-[var(--oc-accent)]",
  },
  danger: {
    box: "border-red-500/20 bg-red-500/[0.06]",
    label: "text-red-300 light:text-red-700",
  },
} as const;

/**
 * SuperAdmin (`/system/feedback/[id]`) болон tenant (`/dashboard/feedback/[id]`)
 * хоёулаа хуваалцах харилцан ярианы жагсаалт. `tone` — ADMIN мессежийн өнгө:
 * dashboard-д амбер (`accent`, дефолт), system-д улаан (`danger`).
 */
export function FeedbackThread({
  messages,
  tone = "accent",
}: {
  messages: FeedbackThreadMessage[];
  tone?: keyof typeof ADMIN_BUBBLE_TONE;
}) {
  if (messages.length === 0) return null;
  const adminTone = ADMIN_BUBBLE_TONE[tone];
  return (
    <div className="mt-5 flex flex-col gap-3">
      {messages.map((m) => (
        <div
          key={m.id}
          className={`rounded-xl border p-4 ${
            m.author === "ADMIN"
              ? adminTone.box
              : "border-[var(--oc-line2)] bg-[var(--oc-panel2)]"
          }`}
        >
          <div
            className={`text-xs ${
              m.author === "ADMIN" ? adminTone.label : "text-[var(--oc-muted3)]"
            }`}
          >
            {m.author === "ADMIN" ? "Админ" : "Илгээгч"} · {fmt(m.createdAt)}
          </div>
          <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--oc-ink2)]">{m.message}</p>
        </div>
      ))}
    </div>
  );
}
