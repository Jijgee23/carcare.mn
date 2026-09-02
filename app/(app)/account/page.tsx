import Link from "next/link";
import { cancelAppointmentByAccount } from "@/app/_actions/appointments";
import { AddLinkButton, Btn } from "@/app/_components/landing-ops-ui";
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
      payment: { select: { id: true, amount: true } },
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
      <AddLinkButton href="/discover">Шинэ цаг захиалах</AddLinkButton>

      {/* Push мэдэгдэл */}
      <section className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] p-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-[var(--oc-ink2)]">Push мэдэгдэл</div>
          <div className="text-xs text-[var(--oc-muted3)]">
            Цаг баталгаажих, сануулгыг энэ төхөөрөмж дээр авах.
          </div>
        </div>
        <WebPushToggle target="account" />
      </section>

      {/* Цагууд */}
      <div>
        <h1 className="font-semibold text-[var(--oc-ink2)] text-sm mb-2">
          Миний цагууд
          {sortedAppts.length > 0 ? (
            <span className="text-[var(--oc-muted3)] font-normal"> · {sortedAppts.length}</span>
          ) : null}
        </h1>

        {sortedAppts.length === 0 ? (
          <div className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] p-8 text-center">
            <p className="text-sm text-[var(--oc-muted3)]">
              Та одоогоор цаг захиалаагүй байна.
            </p>
            <Link
              href="/discover"
              className="inline-block mt-2 text-sm text-[var(--oc-accent)] hover:text-[var(--oc-accent-hi)] transition-colors"
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

              // Хураамжийн badge: Invoice (payment) төлөгдсөн, эсвэл fee*
              // талбар (checkout явцад буй/амжилтгүй) байвал л харагдана.
              const feeAmount = a.payment?.amount ?? a.feeAmount;
              const feeLabel = a.payment
                ? "Хураамж төлөгдсөн ✓"
                : a.feeQpayInvoiceId
                  ? `Хураамж төлөх · ${Number.parseFloat(feeAmount!.toString()).toLocaleString("mn-MN")}₮`
                  : "Хураамж — дахин оролдох";

              return (
                <div
                  key={a.id}
                  className={`rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] p-3 flex items-stretch gap-3 ${canCancel ? "" : "opacity-70"
                    }`}
                >
                  {/* Огнооны chip */}
                  <div className="shrink-0 w-14 rounded-lg bg-[var(--oc-panel2)] border border-[var(--oc-line2)] flex flex-col items-center justify-center py-1.5">
                    <div className="text-sm font-bold tabular-nums leading-tight">
                      {dt.time}
                    </div>
                    <div className="text-[11px] text-[var(--oc-muted3)] tabular-nums">
                      {dt.date}
                    </div>
                  </div>

                  <div className="min-w-0 flex-1 flex flex-col justify-center">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/org/${a.tenant.slug}`}
                        className="font-semibold text-[var(--oc-ink)] hover:text-[var(--oc-accent)] transition-colors truncate"
                      >
                        {a.tenant.name}
                      </Link>
                      <span
                        className={`font-plex-mono text-[11px] px-2.5 py-1 rounded-full ${APPOINTMENT_STATUS_BADGE[a.status]}`}
                      >
                        {APPOINTMENT_STATUS_LABEL[a.status]}
                      </span>
                    </div>
                    <div className="text-xs text-[var(--oc-muted)] mt-0.5">
                      {dt.weekday} · {a.branch.name}
                      {a.category ? ` · ${a.category.name}` : ""}
                    </div>
                    {a.note ? (
                      <div className="text-xs text-[var(--oc-muted3)] mt-0.5 truncate">
                        {a.note}
                      </div>
                    ) : null}
                  </div>

                  <div className="shrink-0 flex flex-col items-end justify-center gap-1.5">
                    {a.payment || a.feeAmount ? (
                      <Link
                        href={`/account/appointments/${a.id}/pay`}
                        className={`font-plex-mono text-[11px] px-2.5 py-1 rounded-full whitespace-nowrap transition-colors ${
                          a.payment
                            ? "bg-emerald-500/15 text-emerald-400 light:bg-emerald-100 light:text-emerald-700"
                            : "bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 light:bg-amber-100 light:text-amber-700"
                        }`}
                      >
                        {feeLabel}
                      </Link>
                    ) : null}
                    {canCancel ? (
                      <form action={cancelAppointmentByAccount}>
                        <input type="hidden" name="id" value={a.id} />
                        <Btn variant="danger" size="sm" type="submit">
                          Цуцлах
                        </Btn>
                      </form>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
