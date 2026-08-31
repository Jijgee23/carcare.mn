import {
  revokeOtherSessionsAction,
  revokeSessionAction,
} from "@/app/_actions/sessions";
import { Btn, Chip } from "@/app/_components/landing-ops-ui";
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
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[var(--oc-ink)]">Профайл</h1>
        <p className="text-sm text-[var(--oc-muted3)] mt-1">
          Өөрийн мэдээлэл, нууц үгээ удирдах
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3 xl:grid-cols-4">
        {/* Профайл карт — sticky */}
        <aside className="lg:col-span-1">
          <div className="lg:sticky lg:top-6 flex flex-col gap-4">
            <div className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] overflow-hidden">
              <div className="h-20 bg-gradient-to-br from-[var(--oc-accent)]/40 via-[var(--oc-accent)]/15 to-transparent" />
              <div className="px-5 pb-5">
                <div className="w-20 h-20 -mt-11 rounded-2xl bg-gradient-to-br from-[var(--oc-accent)] to-[var(--oc-accent-hi)] flex items-center justify-center text-2xl font-bold text-[var(--oc-on-accent)] ring-4 ring-[var(--oc-panel)] shadow-lg">
                  {initials}
                </div>
                <h2 className="mt-3 font-bold text-base leading-tight text-[var(--oc-ink)]">
                  {user.lastName} {user.firstName}
                </h2>
                <p className="text-xs text-[var(--oc-muted3)] mt-0.5 truncate">
                  {user.email}
                </p>
                <div className="mt-2.5">
                  <Chip tone={user.isOwner ? "accent" : "neutral"} bordered>
                    {userRoleLabel(user)}
                  </Chip>
                </div>
              </div>
              <div className="grid grid-cols-2 border-t border-[var(--oc-line)] divide-x divide-[var(--oc-line)]">
                <Stat value={activeSessions.length} label="Идэвхтэй төхөөрөмж" />
                <Stat
                  value={user.createdAt.getFullYear()}
                  label="Элссэн он"
                />
              </div>
            </div>

            <div className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] p-4">
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
                  <Btn type="submit" variant="danger" size="sm">
                    Бусдыг гаргах ({otherActiveCount})
                  </Btn>
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
                    className="flex items-center gap-3 rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel2)] px-3 py-2.5"
                  >
                    <div className="w-9 h-9 rounded-lg bg-[var(--oc-panel)] border border-[var(--oc-line)] flex items-center justify-center text-[var(--oc-muted2)] shrink-0">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="3" width="20" height="14" rx="2" />
                        <path d="M8 21h8M12 17v4" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-[var(--oc-ink2)] flex items-center gap-2">
                        {deviceLabel(s.userAgent)}
                        {isCurrent ? (
                          <Chip tone="ok" bordered>Энэ төхөөрөмж</Chip>
                        ) : null}
                      </div>
                      <div className="font-plex-mono text-xs text-[var(--oc-muted3)] tabular-nums">
                        {s.ip ?? "—"} · Сүүлд: {formatDateTime(s.lastSeenAt)}
                      </div>
                    </div>
                    <form action={revokeSessionAction}>
                      <input type="hidden" name="id" value={s.id} />
                      <Btn type="submit" variant="ghost" size="sm">
                        {isCurrent ? "Гарах" : "Гаргах"}
                      </Btn>
                    </form>
                  </div>
                );
              })}
            </div>

            {endedSessions.length > 0 ? (
              <div className="mt-5">
                <h3 className="font-plex-mono text-[10.5px] font-medium text-[var(--oc-muted3)] uppercase tracking-[0.1em] mb-2">
                  Түүх
                </h3>
                <div className="flex flex-col gap-1.5">
                  {endedSessions.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between gap-3 text-xs px-1 py-1"
                    >
                      <span className="text-[var(--oc-muted2)] truncate">
                        {deviceLabel(s.userAgent)} · {s.ip ?? "—"}
                      </span>
                      <span className="font-plex-mono text-[var(--oc-muted4)] tabular-nums shrink-0">
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
    <section className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] p-4 sm:p-5">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-[var(--oc-accent)]/10 border border-[var(--oc-accent)]/25 flex items-center justify-center text-[var(--oc-accent)] shrink-0">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-sm text-[var(--oc-ink)]">{title}</h2>
          <p className="text-xs text-[var(--oc-muted3)] mt-0.5">{desc}</p>
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
      <div className="font-plex-mono text-xl font-bold tabular-nums text-[var(--oc-ink)]">{value}</div>
      <div className="text-[11px] text-[var(--oc-muted3)] mt-0.5">{label}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-[var(--oc-muted3)]">{label}</dt>
      <dd className="text-[var(--oc-ink2)] truncate">{value}</dd>
    </div>
  );
}
