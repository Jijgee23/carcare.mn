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

/**
 * SuperAdmin (`/system/feedback/[id]`) болон tenant (`/dashboard/feedback/[id]`)
 * хоёулаа хуваалцах харилцан ярианы жагсаалт.
 */
export function FeedbackThread({ messages }: { messages: FeedbackThreadMessage[] }) {
  if (messages.length === 0) return null;
  return (
    <div className="mt-5 flex flex-col gap-3">
      {messages.map((m) => (
        <div
          key={m.id}
          className={`rounded-xl border p-4 ${
            m.author === "ADMIN"
              ? "border-violet-500/20 bg-violet-500/[0.06]"
              : "border-white/[0.08] bg-white/[0.02]"
          }`}
        >
          <div
            className={`text-xs ${
              m.author === "ADMIN"
                ? "text-violet-300 light:text-violet-700"
                : "text-white/40"
            }`}
          >
            {m.author === "ADMIN" ? "Админ" : "Илгээгч"} · {fmt(m.createdAt)}
          </div>
          <p className="mt-1 whitespace-pre-wrap text-sm text-white/80">{m.message}</p>
        </div>
      ))}
    </div>
  );
}
