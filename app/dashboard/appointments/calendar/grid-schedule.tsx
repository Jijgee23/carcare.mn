"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { DayRow } from "./day-rows";
import { assignLanes, pctOf, hourMarksBetween } from "@/lib/schedule-grid-layout";

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

export function GridSchedule({
  rows,
  axisStartMs,
  axisEndMs,
  closingAtMs,
  branchId,
  returnTo,
  slotCapacity,
}: {
  rows: DayRow[];
  axisStartMs: number;
  axisEndMs: number;
  closingAtMs?: number | null;
  branchId: string;
  returnTo: string;
  // Branch's configured concurrent-slot count — the grid always reserves
  // this many rows, even empty, so staff see the branch's real capacity
  // rather than only as many rows as happen to be booked right now.
  slotCapacity: number;
}) {
  const router = useRouter();
  const bodyRef = useRef<HTMLDivElement>(null);
  const [hoverMs, setHoverMs] = useState<number | null>(null);

  const positioned = useMemo(() => assignLanes(rows), [rows]);
  const laneCount = Math.max(slotCapacity, 1, ...positioned.map((r) => r.lane + 1));
  const axisSpan = Math.max(1, axisEndMs - axisStartMs);

  // Өнгөрсөн цагийг (өнөөдрийн харагдац дээр) саарлаар "дүүргэж" тэмдэглэнэ —
  // тухайн хэсэгт дарж шинэ захиалга/цаг захиалга үүсгэх боломжгүй (доорх
  // handleBodyClick-д `ms < now` бол алгасна). Ирээдүйн өдөр бол now нь
  // axisStartMs-ээс өмнө тул дүүргэлт харагдахгүй; бүтэн өнгөрсөн өдөр бол
  // (жишээ нь өчигдрийг харж байгаа) бүхэлдээ дүүрнэ.
  //
  // `now`-ыг render биед шууд `Date.now()`-оор биш, mount-ийн дараах effect-ээр
  // тохируулна: SSR ба client-ийн эхний render хоёр өөр агшинд явагдах тул
  // (`nowMs()`-г шууд дуудвал) hydration mismatch өгдөг байсан (server-ийн
  // HTML дэх "Одоо" тэмдэглэгээний байрлал/цаг client дээр өөр гарна). Эхний
  // render (server ба client аль алинд) `null` — тэмдэглэгээ mount хүртэл
  // харагдахгүй, дараа нь бодит утгаараа шинэчлэгдэнэ.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);
  const pastFillEndMs = now != null ? Math.min(now, axisEndMs) : axisStartMs;
  const showPastFill = now != null && pastFillEndMs > axisStartMs;
  const showNowMarker = now != null && now > axisStartMs && now < axisEndMs;

  // Хаалтын цагийн шугам — ажил хаалтаас цааш үргэлжилж болно (staff-side
  // confirm-able warning, D-087 superseded), тул хаалтын цагийг тэнхлэг дээр
  // тодруулж, хаалтаас хойших хэсэгт хөнгөн өнгө өгнө (past-fill-тэй адил
  // хэв маягаар, гэхдээ "past/unavailable" гэсэн санааг өгөхгүйн тулд бүдэг).
  const showClosingMarker =
    closingAtMs != null && closingAtMs > axisStartMs && closingAtMs < axisEndMs;
  const showClosingTint = closingAtMs != null && closingAtMs < axisEndMs;
  const closingTintStartMs = closingAtMs != null ? Math.max(closingAtMs, axisStartMs) : axisStartMs;

  // Босоо саарал шугам харуулах цагийн тэмдэглэгээ — цаг тутам.
  const hourMarks = useMemo(
    () => hourMarksBetween(axisStartMs, axisEndMs),
    [axisStartMs, axisEndMs],
  );

  const pct = (ms: number) => pctOf(ms, axisStartMs, axisSpan);

  // Хулганы x-координатыг тэнхлэг дээрх цаг (ms) руу хөрвүүлнэ, 15 минутад
  // бүхэлдэнэ — хоосон зай дээр дарахад шинэ цаг захиалга нээхэд ашиглана.
  function msFromClientX(clientX: number): number | null {
    const el = bodyRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return null;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return roundToSlot(axisStartMs + ratio * axisSpan);
  }

  function goCreateAppointment(ms: number) {
    const params = new URLSearchParams({
      branchId,
      scheduledAt: new Date(ms).toISOString(),
      next: returnTo,
    });
    router.push(`/dashboard/appointments/new?${params.toString()}`);
  }

  // Захиалгын жагсаалт хуудсанд ганцхан тухайн мөрийг шүүж харуулна — тусдаа
  // дэлгэрэнгүй хуудас байхгүй тул одоо байгаа "highlight" загварыг ашиглана
  // (харах: app/dashboard/appointments/page.tsx-ийн highlightId).
  function goToBookingDetail(appointmentId: string) {
    router.push(`/dashboard/appointments?highlight=${encodeURIComponent(appointmentId)}`);
  }

  function handleBodyClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return; // блок дээр дарсан бол үл хайхрана
    const ms = msFromClientX(e.clientX);
    if (ms == null) return;
    if (ms < nowMs()) return; // өнгөрсөн цаг дээр шинэ зүйл үүсгэхгүй
    goCreateAppointment(ms);
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

          {/* Грид бие — салбарын багтаамжийн мөр тус бүрийг тусдаа, зааглагдсан
              жижиг грид болгож харуулна (нэг цул талбар дундуур зураас татаад
              харуулахын оронд). Хоосон зай дээр дарахад тухайн цагаар шинэ
              (walk-in) захиалга нээнэ — блок дээр дарсныг
              e.target !== e.currentTarget-ээр ялгана. */}
          <div ref={bodyRef} className="relative flex flex-col gap-2 pt-3">
            {rows.length === 0 ? (
              <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none text-sm text-[var(--oc-muted4)]">
                Энэ өдөр хуваарь хоосон байна.
              </div>
            ) : null}

            {Array.from({ length: laneCount }).map((_, lane) => (
              <div
                key={`lane-${lane}`}
                className="relative rounded-lg border border-[var(--oc-line)] bg-[var(--oc-panel)] overflow-hidden"
                style={{
                  height: `${ROW_HEIGHT}px`,
                  cursor: now != null && hoverMs != null && hoverMs < now ? "not-allowed" : "pointer",
                }}
                onClick={handleBodyClick}
                onMouseMove={(e) => setHoverMs(msFromClientX(e.clientX))}
                onMouseLeave={() => setHoverMs(null)}
              >
                {positioned
                  .filter((row) => row.lane === lane)
                  .map((row) => {
                    const left = pct(row.startMs);
                    const right = pct(row.endMs);
                    const width = Math.max(MIN_BLOCK_WIDTH_PCT, right - left);
                    return (
                      <button
                        key={row.key}
                        type="button"
                        title={row.name}
                        onClick={() => goToBookingDetail(row.id)}
                        className="absolute top-0.5 bottom-0.5 flex items-center gap-1.5 overflow-hidden rounded-lg border px-2 text-left text-xs border-[var(--oc-line2)] bg-[var(--oc-panel2)] hover:bg-white/[0.06] transition-colors"
                        style={{ left: `${left}%`, width: `${width}%` }}
                      >
                        <span className="font-plex-mono text-[10px] text-[var(--oc-muted3)] shrink-0">
                          {fmtUbTime(row.startMs)}
                        </span>
                        <span className="truncate text-[var(--oc-ink2)]">{row.name}</span>
                        {row.paymentStatusLabel ? (
                          <span
                            className={`shrink-0 rounded-full border px-1.5 py-0.5 font-plex-mono text-[9px] ${row.paymentStatusClass}`}
                          >
                            {row.paymentStatusLabel}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
              </div>
            ))}

            {/* Одоо/өнгөрсөн цаг, хаалт зэрэг цагийн шугамууд — мөр бүрт
                тусад нь давтахын оронд бүх мөрийг дамнасан НЭГ тасралтгүй
                давхарга болгож зурна (хоосон зайнуудыг ч дамжуулан), эс
                бөгөөс мөр хооронд тасарч харагдана. */}
            <div className="absolute inset-0 pointer-events-none">
              {showPastFill ? (
                <div
                  className="absolute top-0 bottom-0 left-0 bg-[var(--oc-muted2)]/[0.16]"
                  style={{ width: `${pct(pastFillEndMs)}%` }}
                  title="Өнгөрсөн цаг"
                />
              ) : null}

              {showNowMarker ? (
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-[var(--oc-muted)]/80"
                  style={{ left: `${pct(now!)}%` }}
                />
              ) : null}

              {showClosingTint ? (
                <div
                  className="absolute top-0 bottom-0 right-0 bg-[var(--oc-warn)]/[0.06]"
                  style={{ width: `${100 - pct(closingTintStartMs)}%` }}
                  title="Хаалтын цагаас хойш"
                />
              ) : null}

              {showClosingMarker ? (
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-[var(--oc-warn)]/70"
                  style={{ left: `${pct(closingAtMs!)}%` }}
                />
              ) : null}

              {hourMarks.map((t) => (
                <div
                  key={t}
                  className="absolute top-0 bottom-0 w-px bg-[var(--oc-line)]/60"
                  style={{ left: `${pct(t)}%` }}
                />
              ))}

              {now != null && hoverMs != null && hoverMs >= now ? (
                <div
                  className="absolute top-0 bottom-0 w-px bg-[var(--oc-accent)]/70"
                  style={{ left: `${pct(hoverMs)}%` }}
                />
              ) : null}
            </div>

            {showNowMarker ? (
              <span
                className="absolute -top-1 -translate-x-1/2 whitespace-nowrap rounded-full bg-[var(--oc-muted2)] px-1.5 py-0.5 font-plex-mono text-[9px] text-[var(--oc-carbon)] pointer-events-none"
                style={{ left: `${pct(now!)}%` }}
              >
                Одоо · {fmtUbTime(now!)}
              </span>
            ) : null}

            {showClosingMarker ? (
              <span
                className="absolute -top-1 -translate-x-1/2 whitespace-nowrap rounded-full bg-[var(--oc-warn)]/80 px-1.5 py-0.5 font-plex-mono text-[9px] text-[var(--oc-carbon)] pointer-events-none"
                style={{ left: `${pct(closingAtMs!)}%` }}
              >
                Хаалт · {fmtUbTime(closingAtMs!)}
              </span>
            ) : null}

            {now != null && hoverMs != null && hoverMs >= now ? (
              <span
                className="absolute -top-1 -translate-x-1/2 whitespace-nowrap rounded-full bg-[var(--oc-accent)] px-1.5 py-0.5 font-plex-mono text-[9px] text-[var(--oc-on-accent)] pointer-events-none"
                style={{ left: `${pct(hoverMs)}%` }}
              >
                + {fmtUbTime(hoverMs)}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
