"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import {
  getScheduleOrderDetail,
  type ScheduleOrderDetail,
} from "@/app/_actions/schedule-order-detail";
import {
  rescheduleOrderAction,
  type OrderActionState,
} from "@/app/_actions/orders";
import { DatePicker, todayStr } from "@/app/_components/date-picker";
import { useToast } from "@/app/_components/toast";
import { AddItemForm } from "@/app/dashboard/orders/[id]/add-item-form";
import { OrderItems } from "@/app/dashboard/orders/[id]/order-items";
import { OrderPaymentsList } from "@/app/dashboard/orders/[id]/order-payments-list";
import {
  canFillDiagnostics,
  formatTugrik,
  PAYMENT_STATUS_BADGE,
  PAYMENT_STATUS_LABEL,
} from "@/lib/orders";

// Хуваарийн харагдацаас (Grid/List) захиалга дээр дарахад л дуудагдаж
// дэлгэрэнгүйг татна — бүх өдрийн мөрд урьдчилан ачаалахгүй (харах:
// schedule-order-detail.ts-ийн тайлбар). Төлбөрийн бичлэг/цуцлах эрх
// (canRecordPayments/canReversePayments) захиалгын дата дотор өөрөө ирдэг
// тул тусад нь prop дамжуулах шаардлагагүй.
export function OrderDetailPanel({
  orderId,
  canChangeItemStatus,
}: {
  orderId: string;
  canChangeItemStatus: boolean;
}) {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ready"; order: ScheduleOrderDetail }
  >({ status: "loading" });
  // Мөр нэмсний дараа дахин татахад ашиглана — үр дүн cache-лэгддэггүй
  // one-off client fetch тул (бүтэн серверийн хуудасны revalidatePath-аас
  // ялгаатай) энд гар аргаар л шинэчилнэ.
  const [refreshKey, setRefreshKey] = useState(0);

  // Сонгосон захиалга солигдоход дуудагч тал `key={orderId}` дамжуулж энэ
  // компонентыг бүхэлд нь дахин mount хийдэг (доор тайлбарласан) — тул энд
  // "loading"-руу буцаах шаардлагагүй, зөвхөн эхний mount-д л татна.
  useEffect(() => {
    let cancelled = false;
    getScheduleOrderDetail(orderId).then((res) => {
      if (cancelled) return;
      if (res.ok) setState({ status: "ready", order: res.order });
      else setState({ status: "error", message: res.message });
    });
    return () => {
      cancelled = true;
    };
  }, [orderId, refreshKey]);

  if (state.status === "loading") {
    return (
      <div className="flex-1 min-w-0 rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] p-4 text-sm text-[var(--oc-muted3)]">
        Ачаалж байна...
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div className="flex-1 min-w-0 rounded-[10px] border border-red-500/25 bg-red-500/[0.06] p-4 text-sm text-red-400">
        {state.message}
      </div>
    );
  }

  const { order } = state;

  return (
    <div className="flex-1 min-w-0 rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-[var(--oc-line)]">
        <div className="min-w-0">
          <Link
            href={`/dashboard/orders/${order.id}`}
            className="text-sm font-medium text-[var(--oc-accent)] hover:text-[var(--oc-accent-hi)]"
          >
            Засварын хуудас #{order.number} →
          </Link>
          <div className="text-xs text-[var(--oc-muted3)] mt-0.5">
            {order.customerName} · {order.vehiclePlate} · {order.vehicleMakeModel}
          </div>
          {order.assignedToName ? (
            <div className="text-xs text-[var(--oc-muted3)] mt-0.5">
              Хариуцагч: <span className="text-[var(--oc-ink2)]">{order.assignedToName}</span>
            </div>
          ) : null}
        </div>
        <span
          className={`font-plex-mono text-[10px] px-2 py-1 rounded-full shrink-0 ${PAYMENT_STATUS_BADGE[order.paymentStatus]}`}
        >
          {PAYMENT_STATUS_LABEL[order.paymentStatus]}
        </span>
      </div>

      {order.status === "SCHEDULED" ? (
        <div className="px-4 py-3 border-b border-[var(--oc-line)]">
          <RescheduleControl orderId={order.id} scheduledAt={order.scheduledAt} />
        </div>
      ) : null}

      {order.items.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-[var(--oc-muted4)]">
          Үйлчилгээ нэмэгдээгүй байна.
        </div>
      ) : (
        <OrderItems
          items={order.items}
          orderId={order.id}
          canEdit={false}
          canChangeStatus={canChangeItemStatus}
          orderStarted={canFillDiagnostics(order.status)}
        />
      )}

      {order.canAddItems ? (
        <div className="px-4 py-3 border-t border-[var(--oc-line)] bg-[var(--oc-panel2)]">
          <AddItemForm
            orderId={order.id}
            services={order.services}
            diagnosticTemplates={order.diagnosticTemplates}
            onAdded={() => setRefreshKey((k) => k + 1)}
          />
        </div>
      ) : null}

      {order.payments.length > 0 || order.canRecordPayments ? (
        <div className="px-4 py-3 border-t border-[var(--oc-line)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[var(--oc-muted3)]">Төлбөрүүд</span>
            <span className="font-plex-mono text-xs text-[var(--oc-ink2)]">
              {formatTugrik(order.totalAmount)}
            </span>
          </div>
          <OrderPaymentsList
            orderId={order.id}
            payments={order.payments}
            remaining={order.remainingAmount}
            canRecord={order.canRecordPayments}
            canReverse={order.canReversePayments}
          />
        </div>
      ) : null}
    </div>
  );
}

function toLocalDatetimeInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

// Хараахан эхлээгүй (SCHEDULED) захиалгын товлосон огноог хуваарийн
// харагдацаас шууд шилжүүлнэ — өмнөх ажил хоцорсон зэрэг шалтгаанаар дараагийн
// ажлыг өөр цагт шилжүүлэх түгээмэл хэрэгцээ. Давхцлын анхааруулга
// (findScheduleConflict) reviseExpectedFinishAction-тэй ижил зарчим:
// хатуу хориглол биш, дахин "Хадгалах" дарахад confirmed=true явна.
function RescheduleControl({
  orderId,
  scheduledAt,
}: {
  orderId: string;
  scheduledAt: string | null;
}) {
  const toast = useToast();
  const [state, formAction, pending] = useActionState<
    OrderActionState,
    FormData
  >(rescheduleOrderAction, null);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [confirmArmed, setConfirmArmed] = useState(false);
  const [prevState, setPrevState] = useState<OrderActionState>(null);

  if (state !== prevState) {
    setPrevState(state);
    if (state?.ok) {
      toast.success(state.message ?? "Амжилттай.");
      setEditing(false);
      setConfirmArmed(false);
    } else if (state?.fieldErrors?.confirmNeeded) {
      setConfirmArmed(true);
    } else if (state) {
      toast.error(state.message ?? "Алдаа гарлаа.");
      setConfirmArmed(false);
    }
  }

  const conflictMessage =
    state && !state.ok && state.fieldErrors?.confirmNeeded ? state.message : null;

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-xs text-[var(--oc-muted3)]">Товлосон огноо</span>
        {!editing ? (
          <button
            type="button"
            onClick={() => {
              setValue(toLocalDatetimeInput(scheduledAt));
              setConfirmArmed(false);
              setEditing(true);
            }}
            className="font-plex-mono text-[11px] font-medium px-2.5 py-1 rounded-full border border-[var(--oc-accent)]/40 bg-[var(--oc-accent)]/10 text-[var(--oc-accent)] hover:bg-[var(--oc-accent)]/20 hover:border-[var(--oc-accent)]/60 transition-colors"
          >
            Шилжүүлэх
          </button>
        ) : null}
      </div>
      {!editing ? (
        <div className="text-sm text-[var(--oc-ink2)]">
          {scheduledAt ? toLocalDatetimeInput(scheduledAt).replace("T", " ") : "—"}
        </div>
      ) : (
        <form action={formAction} className="flex flex-col gap-2">
          <input type="hidden" name="id" value={orderId} />
          <input type="hidden" name="confirmed" value={confirmArmed ? "true" : ""} />
          <DatePicker
            withTime
            min={todayStr()}
            value={value}
            onChange={(v) => {
              setValue(v);
              setConfirmArmed(false);
            }}
          />
          <input type="hidden" name="scheduledAt" value={value} />
          {conflictMessage ? (
            <p className="text-xs text-[var(--oc-warn)]">{conflictMessage}</p>
          ) : null}
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={pending || !value}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors hover:opacity-90 disabled:opacity-60 ${
                confirmArmed ? "bg-[var(--oc-warn)]" : "bg-[var(--oc-accent)]"
              }`}
            >
              {pending ? "Хадгалж байна..." : confirmArmed ? "Тийм, хадгалах" : "Хадгалах"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-lg border border-[var(--oc-line)] bg-white/[0.04] px-3 py-1.5 text-xs text-[var(--oc-ink2)] hover:bg-white/[0.08]"
            >
              Болих
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
