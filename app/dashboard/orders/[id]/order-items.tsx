"use client";

import { Fragment, useState } from "react";
import { removeOrderItemAction } from "@/app/_actions/orders";
import {
  ITEM_KIND_LABEL,
  type ItemKind,
  formatTugrik,
} from "@/lib/orders";

// Захиалгын мөр — серверээс plain string-ээр дамжина (Decimal биш).
export type OrderItemLite = {
  id: string;
  kind: string;
  description: string;
  quantity: string;
  unitPrice: string;
  total: string;
};

// Харуулах дараалал: Ажил → Оношилгоо → Сэлбэг → Хураамж
const KIND_ORDER: ItemKind[] = ["LABOR", "DIAGNOSTIC", "PART", "FEE"];

function qtyText(q: string): string {
  const n = Number.parseFloat(q);
  return Number.isFinite(n) ? n.toLocaleString("mn-MN") : q;
}

/**
 * Үйлчилгээний мөрүүдийг төрлөөр нь tab болгож харуулна. "Бүгд" tab дээр
 * төрөл тус бүрийн жижиг гарчигтайгаар, тодорхой tab дээр зөвхөн тухайн
 * төрлийн мөрүүдийг харуулна. Доор төрөл бүрийн дэд дүн + нийт дүн.
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
      (acc, i) => acc + (Number.parseFloat(i.total) || 0),
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
            {canEdit ? <th className="w-9" aria-label="Үйлдэл" /> : null}
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
              {g.items.map((it) => (
                <tr
                  key={it.id}
                  className="hover:bg-white/[0.02] transition-colors"
                >
                  <td className="px-5 py-2.5 text-[var(--oc-ink)]">
                    {it.description}
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
                  <td className="px-5 py-2.5 text-right font-plex-mono font-semibold text-[var(--oc-ink)] tabular-nums whitespace-nowrap">
                    {formatTugrik(it.total)}
                  </td>
                  {canEdit ? (
                    <td className="pr-3 py-2.5 text-right">
                      <form action={removeOrderItemAction}>
                        <input type="hidden" name="itemId" value={it.id} />
                        <button
                          type="submit"
                          aria-label={`"${it.description}" мөрийг устгах`}
                          title="Мөр устгах"
                          className="w-7 h-7 rounded-lg inline-flex items-center justify-center text-[var(--oc-muted4)] hover:text-red-400 hover:bg-red-500/10 light:hover:text-red-600 transition-colors"
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
                    </td>
                  ) : null}
                </tr>
              ))}
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
