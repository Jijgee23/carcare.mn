"use client";

import { Fragment, useState } from "react";
import {
  cancelOrderItemAction,
  changeOrderItemStatusAction,
} from "@/app/_actions/orders";
import {
  ITEM_KIND_LABEL,
  SERVICE_ITEM_STATUSES,
  SERVICE_ITEM_STATUS_BADGE,
  SERVICE_ITEM_STATUS_LABEL,
  canChangeServiceItemStatus,
  formatTugrik,
  isServiceItemCancellable,
  type ItemKind,
  type ServiceItemStatus,
} from "@/lib/orders";

// Цуцлахаас бусад бүх явц — чөлөөтэй сонгож болно.
const CHANGEABLE_STATUSES = SERVICE_ITEM_STATUSES.filter(
  (s) => s !== "CANCELLED",
);

// Засварын хуудасны мөр — серверээс plain string-ээр дамжина (Decimal биш).
export type OrderItemLite = {
  id: string;
  kind: string;
  description: string;
  quantity: string;
  unitPrice: string;
  total: string;
  status: string;
  cancelledAt: string | null;
  cancelledByName: string | null;
};

// Харуулах дараалал: Ажил → Оношилгоо → Сэлбэг → Хураамж
const KIND_ORDER: ItemKind[] = ["LABOR", "DIAGNOSTIC", "PART", "FEE"];

function qtyText(q: string): string {
  const n = Number.parseFloat(q);
  return Number.isFinite(n) ? n.toLocaleString("mn-MN") : q;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

// Intl.toLocaleString("mn-MN") ашиглахгүй — зарим орчинд (client дээр
// mn-MN locale өгөгдөл байхгүй бол) server/client өөр форматтай гарч
// hydration mismatch өгдөг. Гараар форматлавал аль ч орчинд ижил байна.
function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return `${d.getFullYear()}.${pad2(d.getMonth() + 1)}.${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/**
 * Үйлчилгээний мөрүүдийг төрлөөр нь tab болгож харуулна. "Бүгд" tab дээр
 * төрөл тус бүрийн жижиг гарчигтайгаар, тодорхой tab дээр зөвхөн тухайн
 * төрлийн мөрүүдийг харуулна. Доор төрөл бүрийн дэд дүн + нийт дүн.
 * Мөр бүр явцтай (хүлээгдэж буй/эхэлсэн/дууссан/цуцлагдсан) — цуцлагдсан мөр
 * УСТГАГДАХГҮЙ, харагдана (харин дүнд орохгүй) — цуцалсан хүн/огноог хадгална.
 */
export function OrderItems({
  items,
  canEdit,
}: {
  items: OrderItemLite[];
  canEdit: boolean;
}) {
  const groups = KIND_ORDER.map((kind) => {
    const list = items.filter((i) => i.kind === kind);
    const subtotal = list.reduce(
      (acc, i) =>
        acc + (i.status === "CANCELLED" ? 0 : Number.parseFloat(i.total) || 0),
      0,
    );
    return { kind, items: list, subtotal };
  }).filter((g) => g.items.length > 0);

  const grandTotal = groups.reduce((acc, g) => acc + g.subtotal, 0);

  const [tab, setTab] = useState<ItemKind | "ALL">("ALL");
  // Идэвхтэй tab байхгүй болсон бол (мөр устгасны дараа) "Бүгд" рүү унана.
  const tabExists = tab === "ALL" || groups.some((g) => g.kind === tab);
  const activeTab = tabExists ? tab : "ALL";
  const visibleGroups =
    activeTab === "ALL" ? groups : groups.filter((g) => g.kind === activeTab);

  return (
    <div>
      {/* Tabs */}
      <div className="flex items-center gap-1.5 px-3 py-2.5 border-b border-[var(--oc-line)] overflow-x-auto">
        <TabButton
          active={activeTab === "ALL"}
          onClick={() => setTab("ALL")}
          label="Бүгд"
          count={items.length}
        />
        {groups.map((g) => (
          <TabButton
            key={g.kind}
            active={activeTab === g.kind}
            onClick={() => setTab(g.kind)}
            label={ITEM_KIND_LABEL[g.kind]}
            count={g.items.length}
            kind={g.kind}
          />
        ))}
      </div>

      {/* Мөрүүд — багана толгойтой хүснэгт: Тоо / Нэгж үнэ / Дүн зэрэгцэнэ */}
      <table className="w-full text-sm">
        <thead>
          <tr className="font-plex-mono text-[10.5px] uppercase tracking-[0.08em] text-[var(--oc-muted3)] border-b border-[var(--oc-line)]">
            <th className="text-left font-medium px-5 py-2">Үйлчилгээ</th>
            <th className="hidden sm:table-cell text-right font-medium px-2 py-2 w-16">
              Тоо
            </th>
            <th className="hidden sm:table-cell text-right font-medium px-2 py-2 w-28">
              Нэгж үнэ
            </th>
            <th className="text-right font-medium px-5 py-2 w-32">Дүн</th>
            {canEdit ? <th className="w-32" aria-label="Үйлдэл" /> : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--oc-line)]">
          {visibleGroups.map((g) => (
            <Fragment key={g.kind}>
              {activeTab === "ALL" ? (
                /* Бүлгийн гарчиг — хэсгийн толгой шиг уншигдана */
                <tr className="bg-[var(--oc-panel2)]">
                  <td colSpan={canEdit ? 5 : 4} className="px-5 py-1.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${ITEM_KIND_DOT[g.kind]}`}
                      />
                      <span className="font-plex-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-[var(--oc-muted3)]">
                        {ITEM_KIND_LABEL[g.kind]} · {g.items.length}
                      </span>
                      <span className="ml-auto font-plex-mono text-xs text-[var(--oc-muted2)] tabular-nums">
                        {formatTugrik(g.subtotal)}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : null}
              {g.items.map((it) => {
                const status = it.status as ServiceItemStatus;
                const cancelled = status === "CANCELLED";
                return (
                  <tr
                    key={it.id}
                    className="hover:bg-white/[0.02] transition-colors"
                  >
                    <td
                      className={`px-5 py-2.5 border-l-[3px] ${ITEM_KIND_ROW_BORDER[g.kind]} ${cancelled ? "opacity-50" : "text-[var(--oc-ink)]"}`}
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cancelled ? "line-through" : ""}>
                          {it.description}
                        </span>
                        <span
                          className={`shrink-0 font-plex-mono text-[9px] px-1.5 py-0.5 rounded-full ${SERVICE_ITEM_STATUS_BADGE[status]}`}
                        >
                          {SERVICE_ITEM_STATUS_LABEL[status]}
                        </span>
                      </div>
                      {cancelled && it.cancelledAt ? (
                        <div className="text-[11px] text-[var(--oc-muted3)] mt-0.5">
                          Цуцалсан: {it.cancelledByName ?? "—"} ·{" "}
                          {fmtDateTime(it.cancelledAt)}
                        </div>
                      ) : null}
                      {/* Нарийн дэлгэцэд тоо×үнэ нэрийн доор */}
                      <span className="sm:hidden block font-plex-mono text-xs text-[var(--oc-muted3)] tabular-nums mt-0.5">
                        {qtyText(it.quantity)} × {formatTugrik(it.unitPrice)}
                      </span>
                    </td>
                    <td className="hidden sm:table-cell px-2 py-2.5 text-right font-plex-mono text-[var(--oc-muted2)] tabular-nums whitespace-nowrap">
                      {qtyText(it.quantity)}
                    </td>
                    <td className="hidden sm:table-cell px-2 py-2.5 text-right font-plex-mono text-[var(--oc-muted2)] tabular-nums whitespace-nowrap">
                      {formatTugrik(it.unitPrice)}
                    </td>
                    <td
                      className={`px-5 py-2.5 text-right font-plex-mono font-semibold tabular-nums whitespace-nowrap ${cancelled ? "opacity-50 line-through" : "text-[var(--oc-ink)]"}`}
                    >
                      {formatTugrik(it.total)}
                    </td>
                    {canEdit ? (
                      <td className="pr-3 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          {canChangeServiceItemStatus(status) ? (
                            <form action={changeOrderItemStatusAction}>
                              <input type="hidden" name="itemId" value={it.id} />
                              <select
                                name="status"
                                defaultValue={status}
                                title="Явц өөрчлөх"
                                onChange={(e) => e.currentTarget.form?.requestSubmit()}
                                className="compact-input !py-1 !px-1.5 !text-[11px] !rounded-lg max-w-[6.5rem]"
                              >
                                {CHANGEABLE_STATUSES.map((s) => (
                                  <option key={s} value={s}>
                                    {SERVICE_ITEM_STATUS_LABEL[s]}
                                  </option>
                                ))}
                              </select>
                            </form>
                          ) : null}
                          {isServiceItemCancellable(status) ? (
                            <form action={cancelOrderItemAction}>
                              <input type="hidden" name="itemId" value={it.id} />
                              <button
                                type="submit"
                                aria-label={`"${it.description}" мөрийг цуцлах`}
                                title="Цуцлах"
                                className="w-7 h-7 shrink-0 rounded-lg inline-flex items-center justify-center text-[var(--oc-muted4)] hover:text-red-400 hover:bg-red-500/10 light:hover:text-red-600 transition-colors"
                              >
                                <svg
                                  width="13"
                                  height="13"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.5"
                                  strokeLinecap="round"
                                  aria-hidden="true"
                                >
                                  <path d="M18 6 6 18" />
                                  <path d="m6 6 12 12" />
                                </svg>
                              </button>
                            </form>
                          ) : null}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </Fragment>
          ))}
        </tbody>
      </table>

      {/* Дүнгийн хураангуй */}
      <div className="px-5 py-4 bg-[var(--oc-panel2)] border-t border-[var(--oc-line)]">
        <div className="flex flex-col gap-1.5">
          {groups.length > 1
            ? groups.map((g) => (
                <div
                  key={g.kind}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-[var(--oc-muted3)]">{ITEM_KIND_LABEL[g.kind]}</span>
                  <span className="font-plex-mono text-[var(--oc-muted2)] tabular-nums">
                    {formatTugrik(g.subtotal)}
                  </span>
                </div>
              ))
            : null}
          <div className="flex items-center justify-between pt-2 mt-1 border-t border-[var(--oc-line)]">
            <span className="text-sm font-semibold text-[var(--oc-ink)]">Нийт дүн</span>
            <span className="font-plex-mono text-lg font-bold text-[var(--oc-accent)] tabular-nums">
              {formatTugrik(grandTotal)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count,
  kind,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  kind?: ItemKind;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        active
          ? "bg-[var(--oc-accent)] text-[var(--oc-on-accent)]"
          : "text-[var(--oc-muted2)] hover:text-[var(--oc-ink2)] hover:bg-white/[0.05]"
      }`}
    >
      {kind && !active ? (
        <span className={`w-1.5 h-1.5 rounded-full ${ITEM_KIND_DOT[kind]}`} />
      ) : null}
      {label}
      <span
        className={`font-plex-mono tabular-nums text-xs ${active ? "text-[var(--oc-on-accent)]/70" : "text-[var(--oc-muted3)]"}`}
      >
        {count}
      </span>
    </button>
  );
}

// Tab дээрх жижиг өнгөт цэг (badge-ийн өнгийг ойролцоо тусгана).
const ITEM_KIND_DOT: Record<ItemKind, string> = {
  LABOR: "bg-blue-400",
  DIAGNOSTIC: "bg-violet-400",
  PART: "bg-amber-400",
  FEE: "bg-zinc-400",
};

// Мөр бүрийн зүүн талын өнгөт хүрээ — "Бүгд" tab дээр ажил/оношилгоо/сэлбэг
// мөрүүдийг нэг харцаар ялгаж харуулна (badge-ийн өнгөтэй адил).
const ITEM_KIND_ROW_BORDER: Record<ItemKind, string> = {
  LABOR: "border-l-blue-500/60",
  DIAGNOSTIC: "border-l-violet-500/60",
  PART: "border-l-amber-500/60",
  FEE: "border-l-zinc-500/60",
};
