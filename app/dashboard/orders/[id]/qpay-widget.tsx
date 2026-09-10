"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  cancelOrderQPayPaymentAction,
  checkOrderQPayPaymentAction,
  createOrderQPayInvoiceAction,
  type OrderPaymentActionState,
} from "@/app/_actions/order-payments";
import { ConfirmButton } from "@/app/_components/confirm-form";
import { Btn } from "@/app/_components/landing-ops-ui";
import { QPayBankGrid } from "@/app/_components/qpay-bank-grid";
import { QPayDrawer } from "@/app/_components/qpay-drawer";
import type { QPayBankUrl } from "@/lib/qpay-tenant";

export type PendingOrderPayment = {
  id: string;
  qrImage: string | null;
  urls: QPayBankUrl[];
  amount: string;
};

export function QPayWidget({
  orderId,
  qpayConfigured,
  pending,
}: {
  orderId: string;
  qpayConfigured: boolean;
  pending: PendingOrderPayment | null;
}) {
  // Шинэ pending үүсэх бүрд drawer-ийг автоматаар нээнэ (жишээ нь "QR
  // үүсгэх"-ийг дарсны дараа), гэхдээ хэрэглэгч хаасан бол дахин зурагтаар
  // онгойлгож болно ("Нээх" товч).
  const [drawerOpen, setDrawerOpen] = useState(Boolean(pending));
  const seenPaymentId = useRef<string | null>(pending?.id ?? null);
  useEffect(() => {
    if (pending && pending.id !== seenPaymentId.current) {
      seenPaymentId.current = pending.id;
      setDrawerOpen(true);
    }
  }, [pending]);

  if (!qpayConfigured) {
    return (
      <div className="text-xs text-[var(--oc-muted3)]">
        QPay тохируулаагүй.{" "}
        <a
          href="/dashboard/settings/qpay"
          className="text-[var(--oc-accent)] hover:text-[var(--oc-accent-hi)] underline"
        >
          Тохируулах →
        </a>
      </div>
    );
  }

  if (!pending) {
    return <CreateButton orderId={orderId} />;
  }

  return (
    <>
      <div className="rounded-lg border border-[var(--oc-line)] bg-[var(--oc-panel2)] px-3 py-2.5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] text-[var(--oc-muted3)]">Төлбөр хүлээгдэж байна</div>
          <div className="font-plex-mono text-sm font-semibold text-[var(--oc-ink2)] tabular-nums">
            {Number.parseFloat(pending.amount).toLocaleString("mn-MN")}₮
          </div>
        </div>
        <Btn type="button" size="sm" onClick={() => setDrawerOpen(true)}>
          QR нээх
        </Btn>
      </div>
      <QPayDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="QPay-ээр төлөх"
      >
        <QRPanel pending={pending} onPaid={() => setDrawerOpen(false)} />
      </QPayDrawer>
    </>
  );
}

function CreateButton({ orderId }: { orderId: string }) {
  const [state, formAction, formPending] = useActionState<
    OrderPaymentActionState,
    FormData
  >(createOrderQPayInvoiceAction, null);

  return (
    <form action={formAction}>
      <input type="hidden" name="orderId" value={orderId} />
      <Btn type="submit" disabled={formPending} className="w-full">
        {formPending ? "Үүсгэж..." : "QPay QR үүсгэх"}
      </Btn>
      {state && !state.ok && state.message ? (
        <p className="text-xs text-red-400 light:text-red-600 mt-2">{state.message}</p>
      ) : null}
    </form>
  );
}

function QRPanel({
  pending,
  onPaid,
}: {
  pending: PendingOrderPayment;
  onPaid: () => void;
}) {
  const [checking, setChecking] = useState(false);
  const [paid, setPaid] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const stopRef = useRef(false);

  async function check() {
    if (stopRef.current) return;
    setChecking(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.set("paymentId", pending.id);
      const res = await checkOrderQPayPaymentAction(fd);
      if (res.paid) {
        setPaid(true);
        stopRef.current = true;
        setMsg("Төлбөр амжилттай — засварын хуудас шинэчилнэ...");
        setTimeout(() => {
          onPaid();
          window.location.reload();
        }, 1500);
      } else if (!res.ok && res.message) {
        setMsg(res.message);
      } else {
        setMsg("Төлбөр төлөгдөөгүй байна. QR-аа уншуулсны дараа дахин шалгана уу.");
      }
    } finally {
      setChecking(false);
    }
  }

  async function cancel() {
    stopRef.current = true;
    const fd = new FormData();
    fd.set("paymentId", pending.id);
    await cancelOrderQPayPaymentAction(fd);
    window.location.reload();
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-center text-xs text-[var(--oc-muted3)]">
        Үлдэгдэл:{" "}
        <span className="font-plex-mono text-[var(--oc-ink2)] font-semibold">
          {Number.parseFloat(pending.amount).toLocaleString("mn-MN")}₮
        </span>
      </div>

      {paid ? (
        <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 light:text-emerald-700 rounded-lg px-3 py-2 text-xs text-center">
          ✓ Төлбөр амжилттай
        </div>
      ) : pending.qrImage ? (
        <div className="bg-white p-3 rounded-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`data:image/png;base64,${pending.qrImage}`}
            alt="QPay QR"
            className="w-48 h-48 object-contain"
          />
        </div>
      ) : (
        <div className="text-xs text-[var(--oc-muted3)]">QR үүсэхэд хүлээнэ үү...</div>
      )}

      {pending.urls.length > 0 ? (
        <div className="w-full">
          <QPayBankGrid urls={pending.urls} />
        </div>
      ) : null}

      {msg ? (
        <p className="text-[11px] text-[var(--oc-muted2)] text-center">{msg}</p>
      ) : null}

      <div className="flex items-center gap-2">
        <Btn type="button" onClick={check} disabled={checking || paid} size="sm">
          {checking ? "Шалгаж..." : "Шалгах"}
        </Btn>
        <ConfirmButton
          onConfirm={cancel}
          message="Энэ QPay төлбөрийн нэхэмжлэлийг цуцлах уу?"
          title="QPay нэхэмжлэл цуцлах"
          confirmLabel="Тийм, цуцлах"
          className="text-xs text-[var(--oc-muted3)] hover:text-[var(--oc-ink2)] underline underline-offset-2"
        >
          Цуцлах
        </ConfirmButton>
      </div>
    </div>
  );
}
