"use client";

import { useEffect, useMemo, useRef, type PointerEvent as ReactPointerEvent } from "react";

/**
 * Хулганы зүүн товчийг дараад чирэхэд (mouse-1 hold) олон элемент нэг дор
 * сонгох/сонголтоос хасах ("будах") ерөнхий hook.
 *
 * - Элемент бүр `data-select-key="<key>"` атрибуттай байна. Чирэлт эхлүүлсэн
 *   (anchor) элементийн одоогийн төлөвийн эсрэгээр бүх хамрагдсан элемент
 *   будагдана: сонгогдоогүйгээс эхэлвэл сонгоно, сонгогдсоноос эхэлвэл хасна.
 * - Хоёр эхлэл:
 *   `onPointerDown` — checkbox мэт "бариул" дээр: anchor pointerdown дээр шууд
 *   будагдаж, дараах click залгигдана.
 *   `onPointerDownDeferred` — мөрийн аль ч хэсгээс (`<tbody>` дээр delegate):
 *   заагч ӨӨР элемент дээр очтол юу ч хийхгүй — ердийн товшилт (мөр → дэлгэрэнгүй
 *   navigation) болон текст сонголт хэвээр; өөр мөрөнд орсон мөчид л идэвхжиж
 *   anchor..current будна, текст сонголтыг цэвэрлэж, дараах click-ийг залгина.
 * - Хамрах хүрээг `rangeKeys(anchor, current)` тодорхойлно (хүснэгтэнд мөрийн
 *   интервал, grid-д тэгш өнцөгт). Чирэлтийн үед сонголт = `base ∪/∖ range`,
 *   тиймээс хойшоо буцаж чирвэл өмнө нь будсан нь анхны төлөвтөө орно.
 * - Зөвхөн хулганд (`pointerType === "mouse"`) идэвхжинэ — touch/pen дээр
 *   гүйлгэлттэй зөрчилдөхөөс сэргийлнэ; тэдгээр нь ердийн click-ээр ажиллана.
 * - Session-ы төгсгөлд browser-ын үүсгэх `click`-ийг window capture түвшинд
 *   залгина: anchor давхар toggle болохгүй, мөр дээр буусан click нь
 *   ClickableRow/OrderRow-ийн navigation-ыг ч өдөөхгүй.
 * - Гүйлгэх контейнерийн ирмэгт хүрэхэд өөрөө гүйлгэнэ (auto-scroll).
 *
 * Гүйцэтгэл: pointermove бүрт нэг `elementFromPoint` + `closest`; state зөвхөн
 * заагч ӨӨР элемент дээр очсон үед л шинэчлэгдэнэ.
 */

export const SELECT_KEY_ATTR = "data-select-key";
const SELECT_KEY_SELECTOR = `[${SELECT_KEY_ATTR}]`;

/** Ирмэгээс энэ зайд (px) заагч орвол auto-scroll эхэлнэ. */
const EDGE_PX = 32;
/** Нэг frame-д хамгийн ихдээ гүйлгэх зай (px). */
const MAX_SCROLL_STEP = 24;

export type DragSelectOptions = {
  selected: ReadonlySet<string>;
  setSelected: (next: Set<string>) => void;
  /**
   * anchor-оос current хүртэлх бүх key. Аль нэг нь энэ жагсаалтад хамаарахгүй
   * бол `null` буцаана — тэр үед хөдөлгөөнийг үл тоомсорлоно.
   */
  rangeKeys: (anchor: string, current: string) => readonly string[] | null;
  /** Заагчийн доорх DOM элементээс key-г тодорхойлно. Default: `closest([data-select-key])`. */
  keyAt?: (el: Element) => string | null;
  enabled?: boolean;
};

export type DragSelectHandle = {
  onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerDownDeferred: (e: ReactPointerEvent<HTMLElement>) => void;
};

type Session = {
  anchor: string;
  current: string;
  /** Будаж эхэлсэн эсэх (deferred session заагч anchor-оос гартал `false`). */
  active: boolean;
  paint: boolean;
  base: ReadonlySet<string>;
  /** `null` бол window гүйлгэнэ. */
  scroller: HTMLElement | null;
  x: number;
  y: number;
  raf: number;
  swallowClick: (e: MouseEvent) => void;
};

export function defaultKeyAt(el: Element): string | null {
  return el.closest(SELECT_KEY_SELECTOR)?.getAttribute(SELECT_KEY_ATTR) ?? null;
}

/** Хүснэгтэнд: заагч мөрийн аль ч нүдэн дээр байсан тэр мөрийн key-г авна. */
export function tableRowKeyAt(el: Element): string | null {
  return (
    el.closest("tr")?.querySelector(SELECT_KEY_SELECTOR)?.getAttribute(SELECT_KEY_ATTR) ?? null
  );
}

function findScroller(from: HTMLElement): HTMLElement | null {
  for (let el = from.parentElement; el; el = el.parentElement) {
    const { overflowY } = getComputedStyle(el);
    if ((overflowY === "auto" || overflowY === "scroll") && el.scrollHeight > el.clientHeight) {
      return el;
    }
  }
  return null;
}

/** Ирмэгийн бүсэд орсон бол гүйлгэх хурд (px/frame, тэмдэгтэй), үгүй бол 0. */
function edgeScrollStep(top: number, bottom: number, y: number): number {
  if (y < top + EDGE_PX) return -Math.min(MAX_SCROLL_STEP, Math.ceil((top + EDGE_PX - y) / 2));
  if (y > bottom - EDGE_PX) return Math.min(MAX_SCROLL_STEP, Math.ceil((y - (bottom - EDGE_PX)) / 2));
  return 0;
}

function swallowClick(e: MouseEvent) {
  e.stopPropagation();
  e.preventDefault();
}

export function useDragSelect(options: DragSelectOptions): DragSelectHandle {
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  const sessionRef = useRef<Session | null>(null);

  const handle = useMemo(() => {
    function applyRange(session: Session, current: string) {
      const { rangeKeys, setSelected } = optionsRef.current;
      const keys = rangeKeys(session.anchor, current);
      if (!keys) return;
      session.current = current;
      const next = new Set(session.base);
      if (session.paint) for (const k of keys) next.add(k);
      else for (const k of keys) next.delete(k);
      setSelected(next);
    }

    function activate(session: Session) {
      session.active = true;
      document.body.style.userSelect = "none";
      window.getSelection()?.removeAllRanges();
      window.addEventListener("click", session.swallowClick, { capture: true, once: true });
    }

    function hitTest(session: Session) {
      const el = document.elementFromPoint(session.x, session.y);
      if (!el) return;
      const key = (optionsRef.current.keyAt ?? defaultKeyAt)(el);
      if (!key || key === session.current) return;
      if (!session.active) {
        if (key === session.anchor) return;
        activate(session);
      }
      applyRange(session, key);
    }

    function autoScrollTick() {
      const session = sessionRef.current;
      if (!session) return;
      session.raf = 0;
      const rect = session.scroller?.getBoundingClientRect();
      const step = edgeScrollStep(rect?.top ?? 0, rect?.bottom ?? window.innerHeight, session.y);
      if (step === 0) return;
      if (session.scroller) session.scroller.scrollTop += step;
      else window.scrollBy(0, step);
      hitTest(session);
      session.raf = requestAnimationFrame(autoScrollTick);
    }

    function onMove(e: PointerEvent) {
      const session = sessionRef.current;
      if (!session) return;
      session.x = e.clientX;
      session.y = e.clientY;
      hitTest(session);
      if (!session.raf) session.raf = requestAnimationFrame(autoScrollTick);
    }

    function end() {
      const session = sessionRef.current;
      if (!session) return;
      sessionRef.current = null;
      if (session.raf) cancelAnimationFrame(session.raf);
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      window.removeEventListener("blur", end);
      // pointerup-ын дараах click мөн энэ task дотор ирнэ (эсвэл цонхны гадна
      // тавьсан бол огт ирэхгүй) — хоёр тохиолдолд ч listener-ийг цэвэрлэнэ.
      setTimeout(() => {
        window.removeEventListener("click", session.swallowClick, true);
      }, 0);
    }

    function begin(e: ReactPointerEvent<HTMLElement>, immediate: boolean) {
      const { enabled = true, selected, keyAt = defaultKeyAt } = optionsRef.current;
      if (!enabled || e.pointerType !== "mouse" || e.button !== 0) return;
      const anchor =
        e.currentTarget.getAttribute(SELECT_KEY_ATTR) ?? keyAt(e.target as Element);
      if (!anchor) return;

      end();
      const session: Session = {
        anchor,
        current: "",
        active: false,
        paint: !selected.has(anchor),
        base: selected,
        scroller: findScroller(e.currentTarget),
        x: e.clientX,
        y: e.clientY,
        raf: 0,
        // Session бүр өөрийн listener — `end()`-ийн хоцорсон цэвэрлэгээ дараагийн
        // session-ы listener-ийг санамсаргүй авч хаяхгүй.
        swallowClick: (ev) => swallowClick(ev),
      };
      sessionRef.current = session;

      if (immediate) {
        // mousedown-ы default үйлдэл (текст сонголт, focus) болиулна.
        e.preventDefault();
        activate(session);
        applyRange(session, anchor);
      }

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", end);
      window.addEventListener("pointercancel", end);
      window.addEventListener("blur", end);
    }

    return {
      onPointerDown: (e: ReactPointerEvent<HTMLElement>) => begin(e, true),
      onPointerDownDeferred: (e: ReactPointerEvent<HTMLElement>) => begin(e, false),
      end,
    };
  }, []);

  useEffect(() => handle.end, [handle]);

  return handle;
}
