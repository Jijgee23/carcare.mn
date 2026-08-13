import {
  revokeOtherSessionsAction,
  revokeSessionAction,
} from "@/app/_actions/sessions";
import { PageHeader } from "@/app/_components/page-header";
import { getSession, requireUser } from "@/lib/auth";
import { userRoleLabel } from "@/lib/auth/roles";
import { deviceLabel, splitSessions } from "@/lib/auth/user-session";
import { prisma } from "@/lib/prisma";
import { PasswordForm } from "./password-form";
import { ProfileForm } from "./profile-form";

export const metadata = {
  title: "Профайл",
};

export default async function ProfilePage() {
  const user = await requireUser();
  const initials =
    ((user.firstName[0] ?? "") + (user.lastName[0] ?? "")).toUpperCase();

  const session = await getSession();
  const currentSid = session?.sid ?? null;
  const allSessions = await prisma.userSession.findMany({
    where: { userId: user.id },
    orderBy: { lastSeenAt: "desc" },
    take: 50,
    select: {
      id: true,
      userAgent: true,
      ip: true,
      createdAt: true,
      lastSeenAt: true,
      expiresAt: true,
      revokedAt: true,
    },
  });
  const {
    active: activeSessions,
    ended,
    otherActiveCount,
  } = splitSessions(allSessions, currentSid);
  const endedSessions = ended.slice(0, 10);

  return (
    <div className="p-4 sm:p-6 max-w-full flex-1 flex flex-col min-h-0 w-full">
      <PageHeader
        title="Профайл"
        description="Өөрийн мэдээлэл, нууц үгээ удирдах"
      />

      <div className="grid gap-4 lg:grid-cols-3 xl:grid-cols-4">
        {/* Профайл карт — sticky */}
        <aside className="lg:col-span-1">
          <div className="lg:sticky lg:top-6 flex flex-col gap-4">
            <div className="glass rounded-2xl overflow-hidden border border-white/[0.08]">
              <div className="h-20 bg-gradient-to-br from-violet-600/50 via-violet-500/25 to-blue-500/30" />
              <div className="px-5 pb-5">
                <div className="w-20 h-20 -mt-11 rounded-2xl bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center text-2xl font-bold ring-4 ring-[var(--surface)] shadow-lg">
                  {initials}
                </div>
                <h2 className="mt-3 font-bold text-base leading-tight">
                  {user.lastName} {user.firstName}
                </h2>
                <p className="text-xs text-white/40 mt-0.5 truncate">
                  {user.email}
                </p>
                <span
                  className={`mt-2.5 inline-block text-xs px-2.5 py-1 rounded-full ${
                    user.isOwner
                      ? "bg-violet-500/15 text-violet-300 border border-violet-500/30 light:text-violet-700"
                      : "bg-white/10 text-white/60 border border-white/15"
                  }`}
                >
                  {userRoleLabel(user)}
                </span>
              </div>
              <div className="grid grid-cols-2 border-t border-white/[0.06] divide-x divide-white/[0.06]">
                <Stat value={activeSessions.length} label="Идэвхтэй төхөөрөмж" />
                <Stat
                  value={user.createdAt.getFullYear()}
                  label="Элссэн он"
                />
              </div>
            </div>

            <div className="glass rounded-2xl p-4 border border-white/[0.08]">
              <dl className="space-y-2.5 text-sm">
                <Row label="Байгууллага" value={user.tenant.name} />
                {user.phone ? <Row label="Утас" value={user.phone} /> : null}
                <Row
                  label="Бүртгүүлсэн"
                  value={user.createdAt.toLocaleDateString("mn-MN")}
                />
              </dl>
            </div>
          </div>
        </aside>

        <div className="lg:col-span-2 xl:col-span-3 flex flex-col gap-4">
          <SectionCard
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            }
            title="Үндсэн мэдээлэл"
            desc="Нэр, имэйл, утас."
          >
            <ProfileForm
              initial={{
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                phone: user.phone,
              }}
            />
          </SectionCard>

          <SectionCard
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            }
            title="Нууц үг солих"
            desc="Аюулгүй байдлын үүднээс одоогийн нууц үгээ оруулна уу."
          >
            <PasswordForm />
          </SectionCard>

          <SectionCard
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <path d="M8 21h8M12 17v4" />
              </svg>
            }
            title="Нэвтэрсэн төхөөрөмжүүд"
            desc="Идэвхтэй нэвтрэлтүүдийг хараад, танихгүй төхөөрөмжийг гаргаж болно."
            action={
              otherActiveCount > 0 ? (
                <form action={revokeOtherSessionsAction}>
                  <button
                    type="submit"
                    className="shrink-0 text-xs text-red-300/80 hover:text-red-300 light:text-red-600 light:hover:text-red-700 border border-red-500/20 hover:bg-red-500/10 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Бусдыг гаргах ({otherActiveCount})
                  </button>
                </form>
              ) : null
            }
          >
            <div className="flex flex-col gap-2">
              {activeSessions.map((s) => {
                const isCurrent = s.id === currentSid;
                return (
                  <div
                    key={s.id}
                    className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5"
                  >
                    <div className="w-9 h-9 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-white/50 shrink-0">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="3" width="20" height="14" rx="2" />
                        <path d="M8 21h8M12 17v4" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-white/85 flex items-center gap-2">
                        {deviceLabel(s.userAgent)}
                        {isCurrent ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 light:text-emerald-700">
                            Энэ төхөөрөмж
                          </span>
                        ) : null}
                      </div>
                      <div className="text-xs text-white/40 tabular-nums">
                        {s.ip ?? "—"} · Сүүлд: {formatDateTime(s.lastSeenAt)}
                      </div>
                    </div>
                    <form action={revokeSessionAction}>
                      <input type="hidden" name="id" value={s.id} />
                      <button
                        type="submit"
                        className="shrink-0 text-xs text-white/50 hover:text-red-300 light:hover:text-red-600 border border-white/[0.1] hover:border-red-500/30 hover:bg-red-500/10 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        {isCurrent ? "Гарах" : "Гаргах"}
                      </button>
                    </form>
                  </div>
                );
              })}
            </div>

            {endedSessions.length > 0 ? (
              <div className="mt-5">
                <h3 className="text-xs font-medium text-white/40 light:text-slate-500 uppercase tracking-wider mb-2">
                  Түүх
                </h3>
                <div className="flex flex-col gap-1.5">
                  {endedSessions.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between gap-3 text-xs px-1 py-1"
                    >
                      <span className="text-white/55 truncate">
                        {deviceLabel(s.userAgent)} · {s.ip ?? "—"}
                      </span>
                      <span className="text-white/30 tabular-nums shrink-0">
                        {s.revokedAt ? "Гарсан" : "Хугацаа дууссан"} ·{" "}
                        {formatDateTime(s.revokedAt ?? s.expiresAt)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

function formatDateTime(d: Date): string {
  return d.toLocaleString("mn-MN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function SectionCard({
  icon,
  title,
  desc,
  action,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="glass rounded-2xl p-4 sm:p-5 border border-white/[0.08]">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-300 light:text-violet-700 shrink-0">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-sm">{title}</h2>
          <p className="text-xs text-white/40 mt-0.5">{desc}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="px-4 py-3 text-center">
      <div className="text-xl font-bold tabular-nums">{value}</div>
      <div className="text-[11px] text-white/40 mt-0.5">{label}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-white/40">{label}</dt>
      <dd className="text-white/80 truncate">{value}</dd>
    </div>
  );
}
