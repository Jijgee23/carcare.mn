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

      <div className="grid gap-4 lg:grid-cols-3">
        <aside className="lg:col-span-1">
          <div className="glass rounded-xl p-4 sm:p-5 text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center text-xl font-bold">
              {initials}
            </div>
            <h2 className="mt-3 font-semibold text-sm">
              {user.lastName} {user.firstName}
            </h2>
            <p className="text-xs text-white/40 mt-0.5">{user.email}</p>
            <span
              className={`mt-2 inline-block text-xs px-2.5 py-1 rounded-full ${
                user.isOwner
                  ? "bg-violet-500/15 text-violet-300 border border-violet-500/30"
                  : "bg-white/10 text-white/60 border border-white/15"
              }`}
            >
              {userRoleLabel(user)}
            </span>
            <dl className="mt-4 space-y-2 text-left text-sm">
              <Row label="Байгууллага" value={user.tenant.name} />
              <Row
                label="Бүртгүүлсэн"
                value={user.createdAt.toLocaleDateString("mn-MN")}
              />
            </dl>
          </div>
        </aside>

        <div className="lg:col-span-2 flex flex-col gap-4">
          <section className="glass rounded-xl p-4 sm:p-5 border border-white/[0.08]">
            <h2 className="font-semibold text-sm mb-0.5">Үндсэн мэдээлэл</h2>
            <p className="text-xs text-white/40 mb-4">
              Нэр, имэйл, утас.
            </p>
            <ProfileForm
              initial={{
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                phone: user.phone,
              }}
            />
          </section>

          <section className="glass rounded-xl p-4 sm:p-5 border border-white/[0.08]">
            <h2 className="font-semibold text-sm mb-0.5">Нууц үг солих</h2>
            <p className="text-xs text-white/40 mb-4">
              Аюулгүй байдлын үүднээс одоогийн нууц үгээ оруулна уу.
            </p>
            <PasswordForm />
          </section>

          <section className="glass rounded-xl p-4 sm:p-5 border border-white/[0.08]">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="font-semibold text-sm mb-0.5">
                  Нэвтэрсэн төхөөрөмжүүд
                </h2>
                <p className="text-xs text-white/40">
                  Идэвхтэй нэвтрэлтүүдийг хараад, танихгүй төхөөрөмжийг гаргаж
                  болно.
                </p>
              </div>
              {otherActiveCount > 0 ? (
                <form action={revokeOtherSessionsAction}>
                  <button
                    type="submit"
                    className="shrink-0 text-xs text-red-300/80 hover:text-red-300 border border-red-500/20 hover:bg-red-500/10 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Бусдыг гаргах ({otherActiveCount})
                  </button>
                </form>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              {activeSessions.map((s) => {
                const isCurrent = s.id === currentSid;
                return (
                  <div
                    key={s.id}
                    className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-white/85 flex items-center gap-2">
                        {deviceLabel(s.userAgent)}
                        {isCurrent ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
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
                        className="shrink-0 text-xs text-white/50 hover:text-red-300 border border-white/[0.1] hover:border-red-500/30 hover:bg-red-500/10 px-3 py-1.5 rounded-lg transition-colors"
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
                <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2">
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
          </section>
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
  });
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-white/40">{label}</dt>
      <dd className="text-white/80 truncate">{value}</dd>
    </div>
  );
}
