import Link from "next/link";
import { notFound } from "next/navigation";
import { cancelAppointmentByAccount } from "@/app/_actions/appointments";
import { BtnLink, Btn } from "@/app/_components/landing-ops-ui";
import {
  APPOINTMENT_STATUS_BADGE,
  APPOINTMENT_STATUS_LABEL,
} from "@/lib/appointments";
import { requireAccount } from "@/lib/auth/account";
import {
  ORDER_STATUS_BADGE,
  ORDER_STATUS_LABEL,
  SERVICE_ITEM_STATUS_BADGE,
  SERVICE_ITEM_STATUS_LABEL,
  type OrderStatus,
  type ServiceItemStatus,
} from "@/lib/orders";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Цаг захиалгын дэлгэрэнгүй",
};

export const dynamic = "force-dynamic";

function fmtDateTime(d: Date): string {
  return d.toLocaleString("mn-MN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default async function AccountAppointmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const account = await requireAccount();
  const { id } = await params;

  const appt = await prisma.appointment.findFirst({
    where: { id, accountId: account.id },
    include: {
      tenant: { select: { name: true, slug: true } },
      branch: { select: { name: true, phone: true } },
      category: { select: { name: true } },
      categories: { select: { category: { select: { name: true } } } },
      payment: { select: { amount: true, currency: true } },
      serviceOrder: {
        select: {
          id: true,
          number: true,
          status: true,
          paymentStatus: true,
          startedAt: true,
          completedAt: true,
          items: {
            orderBy: { createdAt: "asc" },
            select: { id: true, description: true, status: true },
          },
        },
      },
    },
  });
  if (!appt) notFound();

  const canCancel = appt.status === "PENDING" || appt.status === "CONFIRMED";
  const feeAmount = appt.payment?.amount ?? appt.feeAmount;
  const feeLabel = appt.payment
    ? "Хураамж төлөгдсөн ✓"
    : appt.feeQpayInvoiceId
      ? `Хураамж төлөх · ${Number.parseFloat(feeAmount!.toString()).toLocaleString("mn-MN")}₮`
      : null;
  const categoryNames = appt.categories.length
    ? appt.categories.map((c) => c.category.name)
    : appt.category
      ? [appt.category.name]
      : [];
  // Дууссан + бүрэн төлөгдсөн ажлын дэлгэрэнгүйг Үйлчилгээний түүхэнд харуулна
  // (харах: app/account/history — тэнд зөвхөн status COMPLETED-г шүүнэ).
  const settled =
    appt.serviceOrder?.status === "COMPLETED" &&
    appt.serviceOrder?.paymentStatus === "PAID";

  return (
    <div className="w-full max-w-full flex flex-col gap-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold truncate">{appt.tenant.name}</h1>
          <p className="text-[var(--oc-muted)] text-sm mt-0.5">
            {appt.branch.name}
            {appt.branch.phone ? ` · ${appt.branch.phone}` : ""}
          </p>
        </div>
        <BtnLink href="/account" variant="ghost" className="shrink-0">
          ← Буцах
        </BtnLink>
      </div>

      {/* Товч мэдээлэл */}
      <div className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] p-5 grid gap-3 sm:grid-cols-2">
        <Info label="Төлөв">
          <span
            className={`font-plex-mono text-[11px] px-2.5 py-1 rounded-full ${APPOINTMENT_STATUS_BADGE[appt.status]}`}
          >
            {APPOINTMENT_STATUS_LABEL[appt.status]}
          </span>
        </Info>
        <Info label="Цаг">
          <span className="text-sm text-[var(--oc-ink2)] tabular-nums">
            {fmtDateTime(appt.requestedAt)}
          </span>
        </Info>
        {categoryNames.length ? (
          <Info label="Үйлчилгээ">
            <span className="text-sm text-[var(--oc-ink2)]">
              {categoryNames.join(", ")}
            </span>
          </Info>
        ) : null}
        {appt.note ? (
          <Info label="Тэмдэглэл">
            <span className="text-sm text-[var(--oc-ink2)] whitespace-pre-wrap">
              {appt.note}
            </span>
          </Info>
        ) : null}
      </div>

      {/* Ажлын явц — зөвхөн захиалга (ServiceOrder) үүссэн үед */}
      {appt.serviceOrder ? (
        <div>
          <h2 className="font-semibold text-[var(--oc-ink2)] text-sm mb-2">
            Ажлын явц
          </h2>
          <div className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] p-5 flex flex-col gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`font-plex-mono text-[11px] px-2.5 py-1 rounded-full ${ORDER_STATUS_BADGE[appt.serviceOrder.status as OrderStatus]}`}
              >
                {ORDER_STATUS_LABEL[appt.serviceOrder.status as OrderStatus]}
              </span>
              <span className="text-xs text-[var(--oc-muted3)] font-plex-mono">
                №{appt.serviceOrder.number}
              </span>
            </div>
            {appt.serviceOrder.items.length ? (
              <div className="flex flex-col divide-y divide-[var(--oc-line)]">
                {appt.serviceOrder.items.map((it) => (
                  <div
                    key={it.id}
                    className="flex items-center justify-between gap-3 py-2"
                  >
                    <span className="text-sm text-[var(--oc-ink2)]">
                      {it.description}
                    </span>
                    <span
                      className={`shrink-0 font-plex-mono text-[10px] px-1.5 py-0.5 rounded-full ${SERVICE_ITEM_STATUS_BADGE[it.status as ServiceItemStatus]}`}
                    >
                      {SERVICE_ITEM_STATUS_LABEL[it.status as ServiceItemStatus]}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
            {settled ? (
              <Link
                href={`/account/history/${appt.serviceOrder.id}`}
                className="text-sm text-[var(--oc-accent)] hover:text-[var(--oc-accent-hi)] transition-colors w-fit"
              >
                Дэлгэрэнгүй түүхэнд харах →
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Хураамж / цуцлах */}
      <div className="flex items-center gap-3 flex-wrap">
        {feeLabel ? (
          <Link
            href={`/account/appointments/${appt.id}/pay`}
            className={`font-plex-mono text-[11px] px-2.5 py-1 rounded-full whitespace-nowrap transition-colors ${
              appt.payment
                ? "bg-emerald-500/15 text-emerald-400 light:bg-emerald-100 light:text-emerald-700"
                : "bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 light:bg-amber-100 light:text-amber-700"
            }`}
          >
            {feeLabel}
          </Link>
        ) : null}
        {canCancel ? (
          <form action={cancelAppointmentByAccount}>
            <input type="hidden" name="id" value={appt.id} />
            <Btn variant="danger" size="sm" type="submit">
              Цуцлах
            </Btn>
          </form>
        ) : null}
      </div>
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-plex-mono text-[10.5px] uppercase tracking-[0.1em] text-[var(--oc-muted3)] w-20 shrink-0">
        {label}
      </span>
      {children}
    </div>
  );
}
