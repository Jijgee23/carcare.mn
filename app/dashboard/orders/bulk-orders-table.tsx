"use client";

import { useEffect, useState } from "react";
import { useActionState } from "react";
import Link from "next/link";
import {
  bulkAssignOrderAction,
  bulkChangeOrderStatusAction,
  type BulkOrderActionState,
} from "@/app/_actions/orders";
import { Btn } from "@/app/_components/landing-ops-ui";
import { Modal } from "@/app/_components/modal";
import { Select } from "@/app/_components/select";
import { useToast } from "@/app/_components/toast";
import {
  ITEM_KIND_BADGE,
  ITEM_KIND_LABEL,
  ORDER_STATUSES,
  ORDER_STATUS_BADGE,
  ORDER_STATUS_LABEL,
  PAYMENT_STATUS_BADGE,
  PAYMENT_STATUS_LABEL,
  POSTPAID_BADGE,
  POSTPAID_LABEL,
  type ItemKind,
  type OrderStatus,
  type PaymentStatus,
} from "@/lib/orders";
import { OrderRow } from "./order-row";

export type BulkOrderRow = {
  id: string;
  number: string;
  customerLabel: string;
  vehicleMakeModel: string;
  vehiclePlate: string;
  items: { id: string; description: string; kind: ItemKind }[];
  itemCount: number;
  branchName: string;
  assignedToLabel: string | null;
  scheduledAtLabel: string | null;
  totalLabel: string;
  paymentStatus: PaymentStatus;
  isPostpaid: boolean;
  status: OrderStatus;
};

export type AssignableEmployee = { id: string; label: string };

/**
 * Захиалгын жагсаалтын хүснэгт — мөр бүрт үргэлж checkbox харагдана
 * (тусгай "горим" асаах шаардлагагүй). Дор хаяж нэг захиалга сонгогдмогц
 * хөвөгч цэсэнд статус/хариуцагч өөрчлөх товч гарч ирнэ.
 */
export function BulkOrdersTable({
  rows,
  employees,
  canBulkEdit,
  canAssign,
  currentUserId,
}: {
  rows: BulkOrderRow[];
  employees: AssignableEmployee[];
  canBulkEdit: boolean;
  canAssign: boolean;
  currentUserId: string;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [statusPickerOpen, setStatusPickerOpen] = useState(false);
  const [assignPickerOpen, setAssignPickerOpen] = useState(false);

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
    <>
      {canBulkEdit && selected.size > 0 ? (
        <div
          data-stop-row-click
          className="px-4 py-2.5 border-b border-[var(--oc-line)] flex flex-wrap items-center gap-3 text-xs text-[var(--oc-muted3)]"
        >
          <span>{selected.size} захиалга сонгогдсон</span>
          <Btn type="button" size="sm" onClick={() => setStatusPickerOpen(true)}>
            Статус солих
          </Btn>
          <Btn
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setAssignPickerOpen(true)}
          >
            Хариуцагч оноох
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
        <table className="w-full min-w-[800px]">
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
              {[
                "#",
                "Үйлчлүүлэгч",
                "Машин",
                "Үйлчилгээ",
                "Салбар",
                "Хариуцагч",
                "Огноо",
                "Дүн",
                "Статус",
              ].map((h) => (
                <th
                  key={h}
                  className="text-left text-xs text-[var(--oc-muted3)] font-medium px-5 py-3"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <OrderRow key={o.id} href={`/dashboard/orders/${o.id}`}>
                {canBulkEdit ? (
                  <td className="w-10 px-3 py-4" data-stop-row-click>
                    <input
                      type="checkbox"
                      checked={selected.has(o.id)}
                      onChange={() => toggleOne(o.id)}
                      aria-label={`#${o.number} сонгох`}
                    />
                  </td>
                ) : null}
                <td className="px-5 py-4">
                  <Link
                    href={`/dashboard/orders/${o.id}`}
                    className="font-mono text-sm font-semibold text-[var(--oc-accent)] hover:text-[var(--oc-accent-hi)]"
                  >
                    #{o.number}
                  </Link>
                </td>
                <td className="px-5 py-4 text-sm text-[var(--oc-ink2)]">{o.customerLabel}</td>
                <td className="px-5 py-4 text-sm">
                  <div className="text-[var(--oc-ink2)]">{o.vehicleMakeModel}</div>
                  <div className="text-xs text-[var(--oc-muted3)] font-mono">
                    {o.vehiclePlate}
                  </div>
                </td>
                <td className="px-5 py-4 text-xs">
                  {o.itemCount === 0 ? (
                    <span className="text-[var(--oc-muted3)]">—</span>
                  ) : (
                    <div className="flex flex-col gap-1 max-w-[220px]">
                      {o.items.map((it) => (
                        <div key={it.id} className="flex items-center gap-1.5">
                          <span
                            className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full ${
                              ITEM_KIND_BADGE[it.kind]
                            }`}
                          >
                            {ITEM_KIND_LABEL[it.kind]}
                          </span>
                          <span className="text-[var(--oc-muted2)] truncate">
                            {it.description}
                          </span>
                        </div>
                      ))}
                      {o.itemCount > o.items.length ? (
                        <span className="text-[var(--oc-muted3)]">
                          +{o.itemCount - o.items.length} өөр
                        </span>
                      ) : null}
                    </div>
                  )}
                </td>
                <td className="px-5 py-4 text-sm text-[var(--oc-muted2)]">{o.branchName}</td>
                <td className="px-5 py-4 text-sm text-[var(--oc-muted2)]">
                  {o.assignedToLabel ?? "—"}
                </td>
                <td className="px-5 py-4 text-xs text-[var(--oc-muted3)]">
                  {o.scheduledAtLabel ?? "—"}
                </td>
                <td className="px-5 py-4 text-sm">
                  <div className="text-[var(--oc-ink2)]">{o.totalLabel}</div>
                  <span
                    className={`mt-1 inline-block whitespace-nowrap text-[10px] px-1.5 py-0.5 rounded-full ${
                      PAYMENT_STATUS_BADGE[o.paymentStatus]
                    }`}
                  >
                    {PAYMENT_STATUS_LABEL[o.paymentStatus]}
                  </span>
                  {o.isPostpaid ? (
                    <span
                      className={`mt-1 ml-1 inline-block whitespace-nowrap text-[10px] px-1.5 py-0.5 rounded-full ${POSTPAID_BADGE}`}
                    >
                      {POSTPAID_LABEL}
                    </span>
                  ) : null}
                </td>
                <td className="px-5 py-4">
                  <span
                    className={`inline-block whitespace-nowrap text-xs px-2.5 py-1 rounded-full ${
                      ORDER_STATUS_BADGE[o.status]
                    }`}
                  >
                    {ORDER_STATUS_LABEL[o.status]}
                  </span>
                </td>
              </OrderRow>
            ))}
          </tbody>
        </table>
      </div>

      {statusPickerOpen ? (
        <BulkStatusModal
          orderIds={[...selected]}
          onClose={() => setStatusPickerOpen(false)}
          onDone={() => {
            setStatusPickerOpen(false);
            clearSelection();
          }}
        />
      ) : null}
      {assignPickerOpen ? (
        <BulkAssignModal
          orderIds={[...selected]}
          employees={employees}
          canAssign={canAssign}
          currentUserId={currentUserId}
          onClose={() => setAssignPickerOpen(false)}
          onDone={() => {
            setAssignPickerOpen(false);
            clearSelection();
          }}
        />
      ) : null}
    </>
  );
}

function BulkStatusModal({
  orderIds,
  onClose,
  onDone,
}: {
  orderIds: string[];
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [state, formAction, pending] = useActionState<BulkOrderActionState, FormData>(
    bulkChangeOrderStatusAction,
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

  return (
    <Modal open onClose={onClose} title="Статус солих" widthClassName="max-w-md">
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="orderIdsJson" value={JSON.stringify(orderIds)} />
        <p className="text-sm text-[var(--oc-muted2)]">
          {orderIds.length} захиалгын статусыг өөрчлөх гэж байна. Тухайн захиалгаас
          шилжих боломжгүй статус сонгогдвол зөвхөн тэр захиалгыг алгасна.
        </p>
        <div>
          <label className="text-xs text-[var(--oc-muted3)] mb-1 block">
            Шинэ статус
          </label>
          <Select
            name="status"
            required
            placeholder="— Статус сонгох —"
            options={ORDER_STATUSES.map((st) => ({
              value: st,
              label: ORDER_STATUS_LABEL[st],
            }))}
          />
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
          <Btn type="submit" disabled={pending}>
            {pending ? "Хадгалж..." : "Хадгалах"}
          </Btn>
        </div>
      </form>
    </Modal>
  );
}

function BulkAssignModal({
  orderIds,
  employees,
  canAssign,
  currentUserId,
  onClose,
  onDone,
}: {
  orderIds: string[];
  employees: AssignableEmployee[];
  canAssign: boolean;
  currentUserId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [state, formAction, pending] = useActionState<BulkOrderActionState, FormData>(
    bulkAssignOrderAction,
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

  return (
    <Modal open onClose={onClose} title="Хариуцагч оноох" widthClassName="max-w-md">
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="orderIdsJson" value={JSON.stringify(orderIds)} />
        <p className="text-sm text-[var(--oc-muted2)]">
          {orderIds.length} захиалганд нэг зэрэг хариуцагч оноох гэж байна.
        </p>
        {canAssign ? (
          <div>
            <label className="text-xs text-[var(--oc-muted3)] mb-1 block">
              Хариуцагч
            </label>
            <Select
              name="assignedToId"
              defaultValue=""
              placeholder="— Хариуцагчгүй болгох —"
              options={employees.map((e) => ({ value: e.id, label: e.label }))}
            />
          </div>
        ) : (
          <>
            <input type="hidden" name="assignedToId" value={currentUserId} />
            <p className="text-sm text-[var(--oc-muted2)]">
              Танд бусдыг хариуцагчаар оноох эрх байхгүй тул зөвхөн өөрийгөө
              оноож болно.
            </p>
          </>
        )}
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
          <Btn type="submit" disabled={pending}>
            {pending ? "Хадгалж..." : "Хадгалах"}
          </Btn>
        </div>
      </form>
    </Modal>
  );
}
