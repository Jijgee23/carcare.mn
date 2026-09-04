"use client";

import { useState } from "react";
import {
  checkAppointmentPaymentAction,
  retryAppointmentPaymentAction,
} from "@/app/_actions/appointment-payments";
import { Btn } from "@/app/_components/landing-ops-ui";
import { QPayBankGrid } from "@/app/_components/qpay-bank-grid";
import { useToast } from "@/app/_components/toast";
import type { QPayBankUrl } from "@/lib/qpay";

export function AppointmentPaymentPanel({
  appointmentId,
  paid: initialPaid,
  amount,
  currency,
  qrImage,
  urls,
  underpaidAmount: initialUnderpaid,
}: {
  appointmentId: string;
  paid: boolean;
  amount: string;
  currency: string;
  qrImage: string | null;
  urls: QPayBankUrl[];
  underpaidAmount: string | null;
}) {
  const toast = useToast();
  const [paid, setPaid] = useState(initialPaid);
  const [underpaidAmount, setUnderpaidAmount] = useState(initialUnderpaid);
  const [checking, setChecking] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const failed = !paid && !qrImage;

  async function checkNow() {
    setChecking(true);
    try {
      const fd = new FormData();
      fd.append("appointmentId", appointmentId);
      const res = await checkAppointmentPaymentAction(fd);
      if (res.paid) {
        setPaid(true);
        setUnderpaidAmount(null);
        toast.success("Төлбөр амжилттай", "Хураамж төлөгдлөө.");
      } else if (res.underpaidAmount != null) {
        setUnderpaidAmount(String(res.underpaidAmount));
        toast.warning("Дутуу төлбөр ирсэн", res.message);
      } else if (!res.ok && res.message) {
        toast.error("Төлбөр шалгах боломжгүй", res.message);
      } else {
        toast.warning(
          "Төлбөр төлөгдөөгүй байна",
          "Банкны аппаар QR-аа уншуулсны дараа дахин шалгана уу.",
        );
      }
    } catch (e) {
      toast.error("Алдаа гарлаа", e instanceof Error ? e.message : undefined);
    } finally {
      setChecking(false);
    }
  }

  async function retryNow() {
    setRetrying(true);
    try {
      const fd = new FormData();
      fd.append("appointmentId", appointmentId);
      const res = await retryAppointmentPaymentAction(fd);
      if (res.ok) {
        window.location.reload();
      } else {
        toast.error("Invoice үүсгэх боломжгүй", res.message);
      }
    } catch (e) {
      toast.error("Алдаа гарлаа", e instanceof Error ? e.message : undefined);
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div className="rounded-[10px] border border-[var(--oc-accent)]/25 bg-[var(--oc-accent)]/[0.05] p-6">
      <div className="text-center">
        <div className="font-plex-mono text-[10.5px] uppercase tracking-[0.1em] text-[var(--oc-muted3)]">
          Цаг захиалгын хураамж
        </div>
        <div className="mt-2 font-plex-mono text-3xl font-bold text-[var(--oc-accent)]">
          {Number.parseFloat(amount).toLocaleString("mn-MN")}{" "}
          <span className="text-sm text-[var(--oc-muted3)]">{currency}</span>
        </div>
      </div>

      {!paid && underpaidAmount != null ? (
        <div className="mt-6 bg-amber-500/10 border border-amber-500/25 text-amber-400 rounded-[10px] px-4 py-3 text-sm text-center">
          Дутуу төлбөр ирсэн: {Number.parseFloat(underpaidAmount).toLocaleString("mn-MN")}₮
          / {Number.parseFloat(amount).toLocaleString("mn-MN")}₮. Үлдэгдлийг
          дахин уншуулж нөхнө үү.
        </div>
      ) : null}

      {paid ? (
        <div className="mt-6 bg-[var(--oc-ok)]/15 border border-[var(--oc-ok)]/30 text-[var(--oc-ok)] rounded-[10px] px-4 py-3 text-sm text-center">
          Төлбөр амжилттай төлөгдсөн.
        </div>
      ) : failed ? (
        <div className="mt-6 flex flex-col items-center gap-3">
          <div className="bg-red-500/10 border border-red-500/25 text-red-400 rounded-[10px] px-4 py-3 text-sm text-center">
            Invoice үүсгэхэд алдаа гарсан байна.
          </div>
          <Btn type="button" onClick={retryNow} disabled={retrying}>
            {retrying ? "Оролдож..." : "Дахин оролдох"}
          </Btn>
        </div>
      ) : qrImage ? (
        <>
          <div className="mt-6 grid gap-6 md:grid-cols-[auto_1fr]">
            <div className="bg-white p-3 rounded-[10px] flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`data:image/png;base64,${qrImage}`}
                alt="QPay QR"
                className="w-48 h-48 md:w-auto md:h-full aspect-square object-contain"
              />
            </div>

            <div className="flex flex-col gap-4">
              <QPayBankGrid urls={urls} />

              <p className="text-xs text-[var(--oc-muted3)] text-center md:text-left">
                Утсаараа банкны апп нээж QR-ыг уншуулна уу. Төлбөр төлөгдсөний
                дараа доорх товчоор шалгана уу.
              </p>
            </div>
          </div>

          <div className="mt-6 flex justify-center">
            <Btn type="button" onClick={checkNow} disabled={checking}>
              {checking ? "Шалгаж байна..." : "Төлбөр шалгах"}
            </Btn>
          </div>
        </>
      ) : (
        <div className="mt-6 text-sm text-[var(--oc-muted2)] text-center">
          QR үүсэхэд хүлээнэ үү...
        </div>
      )}
    </div>
  );
}
