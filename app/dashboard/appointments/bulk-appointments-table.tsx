"use client";

import { useEffect, useState } from "react";
import { useActionState } from "react";
import {
  bulkChangeAppointmentCategoryAction,
} from "@/app/_actions/appointments";
import type { BulkActionState } from "@/lib/bulk-action";
import { Btn, BtnLink } from "@/app/_components/landing-ops-ui";
import { Modal } from "@/app/_components/modal";
import { useToast } from "@/app/_components/toast";
import {
  APPOINTMENT_STATUS_BADGE,
  APPOINTMENT_STATUS_LABEL,
  type AppointmentStatus,
} from "@/lib/appointments";
import {
  APPOINTMENT_BOOKING_PAYMENT_BADGE,
  APPOINTMENT_BOOKING_PAYMENT_LABEL,
  type AppointmentBookingPaymentStatus,
} from "@/lib/appointment-payment-status";
import {
  AppointmentArrivedButton,
  AppointmentConfirmReject,
  AppointmentNoShowButton,
  AppointmentRescheduleButton,
} from "./appointment-row-actions";

export type BulkAppointmentRow = {
  id: string;
  displayName: string;
  phoneLine: string | null;
  branchName: string;
  categoryNames: string[];
  requestedAtLabel: string;
  requestedAtIso: string;
  orderScheduledLabel: string | null;
  note: string | null;
  status: AppointmentStatus;
  bookingPaymentStatus: AppointmentBookingPaymentStatus;
  serviceOrderId: string | null;
  serviceOrderNumber: string | null;
  orderHref: string;
  canConfirm: boolean;
  arrived: boolean;
};

export type AppointmentCategoryOption = { id: string; name: string };

/**
 * Цаг захиалгын жагсаалтын хүснэгт — захиалгын хүснэгттэй адил (харах:
 * app/dashboard/orders/bulk-orders-table.tsx) мөр бүрт үргэлж checkbox
 * харагдана, "горим" асаах шаардлагагүй.
 */
export function BulkAppointmentsTable({
  rows,
  categories,
  canBulkEdit,
  canRespond,
}: {
  rows: BulkAppointmentRow[];
  categories: AppointmentCategoryOption[];
  canBulkEdit: boolean;
  canRespond: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  function toggleAll() {
    setSelected((prev) => {
      if (rows.length > 0 && rows.every((r) => prev.has(r.id))) return new Set();
      return new Set(rows.map((r) => r.id));
    });
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  return (
    <div className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] overflow-hidden flex-1 min-h-0 flex flex-col">
      {canBulkEdit && selected.size > 0 ? (
        <div
          data-stop-row-click
          className="px-4 py-2.5 border-b border-[var(--oc-line)] flex flex-wrap items-center gap-3 text-xs text-[var(--oc-muted3)]"
        >
          <span>{selected.size} цаг захиалга сонгогдсон</span>
          <Btn
            type="button"
            size="sm"
            disabled={categories.length === 0}
            title={categories.length === 0 ? "Идэвхтэй ажлын төрөл алга." : undefined}
            onClick={() => setCategoryPickerOpen(true)}
          >
            Ажлын төрөл солих
          </Btn>
          <button
            type="button"
            onClick={clearSelection}
            className="text-[var(--oc-muted3)] hover:text-[var(--oc-ink2)] underline underline-offset-2"
          >
            Сонголт цэвэрлэх
          </button>
        </div>
      ) : null}

      <div className="overflow-auto flex-1 min-h-0">
        <table className="w-full min-w-[760px]">
          <thead>
            <tr className="border-b border-[var(--oc-line)]">
              {canBulkEdit ? (
                <th className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Бүгдийг сонгох"
                  />
                </th>
              ) : null}
              {["Үйлчлүүлэгч", "Салбар", "Хүссэн цаг", "Тэмдэглэл", "Төлөв", "Үйлдэл"].map(
                (h) => (
                  <th
                    key={h}
                    className="text-left font-plex-mono text-[10.5px] uppercase tracking-[0.08em] text-[var(--oc-muted3)] font-medium px-5 py-3"
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--oc-line)]">
            {rows.map((a) => (
              <tr key={a.id} className="hover:bg-white/[0.02] transition-colors">
                {canBulkEdit ? (
                  <td className="w-10 px-3 py-4" data-stop-row-click>
                    <input
                      type="checkbox"
                      checked={selected.has(a.id)}
                      onChange={() => toggleOne(a.id)}
                      aria-label={`${a.displayName} сонгох`}
                    />
                  </td>
                ) : null}
                <td className="px-5 py-4">
                  <div className="text-sm font-medium text-[var(--oc-ink)]">
                    {a.displayName}
                  </div>
                  {a.phoneLine ? (
                    <div className="font-plex-mono text-xs text-[var(--oc-muted3)]">
                      {a.phoneLine}
                    </div>
                  ) : null}
                </td>
                <td className="px-5 py-4 text-sm text-[var(--oc-muted2)]">
                  {a.branchName}
                  {a.categoryNames.length ? (
                    <span className="block text-xs text-[var(--oc-muted3)] mt-0.5">
                      {a.categoryNames.join(", ")}
                    </span>
                  ) : null}
                </td>
                <td className="px-5 py-4 font-plex-mono text-sm text-[var(--oc-muted2)] whitespace-nowrap">
                  {a.requestedAtLabel}
                  {a.orderScheduledLabel ? (
                    <span className="block text-xs text-[var(--oc-muted3)] mt-0.5">
                      {a.orderScheduledLabel}
                    </span>
                  ) : null}
                </td>
                <td className="px-5 py-4 text-sm text-[var(--oc-muted3)] max-w-[220px] truncate">
                  {a.note || "—"}
                </td>
                <td className="px-5 py-4">
                  <span
                    className={`font-plex-mono text-[11px] px-2.5 py-1 rounded-full ${APPOINTMENT_STATUS_BADGE[a.status]}`}
                  >
                    {APPOINTMENT_STATUS_LABEL[a.status]}
                  </span>
                  {a.bookingPaymentStatus !== "NOT_REQUIRED" ? (
                    <span
                      className={`block w-fit mt-1 font-plex-mono text-[10px] px-2 py-0.5 rounded-full border ${APPOINTMENT_BOOKING_PAYMENT_BADGE[a.bookingPaymentStatus]}`}
                    >
                      {APPOINTMENT_BOOKING_PAYMENT_LABEL[a.bookingPaymentStatus]}
                    </span>
                  ) : null}
                </td>
                <td className="px-5 py-4" data-stop-row-click>
                  <div className="flex items-center justify-end gap-2">
                    {a.status === "CONFIRMED" && a.serviceOrderId ? (
                      <BtnLink
                        href={`/dashboard/orders/${a.serviceOrderId}`}
                        variant="ghost"
                        size="sm"
                        className="whitespace-nowrap"
                      >
                        №{a.serviceOrderNumber} харах
                      </BtnLink>
                    ) : null}

                    {canRespond && a.status === "PENDING" ? (
                      <AppointmentConfirmReject
                        appointmentId={a.id}
                        canConfirm={a.canConfirm}
                      />
                    ) : null}

                    {canRespond && a.status === "CONFIRMED" && !a.serviceOrderId ? (
                      <>
                        <BtnLink
                          href={a.orderHref}
                          size="sm"
                          className="whitespace-nowrap"
                        >
                          Засварын хуудас үүсгэх →
                        </BtnLink>
                        {!a.arrived ? (
                          <>
                            <AppointmentArrivedButton appointmentId={a.id} />
                            <AppointmentNoShowButton appointmentId={a.id} />
                            <AppointmentRescheduleButton
                              appointmentId={a.id}
                              requestedAt={a.requestedAtIso}
                            />
                          </>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {categoryPickerOpen ? (
        <BulkCategoryModal
          appointmentIds={[...selected]}
          categories={categories}
          onClose={() => setCategoryPickerOpen(false)}
          onDone={() => {
            setCategoryPickerOpen(false);
            clearSelection();
          }}
        />
      ) : null}
    </div>
  );
}

function BulkCategoryModal({
  appointmentIds,
  categories,
  onClose,
  onDone,
}: {
  appointmentIds: string[];
  categories: AppointmentCategoryOption[];
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [state, formAction, pending] = useActionState<BulkActionState, FormData>(
    bulkChangeAppointmentCategoryAction,
    null,
  );

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      if (state.failed) {
        toast.warning("Хэсэгчлэн амжилттай", state.message);
      } else {
        toast.success("Амжилттай", state.message);
      }
      onDone();
    } else if (state.message) {
      toast.error("Алдаа гарлаа", state.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function toggleCategory(id: string) {
    setSelectedCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  return (
    <Modal open onClose={onClose} title="Ажлын төрөл солих" widthClassName="max-w-md">
      <form action={formAction} className="flex flex-col gap-4">
        <input
          type="hidden"
          name="appointmentIdsJson"
          value={JSON.stringify(appointmentIds)}
        />
        {selectedCategoryIds.map((id) => (
          <input key={id} type="hidden" name="categoryIds" value={id} />
        ))}
        <p className="text-sm text-[var(--oc-muted2)]">
          {appointmentIds.length} цаг захиалгын ажлын төрлийг солих гэж байна. Засварын
          хуудас аль хэдийн үүссэн цаг захиалгыг алгасна.
        </p>
        <div>
          <label className="text-xs text-[var(--oc-muted3)] mb-1 block">
            Ажлын төрөл
          </label>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => {
              const checked = selectedCategoryIds.includes(c.id);
              return (
                <label
                  key={c.id}
                  className={`px-3 py-1.5 rounded-lg border text-sm cursor-pointer transition-colors select-none ${
                    checked
                      ? "border-[var(--oc-accent)] bg-[var(--oc-accent)]/[0.08] text-[var(--oc-accent)]"
                      : "border-[var(--oc-line)] text-[var(--oc-muted2)] hover:border-[var(--oc-line2)]"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    onChange={() => toggleCategory(c.id)}
                  />
                  {c.name}
                </label>
              );
            })}
          </div>
        </div>
        {state && !state.ok && state.errors?.length ? (
          <ul className="text-xs text-red-400 light:text-red-600 flex flex-col gap-0.5 max-h-32 overflow-auto">
            {state.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        ) : null}
        <div className="flex justify-end gap-2">
          <Btn type="button" variant="ghost" onClick={onClose}>
            Болих
          </Btn>
          <Btn type="submit" disabled={pending || selectedCategoryIds.length === 0}>
            {pending ? "Хадгалж..." : "Хадгалах"}
          </Btn>
        </div>
      </form>
    </Modal>
  );
}
