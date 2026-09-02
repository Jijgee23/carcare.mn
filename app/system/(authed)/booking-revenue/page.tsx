import Link from "next/link";
import { PageHeader } from "@/app/_components/page-header";
import { Pagination } from "@/app/_components/pagination";
import { requireSuperAdmin } from "@/lib/auth/system";
import { formatTugrik } from "@/lib/orders";
import { buildMeta, getPageInfo } from "@/lib/pagination";
import { getPlatformSettings } from "@/lib/platform-settings";
import { prisma } from "@/lib/prisma";
import { RefundButton } from "./refund-button";

export const metadata = {
  title: "Цаг захиалгын орлого",
};

export default async function BookingRevenuePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireSuperAdmin();
  const { page: pageParam } = await searchParams;

  const { page, pageSize, skip, take } = getPageInfo(pageParam);
  const [settings, payments, total, paidAgg, refundedAgg, refundedCount, underpaid] =
    await Promise.all([
      getPlatformSettings(),
      // Мөр бүр аль хэдийн ТӨЛӨГДСӨН (Invoice зөвхөн PAID болсны дараа л
      // үүснэ — lib/appointment-payments.ts), status нь дараа REFUNDED болж
      // болно.
      prisma.appointmentPayment.findMany({
        orderBy: { paidAt: "desc" },
        skip,
        take,
        include: {
          tenant: { select: { name: true } },
          account: { select: { name: true, phone: true } },
        },
      }),
      prisma.appointmentPayment.count(),
      prisma.appointmentPayment.aggregate({
        where: { status: "PAID" },
        _sum: { amount: true },
      }),
      prisma.appointmentPayment.aggregate({
        where: { status: "REFUNDED" },
        _sum: { amount: true },
      }),
      prisma.appointmentPayment.count({ where: { status: "REFUNDED" } }),
      // Дутуу төлбөр (0 < төлсөн < шаардлагатай) илэрсэн боловч Invoice
      // ҮҮСЭЭГҮЙ хэвээр буй захиалгууд — confirmAppointmentPayment тэмдэглэсэн.
      prisma.appointment.findMany({
        where: { feeUnderpaidAmount: { not: null } },
        orderBy: { feeUnderpaidAt: "desc" },
        take: 20,
        select: {
          id: true,
          feeAmount: true,
          feeUnderpaidAmount: true,
          feeUnderpaidAt: true,
          tenant: { select: { name: true } },
          account: { select: { name: true, phone: true } },
        },
      }),
    ]);
  const meta = buildMeta(total, page, pageSize);
  const netRevenue = Number.parseFloat(paidAgg._sum.amount?.toString() ?? "0");
  const refundedTotal = Number.parseFloat(
    refundedAgg._sum.amount?.toString() ?? "0",
  );

  return (
    <div className="p-6 sm:p-8 max-w-screen">
      <PageHeader
        title="Цаг захиалгын орлого"
        description="Хэрэглэгч онлайн цаг захиалахдаа төлдөг платформын хураамжийн invoice-ууд (зөвхөн бодитоор төлөгдсөн)"
      />

      <div className="glass rounded-2xl p-4 mb-6 flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm text-white/70">
          Одоогийн хураамж:{" "}
          <span className="font-plex-mono font-semibold text-white">
            {settings.appointmentFeeEnabled
              ? formatTugrik(settings.appointmentFeeAmount)
              : "Идэвхгүй (үнэгүй)"}
          </span>
        </div>
        <Link
          href="/system/settings"
          className="text-xs text-red-300 hover:text-red-200 light:text-red-600 light:hover:text-red-700"
        >
          Тохиргоо засах →
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3 mb-8">
        <div className="glass rounded-2xl p-5 border border-emerald-500/20">
          <div className="text-xs text-white/40 uppercase tracking-wider">
            Цэвэр орлого
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold gradient-text">
            {formatTugrik(netRevenue)}
          </div>
          <p className="text-xs text-white/40 mt-1">Буцаагдсаныг хассан</p>
        </div>
        <div className="glass rounded-2xl p-5">
          <div className="text-2xl sm:text-3xl font-bold text-white">
            {total.toLocaleString("mn-MN")}
          </div>
          <div className="text-sm text-white/40 mt-1">Нийт invoice</div>
        </div>
        <div className="glass rounded-2xl p-5">
          <div className="text-2xl sm:text-3xl font-bold text-amber-400">
            {formatTugrik(refundedTotal)}
          </div>
          <div className="text-sm text-white/40 mt-1">
            Буцаагдсан ({refundedCount.toLocaleString("mn-MN")})
          </div>
        </div>
      </div>

      {underpaid.length > 0 ? (
        <div className="glass rounded-2xl overflow-hidden mb-6 border border-amber-500/20">
          <div className="px-5 py-3 border-b border-white/[0.06]">
            <h2 className="text-sm font-semibold text-amber-300">
              Дутуу төлбөр илэрсэн ({underpaid.length})
            </h2>
            <p className="text-xs text-white/40 mt-0.5">
              Хэрэглэгч дутуу дүн төлж, Invoice хараахан үүсээгүй байгаа
              захиалгууд — үлдэгдлээ нөхмөгц автоматаар PAID болно.
            </p>
          </div>
          <div className="overflow-auto">
            <table className="w-full min-w-[560px]">
              <tbody className="divide-y divide-white/[0.04]">
                {underpaid.map((a) => (
                  <tr key={a.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-2.5 text-sm text-white/90">
                      {a.tenant.name}
                    </td>
                    <td className="px-5 py-2.5 text-xs text-white/60">
                      {a.account?.name?.trim() || a.account?.phone || "—"}
                    </td>
                    <td className="px-5 py-2.5 font-plex-mono text-xs text-amber-300">
                      {formatTugrik(a.feeUnderpaidAmount?.toString())} /{" "}
                      {formatTugrik(a.feeAmount?.toString())}
                    </td>
                    <td className="px-5 py-2.5 font-plex-mono text-xs text-white/40">
                      {a.feeUnderpaidAt
                        ? a.feeUnderpaidAt.toLocaleString("mn-MN", { hour12: false })
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="glass rounded-2xl overflow-hidden">
        {payments.length === 0 ? (
          <div className="px-5 py-16 text-center text-white/40 text-sm">
            Бичлэг олдсонгүй.
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {[
                    "Байгууллага",
                    "Хэрэглэгч",
                    "Дүн",
                    "Төрөл",
                    "Статус",
                    "Төлсөн",
                    "Үйлдэл",
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-left font-plex-mono text-[10.5px] uppercase tracking-[0.08em] text-white/40 font-medium px-5 py-3"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3 text-sm text-white/90">
                      {p.tenant.name}
                    </td>
                    <td className="px-5 py-3 text-xs text-white/60">
                      {p.account.name?.trim() || p.account.phone}
                    </td>
                    <td className="px-5 py-3 font-plex-mono text-xs text-white/80">
                      {formatTugrik(p.amount.toString())}
                    </td>
                    <td className="px-5 py-3 text-xs text-white/40">
                      {p.paymentType ?? "—"}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          p.status === "REFUNDED"
                            ? "bg-white/10 text-white/40 light:bg-slate-100 light:text-slate-500"
                            : "bg-emerald-500/15 text-emerald-400 light:bg-emerald-100 light:text-emerald-700"
                        }`}
                      >
                        {p.status === "REFUNDED" ? "Буцаагдсан" : "Төлөгдсөн"}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-plex-mono text-xs text-white/40">
                      {p.paidAt
                        ? p.paidAt.toLocaleString("mn-MN", { hour12: false })
                        : "—"}
                    </td>
                    <td className="px-5 py-3">
                      {p.status === "PAID" ? (
                        <RefundButton paymentId={p.id} paymentType={p.paymentType} />
                      ) : (
                        <span className="text-xs text-white/25" title={p.refundNote ?? undefined}>
                          {p.refundedAt?.toLocaleDateString("mn-MN") ?? "—"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} />
      </div>
    </div>
  );
}
