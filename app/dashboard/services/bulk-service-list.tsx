"use client";

import { useEffect, useState } from "react";
import { useActionState } from "react";
import Link from "next/link";
import {
  bulkChangeServiceCategoryAction,
  deleteServiceAction,
} from "@/app/_actions/services";
import type { BulkActionState } from "@/lib/bulk-action";
import { Btn } from "@/app/_components/landing-ops-ui";
import { ClickableRow } from "@/app/_components/clickable-row";
import { ConfirmForm } from "@/app/_components/confirm-form";
import { Chip } from "@/app/_components/landing-ops-ui";
import { Modal } from "@/app/_components/modal";
import {
  SelectAllCell,
  SelectRowCell,
  SelectionActions,
  useRowSelection,
} from "@/app/_components/row-selection";
import { Select } from "@/app/_components/select";
import { useToast } from "@/app/_components/toast";
import { formatTugrik } from "@/lib/orders";
import { STOCK_LABEL, formatDuration, formatStock, stockLevel, type StockLevel } from "@/lib/services";

const STOCK_TONE: Record<StockLevel, "danger" | "warn" | "ok"> = {
  out: "danger",
  low: "warn",
  ok: "ok",
};

export type BulkServiceRow = {
  id: string;
  code: string | null;
  name: string;
  description: string | null;
  categoryName: string | null;
  isActive: boolean;
  itemsCount: number;
  unitName: string | null;
  durationValue: string | null;
  durationUnitName: string | null;
  price: string;
  costPrice: string | null;
  stock: string | null;
};

export type ServiceCategoryOption = { id: string; name: string };

/**
 * Үйлчилгээ/бараа жагсаалтын хүснэгт — захиалга/цаг захиалгын хүснэгттэй
 * адил (харах: app/dashboard/orders/bulk-orders-table.tsx,
 * app/dashboard/appointments/bulk-appointments-table.tsx) мөр бүрт үргэлж
 * checkbox харагдана, "горим" асаах шаардлагагүй.
 */
export function BulkServiceList({
  rows,
  categories,
  canBulkEdit,
  canRemove,
  isGoods,
}: {
  rows: BulkServiceRow[];
  categories: ServiceCategoryOption[];
  canBulkEdit: boolean;
  canRemove: boolean;
  isGoods: boolean;
}) {
  const selection = useRowSelection(rows);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);

  return (
    <>
      {canBulkEdit ? (
        <SelectionActions
          selection={selection}
          noun="мөр"
          actions={[
            {
              label: "Ангилал солих",
              disabled: categories.length === 0,
              title: categories.length === 0 ? "Идэвхтэй ангилал алга." : undefined,
              onSelect: () => setCategoryPickerOpen(true),
            },
          ]}
        />
      ) : null}

      <div className="overflow-auto flex-1 min-h-0">
        <table className="w-full min-w-[760px]">
          <thead>
            <tr className="border-b border-[var(--oc-line)]">
              {canBulkEdit ? (
                <SelectAllCell selection={selection} />
              ) : null}
              {(isGoods
                ? ["Код", "Нэр", "Ангилал", "Үлдэгдэл", "Өртөг", "Үнэ", "Статус", "Үйлдэл"]
                : ["Код", "Нэр", "Ангилал", "Хугацаа", "Үнэ", "Хэрэглэсэн", "Төлөв", "Үйлдэл"]
              ).map((h) => (
                <th
                  key={h}
                  className="text-left font-plex-mono text-[10.5px] uppercase tracking-[0.08em] text-[var(--oc-muted3)] font-medium px-5 py-3"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--oc-line)]" {...selection.dragArea}>
            {rows.map((svc) => {
              const stockNum = svc.stock ? Number.parseFloat(svc.stock) : 0;
              const level = isGoods ? stockLevel(stockNum) : null;
              const href = `/dashboard/services/${svc.id}`;
              return (
                <ClickableRow
                  key={svc.id}
                  href={href}
                  className="border-b border-[var(--oc-line)] last:border-0 hover:bg-white/[0.03] transition-colors cursor-pointer"
                >
                  {canBulkEdit ? (
                    <SelectRowCell
                      selection={selection}
                      id={svc.id}
                      label={`${svc.name} сонгох`}
                    />
                  ) : null}
                  <td className="px-5 py-4 font-plex-mono text-xs text-[var(--oc-muted2)]">
                    {svc.code ?? "—"}
                  </td>
                  <td className="px-5 py-4">
                    <Link
                      href={href}
                      className="text-sm font-medium text-[var(--oc-ink)] hover:text-[var(--oc-accent-hi)] transition-colors"
                    >
                      {svc.name}
                    </Link>
                    {svc.description ? (
                      <div className="text-xs text-[var(--oc-muted3)] mt-0.5 line-clamp-1">
                        {svc.description}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-5 py-4 text-sm">
                    {svc.categoryName ? (
                      <Chip tone="neutral" bordered>
                        {svc.categoryName}
                      </Chip>
                    ) : (
                      <span className="text-[var(--oc-muted4)] text-xs">—</span>
                    )}
                  </td>
                  {isGoods ? (
                    <td className="px-5 py-4 text-sm text-[var(--oc-ink2)]">
                      {formatStock(stockNum, svc.unitName)}
                    </td>
                  ) : (
                    <td className="px-5 py-4 text-sm text-[var(--oc-ink2)]">
                      {formatDuration(svc.durationValue, svc.durationUnitName)}
                    </td>
                  )}
                  {isGoods ? (
                    <td className="px-5 py-4 font-plex-mono text-sm text-[var(--oc-muted2)]">
                      {svc.costPrice ? formatTugrik(svc.costPrice) : "—"}
                    </td>
                  ) : (
                    <td className="px-5 py-4 font-plex-mono text-sm text-[var(--oc-ink2)]">
                      {formatTugrik(svc.price)}
                      {svc.unitName ? (
                        <span className="text-[var(--oc-muted4)]">{" / "}{svc.unitName}</span>
                      ) : null}
                    </td>
                  )}
                  {isGoods ? (
                    <td className="px-5 py-4 font-plex-mono text-sm text-[var(--oc-ink2)]">
                      {formatTugrik(svc.price)}
                    </td>
                  ) : (
                    <td className="px-5 py-4 font-plex-mono text-sm text-[var(--oc-muted2)]">
                      {svc.itemsCount}
                    </td>
                  )}
                  <td className="px-5 py-4">
                    {isGoods && level ? (
                      <Chip tone={STOCK_TONE[level]}>{STOCK_LABEL[level]}</Chip>
                    ) : (
                      <Chip tone={svc.isActive ? "ok" : "neutral"}>
                        {svc.isActive ? "Идэвхтэй" : "Идэвхгүй"}
                      </Chip>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    {canRemove ? (
                      <div className="flex items-center justify-end" data-stop-row-click>
                        <ConfirmForm
                          action={deleteServiceAction}
                          message={
                            svc.itemsCount > 0
                              ? `"${svc.name}" үйлчилгээг архивлах уу?`
                              : `"${svc.name}" үйлчилгээг устгах уу?`
                          }
                        >
                          <input type="hidden" name="id" value={svc.id} />
                          <button
                            type="submit"
                            className="text-xs text-red-400 hover:text-red-300 light:text-red-600 light:hover:text-red-700 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-red-500/10"
                            title={
                              svc.itemsCount > 0
                                ? "Засварын хуудсанд ашиглагдсан тул архивлагдана"
                                : "Устгана"
                            }
                          >
                            {svc.itemsCount > 0 ? "Архив" : "Устгах"}
                          </button>
                        </ConfirmForm>
                      </div>
                    ) : null}
                  </td>
                </ClickableRow>
              );
            })}
          </tbody>
        </table>
      </div>

      {categoryPickerOpen ? (
        <BulkCategoryModal
          serviceIds={[...selection.selected]}
          categories={categories}
          onClose={() => setCategoryPickerOpen(false)}
          onDone={() => {
            setCategoryPickerOpen(false);
            selection.clear();
          }}
        />
      ) : null}
    </>
  );
}

function BulkCategoryModal({
  serviceIds,
  categories,
  onClose,
  onDone,
}: {
  serviceIds: string[];
  categories: ServiceCategoryOption[];
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [state, formAction, pending] = useActionState<BulkActionState, FormData>(
    bulkChangeServiceCategoryAction,
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
    <Modal open onClose={onClose} title="Ангилал солих" widthClassName="max-w-md">
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="serviceIdsJson" value={JSON.stringify(serviceIds)} />
        <p className="text-sm text-[var(--oc-muted2)]">
          {serviceIds.length} мөрийн ангиллыг нэг зэрэг солих гэж байна.
        </p>
        <div>
          <label className="text-xs text-[var(--oc-muted3)] mb-1 block">
            Шинэ ангилал
          </label>
          <Select
            name="categoryId"
            required
            placeholder="— Ангилал сонгох —"
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
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
