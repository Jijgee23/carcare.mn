import Link from "next/link";
import { accountSignOutAction } from "@/app/_actions/account-auth";
import { deleteAccountVehicle } from "@/app/_actions/account-vehicles";
import { cancelAppointmentByAccount } from "@/app/_actions/appointments";
import { WebPushToggle } from "@/app/_components/web-push";
import { AddAccountVehicle } from "./add-account-vehicle";
import {
  APPOINTMENT_STATUS_BADGE,
  APPOINTMENT_STATUS_LABEL,
} from "@/lib/appointments";
import { requireAccount } from "@/lib/auth/account";
import { formatPhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Миний цаг",
};

export const dynamic = "force-dynamic";

function formatDateTime(d: Date): string {
  return d.toLocaleString("mn-MN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AccountPage() {
  const account = await requireAccount();

  const [appointments, vehicles] = await Promise.all([
    prisma.appointment.findMany({
      where: { accountId: account.id },
      orderBy: { requestedAt: "desc" },
      include: {
        tenant: { select: { name: true, slug: true } },
        branch: { select: { name: true } },
      },
    }),
    prisma.accountVehicle.findMany({
      where: { accountId: account.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, plate: true, make: true, model: true, year: true },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            {account.name?.trim() || "Сайн байна уу"}
          </h1>
          <p className="text-white/40 text-sm mt-0.5 tabular-nums">
            {formatPhone(account.phone)}
          </p>
        </div>
        <form action={accountSignOutAction}>
          <button
            type="submit"
            className="text-sm text-white/50 hover:text-white border border-white/[0.1] hover:bg-white/[0.05] px-4 py-2 rounded-lg transition-colors"
          >
            Гарах
          </button>
        </form>
      </div>

      <section className="glass rounded-2xl p-4 border border-white/[0.08] flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-white/85">Push мэдэгдэл</div>
          <div className="text-xs text-white/40">
            Цаг баталгаажих, сануулгыг энэ төхөөрөмж дээр авах.
          </div>
        </div>
        <WebPushToggle target="account" />
      </section>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="font-semibold text-white/80">Миний цагууд</h2>
        <div className="flex items-center gap-2">
          <Link
            href="/account/notifications"
            className="text-sm text-white/60 hover:text-white border border-white/[0.1] hover:bg-white/[0.05] px-4 py-2 rounded-lg transition-colors"
          >
            Мэдэгдэл
          </Link>
          <Link
            href="/account/history"
            className="text-sm text-white/60 hover:text-white border border-white/[0.1] hover:bg-white/[0.05] px-4 py-2 rounded-lg transition-colors"
          >
            Үйлчилгээний түүх
          </Link>
          <Link
            href="/discover"
            className="text-sm bg-violet-600 hover:bg-violet-500 px-4 py-2 rounded-lg font-medium transition-colors"
          >
            + Шинэ цаг
          </Link>
        </div>
      </div>

      {appointments.length === 0 ? (
        <div className="glass rounded-2xl p-10 border border-white/[0.08] text-center">
          <p className="text-sm text-white/40">Та одоогоор цаг захиалаагүй байна.</p>
          <Link
            href="/discover"
            className="inline-block mt-3 text-sm text-violet-300 hover:text-violet-200"
          >
            Газар сонгож цаг захиалах →
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {appointments.map((a) => {
            const canCancel = a.status === "PENDING" || a.status === "CONFIRMED";
            return (
              <div
                key={a.id}
                className="glass rounded-2xl p-4 border border-white/[0.08] flex items-start gap-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/org/${a.tenant.slug}`}
                      className="font-semibold text-white/90 hover:text-violet-300 transition-colors"
                    >
                      {a.tenant.name}
                    </Link>
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full ${APPOINTMENT_STATUS_BADGE[a.status]}`}
                    >
                      {APPOINTMENT_STATUS_LABEL[a.status]}
                    </span>
                  </div>
                  <div className="text-sm text-white/60 mt-1 tabular-nums">
                    {formatDateTime(a.requestedAt)}
                  </div>
                  <div className="text-xs text-white/40 mt-0.5">
                    {a.branch.name}
                    {a.note ? ` · ${a.note}` : ""}
                  </div>
                </div>

                {canCancel ? (
                  <form action={cancelAppointmentByAccount}>
                    <input type="hidden" name="id" value={a.id} />
                    <button
                      type="submit"
                      className="shrink-0 text-xs text-red-300/80 hover:text-red-300 border border-red-500/20 hover:bg-red-500/10 px-3 py-1.5 rounded-lg transition-colors"
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

      <div className="flex items-center justify-between pt-2">
        <h2 className="font-semibold text-white/80">Миний машинууд</h2>
      </div>

      <div className="flex flex-col gap-3">
        {vehicles.length === 0 ? (
          <p className="text-sm text-white/40">
            Машин бүртгээгүй байна. Цаг захиалахад хэрэг болно.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {vehicles.map((v) => (
              <div
                key={v.id}
                className="glass rounded-xl p-3.5 border border-white/[0.08] flex items-center gap-3"
              >
                <Link
                  href={`/account/history?plate=${encodeURIComponent(v.plate)}`}
                  className="min-w-0 flex-1 group"
                  title="Энэ машины үйлчилгээний түүх"
                >
                  <div className="font-medium text-white/85 group-hover:text-violet-300 transition-colors">
                    {v.plate}
                  </div>
                  <div className="text-xs text-white/40 truncate">
                    {v.make} {v.model}
                    {v.year ? ` · ${v.year}` : ""}
                  </div>
                </Link>
                <form action={deleteAccountVehicle}>
                  <input type="hidden" name="id" value={v.id} />
                  <button
                    type="submit"
                    className="shrink-0 text-xs text-red-300/80 hover:text-red-300 border border-red-500/20 hover:bg-red-500/10 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Устгах
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
        <AddAccountVehicle />
      </div>
    </div>
  );
}
