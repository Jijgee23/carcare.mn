"use client";

import { useRef, useState } from "react";
import { getBranchDaySlots } from "@/app/_actions/appointments";
import { BookingCalendar } from "@/app/_components/booking-calendar";
import type { DayAvailability } from "@/lib/appointment-slots";
import { todayKey } from "@/lib/appointments-calendar";
import type { Weekday } from "@/lib/branches";

/**
 * Салбар + өдөр + боломжит цагийн сонгогч. Хэрэглэгчийн захиалга болон ажилтны
 * цаг бүртгэх формд адил ашиглагдана. Хоёр grid нүд (календар | цаг) буцаана —
 * эцэг grid-д шууд багана болж байрлана.
 *
 * Салбар солих үед `key={branchId}`-ээр remount хийж дотоод төлвийг тэглэнэ.
 */
export function BranchTimePicker({
  branchId,
  openWeekdays,
  value,
  onChange,
  error,
}: {
  branchId: string;
  openWeekdays?: Weekday[];
  value: string; // сонгосон цагийн ISO
  onChange: (iso: string) => void;
  error?: string;
}) {
  const [date, setDate] = useState("");
  const [availability, setAvailability] = useState<DayAvailability | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const reqIdRef = useRef(0);
  const today = todayKey();

  async function loadSlots(d: string) {
    if (!branchId || !d) {
      setAvailability(null);
      return;
    }
    const id = ++reqIdRef.current;
    setLoadingSlots(true);
    try {
      const res = await getBranchDaySlots(branchId, d);
      if (id === reqIdRef.current) setAvailability(res);
    } catch {
      if (id === reqIdRef.current) setAvailability(null);
    } finally {
      if (id === reqIdRef.current) setLoadingSlots(false);
    }
  }

  function onDateChange(d: string) {
    setDate(d);
    onChange(""); // өдөр солиход сонгосон цагийг цэвэрлэнэ
    void loadSlots(d);
  }

  return (
    <>
      {/* Өдөр (календар) */}
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-white/70">Өдөр</span>
        {branchId ? (
          <BookingCalendar
            value={date}
            today={today}
            onChange={onDateChange}
            openWeekdays={openWeekdays}
          />
        ) : (
          <p className="text-xs text-white/40">Эхлээд салбараа сонгоно уу.</p>
        )}
        {error ? <p className="text-red-400 text-xs">{error}</p> : null}
      </div>

      {/* Боломжит цаг */}
      <div className="flex flex-col gap-2">
        <div className="text-sm font-medium text-white/70">Боломжит цаг</div>
        {!branchId || !date ? (
          <p className="text-xs text-white/40">Салбар, өдрөө сонгоно уу.</p>
        ) : loadingSlots ? (
          <p className="text-xs text-white/40">Ачааллаж байна...</p>
        ) : !availability || !availability.open ? (
          <p className="text-xs text-white/40">
            {availability?.reason ?? "Энэ өдөр цаг авах боломжгүй."}
          </p>
        ) : availability.slots.length === 0 ? (
          <p className="text-xs text-white/40">Цагийн нүх алга.</p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {availability.slots.map((slot) => {
              const selected = slot.iso === value;
              return (
                <button
                  key={slot.iso}
                  type="button"
                  disabled={!slot.available}
                  onClick={() => onChange(slot.iso)}
                  title={!slot.available ? "Захиалгатай" : undefined}
                  className={`px-2 py-2 rounded-lg text-sm tabular-nums border transition-colors ${
                    selected
                      ? "bg-violet-600 border-violet-500 text-white font-semibold"
                      : slot.available
                        ? "border-white/[0.12] bg-white/[0.04] text-white/80 hover:border-violet-500/40 hover:bg-violet-500/10"
                        : "border-white/[0.05] bg-white/[0.02] text-white/25 line-through cursor-not-allowed"
                  }`}
                >
                  {slot.time}
                </button>
              );
            })}
          </div>
        )}
        {availability?.open && availability.slots.length > 0 ? (
          <div className="flex items-center gap-3 text-[11px] text-white/40">
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded border border-white/20 bg-white/[0.04]" />
              Сул
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-white/[0.02] border border-white/[0.05]" />
              Захиалгатай
            </span>
          </div>
        ) : null}
      </div>
    </>
  );
}
