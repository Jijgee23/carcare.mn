import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccount } from "@/lib/auth/account";
import { prisma } from "@/lib/prisma";
import type { QPayBankUrl } from "@/lib/qpay";
import { AppointmentPaymentPanel } from "./payment-panel";

export const metadata = {
  title: "Цаг захиалгын хураамж",
};

export const dynamic = "force-dynamic";

export default async function AppointmentPayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const account = await requireAccount();

  const appt = await prisma.appointment.findFirst({
    where: { id, accountId: account.id },
    include: {
      tenant: { select: { name: true } },
      branch: { select: { name: true } },
      payment: { select: { amount: true, currency: true } },
    },
  });
  if (!appt) notFound();

  const paid = appt.payment != null;
  const amount = appt.payment?.amount ?? appt.feeAmount;
  const currency = appt.payment?.currency ?? appt.feeCurrency ?? "MNT";

  return (
    <div className="w-full flex flex-col gap-4">
      <Link
        href="/account"
        className="text-xs text-[var(--oc-muted3)] hover:text-[var(--oc-ink2)] transition-colors w-fit"
      >
        ← Миний цагууд
      </Link>

      <div>
        <h1 className="font-semibold text-[var(--oc-ink2)] text-sm">
          Цаг захиалгын хураамж
        </h1>
        <p className="text-xs text-[var(--oc-muted3)] mt-0.5">
          {appt.tenant.name} · {appt.branch.name}
        </p>
      </div>

      {amount ? (
        <AppointmentPaymentPanel
          appointmentId={appt.id}
          paid={paid}
          amount={amount.toString()}
          currency={currency}
          qrImage={appt.feeQrImage}
          urls={
            Array.isArray(appt.feeQpayUrls)
              ? (appt.feeQpayUrls as unknown as QPayBankUrl[])
              : []
          }
          underpaidAmount={appt.feeUnderpaidAmount?.toString() ?? null}
        />
      ) : (
        <div className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] p-6 text-center text-sm text-[var(--oc-muted3)]">
          Төлбөрийн invoice хараахан үүсээгүй байна. Түр хүлээгээд дахин
          нээнэ үү.
        </div>
      )}
    </div>
  );
}
