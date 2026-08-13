import Link from "next/link";
import { cancelAppointmentByAccount } from "@/app/_actions/appointments";
import { WebPushToggle } from "@/app/_components/web-push";
import {
  APPOINTMENT_STATUS_BADGE,
  APPOINTMENT_STATUS_LABEL,
} from "@/lib/appointments";
import { requireAccount } from "@/lib/auth/account";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Миний цаг",
};

export const dynamic = "force-dynamic";

const WD_MN: Record<string, string> = {
  Mon: "Даваа",
  Tue: "Мягмар",
  Wed: "Лхагва",
  Thu: "Пүрэв",
  Fri: "Баасан",
  Sat: "Бямба",
  Sun: "Ням",
};

// Огноог Монголын цагаар хэсэгчлэн (огноо/цаг/гараг) буцаана.
function dateParts(d: Date): { date: string; time: string; weekday: string } {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Ulaanbaatar",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
      hourCycle: "h23",
    })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return {
    date: `${p.day}/${p.month}`,
    time: `${p.hour}:${p.minute}`,
    weekday: WD_MN[p.weekday as string] ?? "",
  };
}

export default async function AccountPage() {
  const account = await requireAccount();

  const appointments = await prisma.appointment.findMany({
    where: { accountId: account.id },
    orderBy: { requestedAt: "desc" },
    include: {
      tenant: { select: { name: true, slug: true } },
      branch: { select: { name: true } },
      category: { select: { name: true } },
    },
  });

  // Идэвхтэй (хүлээгдэж буй/баталгаажсан) цагуудыг түрүүлж, ойрын нь дээр.
  const ACTIVE = new Set(["PENDING", "CONFIRMED"]);
  const sortedAppts = [...appointments].sort((x, y) => {
    const ax = ACTIVE.has(x.status) ? 0 : 1;
    const ay = ACTIVE.has(y.status) ? 0 : 1;
    if (ax !== ay) return ax - ay;
    const dx = x.requestedAt.getTime();
    const dy = y.requestedAt.getTime();
    return ax === 0 ? dx - dy : dy - dx; // идэвхтэй: ойрын нь; өмнөх: сүүлийн нь
  });

  return (
    <div className="w-full flex flex-col gap-3.5">
      {/* Шинэ цаг захиалах */}
      <Link
        href="/discover"
        className="flex w-xs items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 transition-colors px-4 py-2.5 rounded-xl text-sm font-semibold"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Шинэ цаг захиалах
      </Link>

      {/* Push мэдэгдэл */}
      <section className="glass rounded-xl p-3 border border-white/[0.08] flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-white/85">Push мэдэгдэл</div>
          <div className="text-xs text-white/40">
            Цаг баталгаажих, сануулгыг энэ төхөөрөмж дээр авах.
          </div>
        </div>
        <WebPushToggle target="account" />
      </section>

      {/* Цагууд */}
      <div>
        <h1 className="font-semibold text-white/80 text-sm mb-2">
          Миний цагууд
          {sortedAppts.length > 0 ? (
            <span className="text-white/35 font-normal"> · {sortedAppts.length}</span>
          ) : null}
        </h1>

        {sortedAppts.length === 0 ? (
          <div className="glass rounded-2xl p-8 border border-white/[0.08] text-center">
            <p className="text-sm text-white/40">
              Та одоогоор цаг захиалаагүй байна.
            </p>
            <Link
              href="/discover"
              className="inline-block mt-2 text-sm text-violet-300 hover:text-violet-200 light:text-violet-700 light:hover:text-violet-800"
            >
              Автосервис сонгож цаг захиалах →
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {sortedAppts.map((a) => {
              const canCancel =
                a.status === "PENDING" || a.status === "CONFIRMED";
              const dt = dateParts(a.requestedAt);
              return (
                <div
                  key={a.id}
                  className={`glass rounded-xl p-3 border border-white/[0.08] flex items-stretch gap-3 ${canCancel ? "" : "opacity-70"
                    }`}
                >
                  {/* Огнооны chip */}
                  <div className="shrink-0 w-14 rounded-lg bg-white/[0.04] border border-white/[0.06] flex flex-col items-center justify-center py-1.5">
                    <div className="text-sm font-bold tabular-nums leading-tight">
                      {dt.time}
                    </div>
                    <div className="text-[11px] text-white/40 tabular-nums">
                      {dt.date}
                    </div>
                  </div>

                  <div className="min-w-0 flex-1 flex flex-col justify-center">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/org/${a.tenant.slug}`}
                        className="font-semibold text-white/90 hover:text-violet-300 light:hover:text-violet-700 transition-colors truncate"
                      >
                        {a.tenant.name}
                      </Link>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${APPOINTMENT_STATUS_BADGE[a.status]}`}
                      >
                        {APPOINTMENT_STATUS_LABEL[a.status]}
                      </span>
                    </div>
                    <div className="text-xs text-white/45 mt-0.5">
                      {dt.weekday} · {a.branch.name}
                      {a.category ? ` · ${a.category.name}` : ""}
                    </div>
                    {a.note ? (
                      <div className="text-xs text-white/35 mt-0.5 truncate">
                        {a.note}
                      </div>
                    ) : null}
                  </div>

                  {canCancel ? (
                    <form
                      action={cancelAppointmentByAccount}
                      className="shrink-0 flex items-center"
                    >
                      <input type="hidden" name="id" value={a.id} />
                      <button
                        type="submit"
                        className="text-xs text-red-300/80 hover:text-red-300 light:text-red-600 light:hover:text-red-700 border border-red-500/20 hover:bg-red-500/10 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Цуцлах
                      </button>
                    </form>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
