"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { Btn } from "./landing-ops-ui";
import { SELECT_KEY_ATTR, tableRowKeyAt, useDragSelect, type DragSelectHandle } from "./use-drag-select";

/**
 * Bulk үйлдэлтэй хүснэгтүүдийн мөр сонголт — нэг state, нэг зан төлөв:
 * - толгойн checkbox: бүгдийг сонгох/цэвэрлэх (хэсэгчлэн бол indeterminate)
 * - мөрийн checkbox: нэгийг toggle (гар/touch), хулганаар дараад чирвэл олон
 *   мөрийг нэг дор будна (харах: use-drag-select.ts)
 * - мөрийн аль ч хэсгээс (`<tbody>` дээр delegate) чирж өөр мөрөнд орвол мөн
 *   будна; линк/товч/input-аас эхэлсэн чирэлт хамаарахгүй
 * - мөр сонгогдсон үед хүснэгт дээр баруун товч → заагчийн байрлалд bulk
 *   үйлдлүүдийн цэс (`SelectionActions`); toolbar болон цэс нэг `actions`
 *   жагсаалтаас рендэрлэгдэнэ
 *
 * Хэрэглээ:
 *   const selection = useRowSelection(rows);
 *   <SelectionActions selection={selection} noun="захиалга" actions={[…]} />
 *   <SelectAllCell selection={selection} />        // <thead> дотор
 *   <tbody {...selection.dragArea}>                // мөрөөс чирж эхлэх / баруун товч
 *   <SelectRowCell selection={selection} id={r.id} label="…" />  // мөр бүрт
 */

/** Эдгээрээс эхэлсэн pointerdown мөрийн чирэлт эхлүүлэхгүй. */
const INTERACTIVE = "a, button, input, select, textarea, label, [data-stop-row-click]";
/** Эдгээр дээрх баруун товч browser-ын өөрийн цэсийг үлдээнэ (линк → шинэ tab г.м). */
const NATIVE_CONTEXT_MENU = "a, button, select, textarea, input:not([type=checkbox])";

export type BulkAction = {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  title?: string;
  variant?: "primary" | "ghost";
};

type MenuPosition = { x: number; y: number };

const EMPTY: ReadonlySet<string> = new Set();

export type RowSelection = {
  selected: ReadonlySet<string>;
  /** Харагдаж буй мөр бүр сонгогдсон. */
  allSelected: boolean;
  /** Харагдаж буй мөрүүдээс ядаж нэг нь сонгогдсон. */
  anySelected: boolean;
  toggle: (id: string) => void;
  toggleAll: () => void;
  clear: () => void;
  drag: DragSelectHandle;
  /** `<tbody>`-д spread хийнэ — мөрийн аль ч хэсгээс чирж эхлүүлнэ, баруун товч цэс. */
  dragArea: {
    onPointerDown: (e: PointerEvent<HTMLElement>) => void;
    onContextMenu: (e: MouseEvent<HTMLElement>) => void;
  };
  /** Баруун товчийн цэсний байрлал (`null` бол хаалттай). */
  menu: MenuPosition | null;
  closeMenu: () => void;
};

export function useRowSelection(rows: readonly { id: string }[]): RowSelection {
  const [selected, setSelected] = useState<ReadonlySet<string>>(EMPTY);

  const ids = useMemo(() => rows.map((r) => r.id), [rows]);
  const indexOf = useMemo(() => new Map(ids.map((id, i) => [id, i] as const)), [ids]);

  const rangeKeys = useCallback(
    (anchor: string, current: string) => {
      const a = indexOf.get(anchor);
      const b = indexOf.get(current);
      if (a === undefined || b === undefined) return null;
      return a <= b ? ids.slice(a, b + 1) : ids.slice(b, a + 1);
    },
    [ids, indexOf],
  );

  const drag = useDragSelect({ selected, setSelected, rangeKeys, keyAt: tableRowKeyAt });

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelected((prev) =>
      ids.length > 0 && ids.every((id) => prev.has(id)) ? EMPTY : new Set(ids),
    );
  }, [ids]);

  const clear = useCallback(() => setSelected(EMPTY), []);

  const [menu, setMenu] = useState<MenuPosition | null>(null);
  const closeMenu = useCallback(() => setMenu(null), []);

  let count = 0;
  for (const id of ids) if (selected.has(id)) count++;
  const anySelected = count > 0;

  const dragArea = useMemo(
    () => ({
      onPointerDown(e: PointerEvent<HTMLElement>) {
        if ((e.target as Element).closest(INTERACTIVE)) return;
        drag.onPointerDownDeferred(e);
      },
      onContextMenu(e: MouseEvent<HTMLElement>) {
        if (!anySelected || (e.target as Element).closest(NATIVE_CONTEXT_MENU)) return;
        e.preventDefault();
        setMenu({ x: e.clientX, y: e.clientY });
      },
    }),
    [drag, anySelected],
  );

  return {
    selected,
    allSelected: ids.length > 0 && count === ids.length,
    anySelected,
    toggle,
    toggleAll,
    clear,
    drag,
    dragArea,
    menu,
    closeMenu,
  };
}

/**
 * Сонголтын үйлдлүүд — хүснэгтийн дээрх toolbar ба баруун товчийн цэс (заагчийн
 * байрлалд) хоёулаа ижил `actions`-аас рендэрлэгдэнэ. Хоёуланд нь сүүлд
 * "Сонголт цэвэрлэх" автоматаар орно.
 *
 * Toolbar-ын мөр ҮРГЭЛЖ рендэрлэгдэнэ (сонголтгүй үед заавар харуулна): анхны
 * мөр сонгогдох мөчид toolbar шинээр гарч ирвэл хүснэгт доошоо шилжиж, чирж
 * буй заагчийн доорх мөр солигдох (илүү мөр сонгогдох) алдаа гардаг байсан.
 */
export function SelectionActions({
  selection,
  actions,
  noun,
}: {
  selection: RowSelection;
  actions: readonly BulkAction[];
  /** "{N} {noun} сонгогдсон" — ж: "захиалга", "ажилтан". */
  noun: string;
}) {
  const { selected, clear, menu, closeMenu } = selection;
  const count = selected.size;

  useEffect(() => {
    if (count === 0) closeMenu();
  }, [count, closeMenu]);

  const summary = `${count} ${noun} сонгогдсон`;

  return (
    <>
      <div
        data-stop-row-click
        // 45px = py-2 (16) + Btn sm (28) + border-b (1) — сонголттой үеийн өндөртэй яг тэнцүү.
        className="min-h-[45px] px-4 py-2 border-b border-[var(--oc-line)] flex flex-wrap items-center gap-3 text-xs text-[var(--oc-muted3)]"
      >
        {count === 0 ? (
          <span className="text-[var(--oc-muted4)]">
            Мөр сонгох: checkbox дарах буюу мөрүүд дээгүүр чирэх · баруун товч → үйлдэл
          </span>
        ) : (
          <>
            <span>{summary}</span>
            {actions.map((a) => (
              <Btn
                key={a.label}
                type="button"
                size="sm"
                variant={a.variant ?? "primary"}
                disabled={a.disabled}
                title={a.title}
                onClick={a.onSelect}
              >
                {a.label}
              </Btn>
            ))}
            <button
              type="button"
              onClick={clear}
              className="text-[var(--oc-muted3)] hover:text-[var(--oc-ink2)] underline underline-offset-2"
            >
              Сонголт цэвэрлэх
            </button>
          </>
        )}
      </div>
      {menu && count > 0 ? (
        <SelectionContextMenu
          position={menu}
          summary={summary}
          actions={actions}
          onClear={clear}
          onClose={closeMenu}
        />
      ) : null}
    </>
  );
}

const MENU_MARGIN = 8;

/**
 * Заагчийн байрлалд гарах цэс (хүснэгт ба хувиарын grid хоёулаа хэрэглэнэ) —
 * `position: fixed`, body-руу portal (хүснэгтийн
 * overflow-д таслагдахгүй; Modal-ын адил `.landing-ops` wrapper-аар `--oc-*`
 * token-уудыг авна). Дэлгэцээс халивал дотогш шилжүүлнэ. Гадна дарах, Escape,
 * scroll, resize → хаагдана.
 */
export function SelectionContextMenu({
  position,
  summary,
  actions,
  onClear,
  onClose,
}: {
  position: MenuPosition;
  summary: string;
  actions: readonly BulkAction[];
  onClear: () => void;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    // Дэлгэцийн ирмэгээс халихгүй байрлуулна.
    const { width, height } = el.getBoundingClientRect();
    el.style.left = `${Math.max(MENU_MARGIN, Math.min(position.x, window.innerWidth - width - MENU_MARGIN))}px`;
    el.style.top = `${Math.max(MENU_MARGIN, Math.min(position.y, window.innerHeight - height - MENU_MARGIN))}px`;
    el.querySelector<HTMLButtonElement>("[role=menuitem]:not(:disabled)")?.focus();

    function onPointerDown(e: Event) {
      if (!el!.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onClose, true);
    window.addEventListener("resize", onClose);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onClose, true);
      window.removeEventListener("resize", onClose);
    };
  }, [position, onClose]);

  const itemClass =
    "w-full text-left text-sm px-3 py-2 rounded-lg transition-colors text-[var(--oc-ink2)] hover:bg-[var(--oc-panel2)] focus-visible:bg-[var(--oc-panel2)] outline-none disabled:opacity-40 disabled:pointer-events-none";

  return createPortal(
    <div className="landing-ops">
      <div
        ref={menuRef}
        role="menu"
        aria-label={summary}
        data-stop-row-click
        style={{ position: "fixed", left: position.x, top: position.y, zIndex: 50 }}
        className="min-w-52 rounded-xl border border-[var(--oc-line)] bg-[var(--oc-panel)] shadow-2xl p-1"
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="px-3 pt-1.5 pb-2 font-plex-mono text-[10.5px] uppercase tracking-[0.08em] text-[var(--oc-muted3)]">
          {summary}
        </div>
        {actions.map((a) => (
          <button
            key={a.label}
            type="button"
            role="menuitem"
            disabled={a.disabled}
            title={a.title}
            className={itemClass}
            onClick={() => {
              onClose();
              a.onSelect();
            }}
          >
            {a.label}
          </button>
        ))}
        <div className="my-1 border-t border-[var(--oc-line)]" />
        <button
          type="button"
          role="menuitem"
          className={`${itemClass} text-[var(--oc-muted3)]`}
          onClick={() => {
            onClose();
            onClear();
          }}
        >
          Сонголт цэвэрлэх
        </button>
      </div>
    </div>,
    document.body,
  );
}

export function SelectAllCell({
  selection,
  className = "w-10 px-3 py-3",
}: {
  selection: RowSelection;
  className?: string;
}) {
  const { allSelected, anySelected, toggleAll } = selection;
  return (
    <th className={className}>
      <input
        type="checkbox"
        checked={allSelected}
        ref={(el) => {
          if (el) el.indeterminate = anySelected && !allSelected;
        }}
        onChange={toggleAll}
        aria-label="Бүгдийг сонгох"
      />
    </th>
  );
}

/**
 * Checkbox нь `pointer-events-none` — хулгана/touch бүх даралт `<td>`-д ирнэ:
 * хулгана бол pointerdown дээр (чирэлт эхлүүлж) будна (дараах click-ийг hook
 * залгина), touch бол `<td>` дээрх click дээр toggle. Гараас (Space) ирэх
 * click нь checkbox-ийг өөрийг нь онилдог тул түүнийг onChange л боловсруулна —
 * `<td>` зөвхөн өөрт нь шууд буусан click-ийг авна (давхар toggle-оос сэргийлнэ).
 */
export function SelectRowCell({
  selection,
  id,
  label,
  className = "w-10 px-3 py-4",
}: {
  selection: RowSelection;
  id: string;
  label: string;
  className?: string;
}) {
  const { selected, toggle, drag } = selection;
  return (
    <td
      {...{ [SELECT_KEY_ATTR]: id }}
      data-stop-row-click
      className={`${className} cursor-pointer select-none`}
      onPointerDown={drag.onPointerDown}
      onClick={(e) => {
        if (e.target === e.currentTarget) toggle(id);
      }}
    >
      <input
        type="checkbox"
        className="pointer-events-none"
        checked={selected.has(id)}
        onChange={() => toggle(id)}
        aria-label={label}
      />
    </td>
  );
}
