import Link from "next/link";
import { Prisma } from "@/app/generated/prisma/client";
import { requireAccount } from "@/lib/auth/account";
import {
  ORDER_STATUS_BADGE,
  ORDER_STATUS_LABEL,
  PAYMENT_STATUS_LABEL,
  formatTugrik,
  type OrderStatus,
  type PaymentStatus,
} from "@/lib/orders";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Үйлчилгээний түүх",
};

export const dynamic = "force-dynamic";

function formatDate(d: Date): string {
  return d.toLocaleDateString("mn-MN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export default async function AccountHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ plate?: string }>;
}) {
  const account = await requireAccount();
  const { plate } = await searchParams;

  // Тус хэрэглэгчийн бүх захиалга — холбогдсон Customer-ээр (олон байгууллага
  // дамжсан). Сонголтоор тухайн машины (plate) түүхээр шүүнэ.
  const where: Prisma.ServiceOrderWhereInput = {
    customer: { accountId: account.id },
  };
  if (plate) where.vehicle = { plate };

  const orders = await prisma.serviceOrder.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      number: true,
      status: true,
      paymentStatus: true,
      scheduledAt: true,
      completedAt: true,
      createdAt: true,
      totalAmount: true,
      tenant: { select: { name: true } },
      branch: { select: { name: true } },
      vehicle: { select: { plate: true, make: true, model: true } },
      _count: { select: { items: true } },
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Үйлчилгээний түүх</h1>
          <p className="text-white/40 text-sm mt-0.5">
            {plate
              ? `${plate} — хийгдсэн үйлчилгээнүүд`
              : "Таны машинд хийгдсэн бүх үйлчилгээ"}
          </p>
        </div>
        <Link
          href="/account"
          className="text-sm text-white/50 hover:text-white border border-white/[0.1] hover:bg-white/[0.05] px-4 py-2 rounded-lg transition-colors"
        >
          ← Буцах
        </Link>
      </div>

      {plate ? (
        <Link
          href="/account/history"
          className="self-start text-xs text-violet-300 hover:text-violet-200"
        >
          Бүх машины түүхийг харах →
        </Link>
      ) : null}

      {orders.length === 0 ? (
        <div className="glass rounded-2xl p-10 border border-white/[0.08] text-center text-sm text-white/40">
          Одоогоор хийгдсэн үйлчилгээ алга. Цаг захиалга баталгаажиж, үйлчилгээ
          хийгдсэний дараа энд харагдана.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {orders.map((o) => {
            const when = o.completedAt ?? o.scheduledAt ?? o.createdAt;
            return (
              <div
                key={o.id}
                className="glass rounded-2xl p-4 border border-white/[0.08]"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-white/90">
                        {o.tenant.name}
                      </span>
                      <span className="text-xs text-white/30 font-mono">
                        №{o.number}
                      </span>
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full ${ORDER_STATUS_BADGE[o.status as OrderStatus]}`}
                      >
                        {ORDER_STATUS_LABEL[o.status as OrderStatus]}
                      </span>
                    </div>
                    <div className="text-sm text-white/55 mt-1">
                      {o.vehicle.plate} · {o.vehicle.make} {o.vehicle.model}
                    </div>
                    <div className="text-xs text-white/35 mt-0.5 tabular-nums">
                      {formatDate(when)} · {o.branch.name} · {o._count.items} мөр
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-white/90 tabular-nums">
                      {formatTugrik(o.totalAmount?.toString() ?? null)}
                    </div>
                    <div className="text-xs text-white/40 mt-0.5">
                      {PAYMENT_STATUS_LABEL[o.paymentStatus as PaymentStatus]}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
