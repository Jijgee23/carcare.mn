"use client";

import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import type { DayRow } from "./day-rows";
import { OrderDetailPanel } from "./order-detail-panel";

const SLOT_MINUTES = 15; // хоосон зайг дарахад цаг энэ нарийвчлалаар бүхэлдэнэ

function roundToSlot(ms: number): number {
  const slotMs = SLOT_MINUTES * 60 * 1000;
  return Math.round(ms / slotMs) * slotMs;
}

// react-hooks/purity: `Date.now()`-г component-ийн render биед шууд бичихгүй
// (app/(app)/account/appointments/[id]/page.tsx-ийн computeIsDelayed-ийн ижил
// тайлбарыг үз) — тусдаа module-level helper-т шилжүүлнэ.
function nowMs(): number {
  return Date.now();
}

// Асиа/Улаанбаатар цагийн бүсээр цаг форматлана — сервер өөр бүсэд байршиж болзошгүй.
function fmtUbTime(ms: number): string {
  return new Intl.DateTimeFormat("mn-MN", {
    timeZone: "Asia/Ulaanbaatar",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(ms));
}

const ROW_HEIGHT = 46; // нэг давхаргын (sub-lane) өндөр, px
const MIN_BLOCK_WIDTH_PCT = 2.5; // маш богино ажлыг ч дор хаяж хараагдахуйц өргөнтэй байлгана

type PositionedRow = DayRow & { lane: number };

// Давхцаж буй мөрүүдийг дэд-эгнээнд (sub-lane) хуваарилна — нэг байрлалд
// (branch-д тусдаа бокс/лифт байхгүй тул) хэд хэдэн ажил зэрэг өрнөж болно,
// тэдгээрийг нуухгүй, зэрэгцүүлж харуулахын тулд greedy interval-scheduling.
function assignLanes(rows: DayRow[]): PositionedRow[] {
  const sorted = [...rows].sort((a, b) => a.startMs - b.startMs);
  const laneEndMs: number[] = [];
  const positioned: PositionedRow[] = [];
  for (const row of sorted) {
    let lane = laneEndMs.findIndex((end) => end <= row.startMs);
    if (lane === -1) {
      lane = laneEndMs.length;
      laneEndMs.push(row.endMs);
    } else {
      laneEndMs[lane] = row.endMs;
    }
    positioned.push({ ...row, lane });
  }
  return positioned;
}

export function GridSchedule({
  rows,
  axisStartMs,
  axisEndMs,
  canChangeItemStatus,
  branchId,
  returnTo,
}: {
  rows: DayRow[];
  axisStartMs: number;
  axisEndMs: number;
  canChangeItemStatus: boolean;
  branchId: string;
  returnTo: string;
}) {
  const router = useRouter();
  const bodyRef = useRef<HTMLDivElement>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [hoverMs, setHoverMs] = useState<number | null>(null);
  // Хоосон зай дээр дарахад шууд нэг рүү явахын оронд аль хэлбэрээр
  // (цаг захиалга уу, эсвэл walk-in захиалга уу) үүсгэхийг эхлээд асууна.
  const [createAtMs, setCreateAtMs] = useState<number | null>(null);

  const positioned = useMemo(() => assignLanes(rows), [rows]);
  const laneCount = Math.max(1, ...positioned.map((r) => r.lane + 1));
  const axisSpan = Math.max(1, axisEndMs - axisStartMs);

  // Өнгөрсөн цагийг (өнөөдрийн харагдац дээр) саарлаар "дүүргэж" тэмдэглэнэ —
  // тухайн хэсэгт дарж шинэ захиалга/цаг захиалга үүсгэх боломжгүй (доорх
  // handleBodyClick-д `ms < now` бол алгасна). Ирээдүйн өдөр бол now нь
  // axisStartMs-ээс өмнө тул дүүргэлт харагдахгүй; бүтэн өнгөрсөн өдөр бол
  // (жишээ нь өчигдрийг харж байгаа) бүхэлдээ дүүрнэ.
  const now = nowMs();
  const pastFillEndMs = Math.min(now, axisEndMs);
  const showPastFill = pastFillEndMs > axisStartMs;

  // Босоо саарал шугам харуулах цагийн тэмдэглэгээ — цаг тутам.
  const hourMarks = useMemo(() => {
    const marks: number[] = [];
    const start = new Date(axisStartMs);
    start.setMinutes(0, 0, 0);
    for (let t = start.getTime(); t <= axisEndMs; t += 60 * 60 * 1000) {
      if (t >= axisStartMs) marks.push(t);
    }
    return marks;
  }, [axisStartMs, axisEndMs]);

  const pct = (ms: number) =>
    Math.min(100, Math.max(0, ((ms - axisStartMs) / axisSpan) * 100));

  const selected = rows.find((r) => r.key === selectedKey) ?? null;

  // Хулганы x-координатыг тэнхлэг дээрх цаг (ms) руу хөрвүүлнэ, 15 минутад
  // бүхэлдэнэ — хоосон зай дээр дарахад шинэ (walk-in) захиалга нээхэд ашиглана.
  function msFromClientX(clientX: number): number | null {
    const el = bodyRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return null;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return roundToSlot(axisStartMs + ratio * axisSpan);
  }

  function handleBodyClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return; // блок дээр дарсан бол үл хайхрана
    const ms = msFromClientX(e.clientX);
    if (ms == null) return;
    if (ms < nowMs()) return; // өнгөрсөн цаг дээр шинэ зүйл үүсгэхгүй
    setCreateAtMs(ms);
  }

  function goCreateOrder(ms: number) {
    const params = new URLSearchParams({
      branchId,
      scheduledAt: new Date(ms).toISOString(),
      next: returnTo,
    });
    router.push(`/dashboard/orders/new?${params.toString()}`);
  }

  function goCreateAppointment(ms: number) {
    const params = new URLSearchParams({
      branchId,
      scheduledAt: new Date(ms).toISOString(),
      next: returnTo,
    });
    router.push(`/dashboard/appointments/new?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] overflow-hidden">
        <div>
          {/* Цагийн тэнхлэг — эхний/сүүлийн тэмдэглэгээг зах руу тулгаж, дундуур
              зогсохгүй тул харагдах хэсгээс гарч таслагдахгүй. */}
          <div className="relative h-7 border-b border-[var(--oc-line)]">
            {hourMarks.map((t, i) => (
              <span
                key={t}
                className={`absolute top-1 font-plex-mono text-[10px] text-[var(--oc-muted3)] ${
                  i === 0
                    ? ""
                    : i === hourMarks.length - 1
                      ? "-translate-x-full"
                      : "-translate-x-1/2"
                }`}
                style={{ left: `${pct(t)}%` }}
              >
                {fmtUbTime(t)}
              </span>
            ))}
          </div>

          {/* Grid бие — саарал босоо шугамууд + байршуулсан блокууд. Хоосон
              зай дээр дарахад тухайн цагаар шинэ (walk-in) захиалга нээнэ —
              блок дээр дарсныг e.target !== e.currentTarget-ээр ялгана. */}
          <div
            ref={bodyRef}
            className="relative"
            style={{
              height: `${Math.max(1, laneCount) * ROW_HEIGHT + 8}px`,
              cursor: hoverMs != null && hoverMs < now ? "not-allowed" : "pointer",
            }}
            onClick={handleBodyClick}
            onMouseMove={(e) => setHoverMs(msFromClientX(e.clientX))}
            onMouseLeave={() => setHoverMs(null)}
          >
            {showPastFill ? (
              <div
                className="absolute top-0 bottom-0 left-0 bg-[var(--oc-muted4)]/10 pointer-events-none"
                style={{ width: `${pct(pastFillEndMs)}%` }}
                title="Өнгөрсөн цаг"
              />
            ) : null}

            {hourMarks.map((t) => (
              <div
                key={t}
                className="absolute top-0 bottom-0 w-px bg-[var(--oc-line)]/60 pointer-events-none"
                style={{ left: `${pct(t)}%` }}
              />
            ))}

            {hoverMs != null && hoverMs >= now ? (
              <div
                className="absolute top-0 bottom-0 w-px bg-[var(--oc-accent)]/70 pointer-events-none"
                style={{ left: `${pct(hoverMs)}%` }}
              >
                <span className="absolute -top-0.5 left-1.5 whitespace-nowrap rounded-full bg-[var(--oc-accent)] px-1.5 py-0.5 font-plex-mono text-[9px] text-[var(--oc-on-accent)]">
                  + {fmtUbTime(hoverMs)}
                </span>
              </div>
            ) : null}

            {rows.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-sm text-[var(--oc-muted4)]">
                Энэ өдөр хуваарь хоосон байна.
              </div>
            ) : null}

            {positioned.map((row) => {
              const left = pct(row.startMs);
              const right = row.uncertain ? 100 : pct(row.endMs);
              const width = Math.max(MIN_BLOCK_WIDTH_PCT, right - left);
              const isSelected = row.key === selectedKey;
              return (
                <button
                  key={row.key}
                  type="button"
                  onClick={() => setSelectedKey(isSelected ? null : row.key)}
                  title={row.name}
                  className={`absolute flex items-center gap-1.5 overflow-hidden rounded-lg border px-2 text-left text-xs transition-colors ${
                    isSelected
                      ? "border-[var(--oc-accent)] bg-[var(--oc-accent)]/20 z-10"
                      : "border-[var(--oc-line2)] bg-[var(--oc-panel2)] hover:bg-white/[0.06]"
                  } ${row.issueLabel ? "outline outline-1 outline-red-500/40" : ""}`}
                  style={{
                    left: `${left}%`,
                    width: `${width}%`,
                    top: `${row.lane * ROW_HEIGHT + 4}px`,
                    height: `${ROW_HEIGHT - 6}px`,
                    backgroundImage: row.uncertain
                      ? "repeating-linear-gradient(135deg, transparent, transparent 6px, rgba(245,158,11,0.15) 6px, rgba(245,158,11,0.15) 12px)"
                      : undefined,
                  }}
                >
                  <span className="font-plex-mono text-[10px] text-[var(--oc-muted3)] shrink-0">
                    {fmtUbTime(row.startMs)}
                  </span>
                  <span className="truncate text-[var(--oc-ink2)]">{row.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Сонгосон блокийн дэлгэрэнгүй/үйлдэл — grid дотор шууд дэлгэвэл
          байршуулалт эвдэрдэг тул доор тусад нь харуулна. */}
      {selected ? (
        <div className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] p-4">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="font-plex-mono text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--oc-panel2)] border border-[var(--oc-line)] text-[var(--oc-muted3)]">
              {selected.source === "appointment" ? "Цаг захиалга" : "Захиалга"}
            </span>
            {selected.statusLabel ? (
              <span
                className={`font-plex-mono text-[10px] px-1.5 py-0.5 rounded-full ${selected.statusClass}`}
              >
                {selected.statusLabel}
              </span>
            ) : null}
            <span className="font-plex-mono text-xs text-[var(--oc-muted3)]">
              {selected.uncertain
                ? `${fmtUbTime(selected.startMs)} → тодорхойгүй`
                : `${fmtUbTime(selected.startMs)}–${fmtUbTime(selected.endMs)}`}
            </span>
            {selected.issueLabel ? (
              <span className="font-plex-mono text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                {selected.issueLabel}
              </span>
            ) : null}
          </div>
          <div className="text-sm text-[var(--oc-ink)] font-medium mb-3">{selected.name}</div>
          <div className="flex flex-col sm:flex-row gap-3 items-start">
            {selected.actions ? (
              <div className="w-full sm:w-64 shrink-0">{selected.actions}</div>
            ) : selected.source !== "order" ? (
              <p className="text-xs text-[var(--oc-muted4)]">
                Одоогоор хийх боломжтой үйлдэл алга.
              </p>
            ) : null}
            {selected.source === "order" ? (
              <OrderDetailPanel
                key={selected.id}
                orderId={selected.id}
                canChangeItemStatus={canChangeItemStatus}
              />
            ) : null}
          </div>
        </div>
      ) : null}

      {createAtMs != null && typeof document !== "undefined"
        ? createPortal(
            <>
              <button
                type="button"
                tabIndex={-1}
                aria-label="Хаах"
                onClick={() => setCreateAtMs(null)}
                className="fixed inset-0 z-[100] cursor-default bg-black/60"
              />
              <div
                role="dialog"
                aria-modal="true"
                className="fixed left-1/2 top-1/2 z-[110] w-[min(92vw,22rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-[var(--surface)] p-5 shadow-2xl backdrop-blur-xl"
              >
                <h3 className="font-semibold text-white mb-1">
                  {fmtUbTime(createAtMs)} цагт юу үүсгэх вэ?
                </h3>
                <p className="text-sm text-white/50 mb-4">
                  Машин яг одоо ирсэн бол захиалга, ирээдүйн цаг захиалах бол
                  цаг захиалгыг сонго.
                </p>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => goCreateOrder(createAtMs)}
                    className="w-full rounded-lg bg-violet-600 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500"
                  >
                    Засварын хуудас үүсгэх
                  </button>
                  <button
                    type="button"
                    onClick={() => goCreateAppointment(createAtMs)}
                    className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-white/[0.08]"
                  >
                    Цаг захиалга үүсгэх
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreateAtMs(null)}
                    className="w-full rounded-lg px-3.5 py-2 text-sm text-white/50 transition-colors hover:text-white/80"
                  >
                    Болих
                  </button>
                </div>
              </div>
            </>,
            document.body,
          )
        : null}
    </div>
  );
}
