"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { getBranchDaySlots } from "@/app/_actions/appointments";
import { BookingCalendar } from "@/app/_components/booking-calendar";
import type { DayAvailability } from "@/lib/appointment-slots";
import { todayKey } from "@/lib/appointments-calendar";
import type { Weekday } from "@/lib/branches";
import type { ScheduleException, ScheduleSeason, ScheduleRule } from "@/lib/branch-effective-schedule";

/** Гаднаас (categoryIds солигдоход) дуудах имплиэйтив API. */
export type BranchTimePickerHandle = {
  // `nextCategoryIds`-г ЗААВАЛ дамжуулна: parent-ийн setState батчлагдсан тул
  // энэ дуудлагын үед props хараахан шинэчлэгдээгүй байж болзошгүй — closure
  // дэх хуучин `categoryIds` prop-оор биш, шинэ утгаар л дуудна.
  reload: (nextCategoryIds: string[]) => void;
};

/**
 * Салбар + өдөр + боломжит цагийн сонгогч. Хэрэглэгчийн захиалга болон ажилтны
 * цаг бүртгэх формд адил ашиглагдана. Хоёр grid нүд (календар | цаг) буцаана —
 * эцэг grid-д шууд багана болж байрлана.
 *
 * Салбар солих үед `key={branchId}`-ээр remount хийж дотоод төлвийг тэглэнэ.
 * `categoryIds` өөрчлөгдөхөд (ижил салбар дээр) эцэг компонент `ref.reload()`-ийг
 * шууд (event handler-аас) дуудаж, огноог хэвээр үлдээгээд зөвхөн боломжит
 * цагийг дахин татна — booking v2: сонгосон ангиллуудын нийт хугацаа
 * өөрчлөгдөж болно. (Effect дотор шууд setState дуудахаас зайлсхийв.)
 */
export const BranchTimePicker = forwardRef<
  BranchTimePickerHandle,
  {
    branchId: string;
    categoryIds?: string[];
    openWeekdays?: Weekday[];
    schedule?: {
      openTime: string | null;
      closeTime: string | null;
      schedules: ScheduleRule[];
      scheduleExceptions?: ScheduleException[];
      scheduleSeasons?: ScheduleSeason[];
    };
    value: string; // сонгосон цагийн ISO
    onChange: (iso: string) => void;
    error?: string;
    // Хуваарийн хуудаснаас цаг дээр дарж орж ирсэн бол урьдчилан бөглөх
    // огноо ("YYYY-MM-DD") болон яг тэр цагийн ISO. Ачаалагдсан боломжит
    // цагуудын дунд яг таарах слот байвал л автоматаар сонгоно.
    initialDate?: string;
    initialIso?: string;
  }
>(function BranchTimePicker(
  { branchId, categoryIds = [], openWeekdays, schedule, value, onChange, error, initialDate, initialIso },
  ref,
) {
  const [date, setDate] = useState(initialDate ?? "");
  const [availability, setAvailability] = useState<DayAvailability | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const reqIdRef = useRef(0);
  const today = todayKey();

  // Эхний ачаалалт: хуваарийн хуудаснаас урьдчилсан огноотой ирсэн бол
  // тухайн өдрийн боломжит цагийг шууд татаж, яг таарах слот байвал сонгоно.
  useEffect(() => {
    if (!initialDate || !branchId) return;
    const id = ++reqIdRef.current;
    setLoadingSlots(true);
    getBranchDaySlots(branchId, initialDate, categoryIds)
      .then((res) => {
        if (id !== reqIdRef.current) return;
        setAvailability(res);
        if (initialIso) {
          const match = res.slots.find((s) => s.iso === initialIso && s.available);
          if (match) onChange(match.iso);
        }
      })
      .catch(() => {
        if (id === reqIdRef.current) setAvailability(null);
      })
      .finally(() => {
        if (id === reqIdRef.current) setLoadingSlots(false);
      });
    // Зөвхөн mount дээр нэг удаа — цаашид onDateChange/reload-оор л ачаална.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadSlots(d: string) {
    if (!branchId || !d) {
      setAvailability(null);
      return;
    }
    const id = ++reqIdRef.current;
    setLoadingSlots(true);
    try {
      const res = await getBranchDaySlots(branchId, d, categoryIds);
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

  useImperativeHandle(ref, () => ({
    reload: (nextCategoryIds: string[]) => {
      if (!date || !branchId) return;
      onChange(""); // хугацаа өөрчлөгдсөн тул өмнөх сонголт хүчингүй болж болзошгүй
      const id = ++reqIdRef.current;
      setLoadingSlots(true);
      getBranchDaySlots(branchId, date, nextCategoryIds)
        .then((res) => {
          if (id === reqIdRef.current) setAvailability(res);
        })
        .catch(() => {
          if (id === reqIdRef.current) setAvailability(null);
        })
        .finally(() => {
          if (id === reqIdRef.current) setLoadingSlots(false);
        });
    },
  }));

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
            schedule={schedule}
          />
        ) : (
          <p className="text-xs text-white/40">Эхлээд салбараа сонгоно уу.</p>
        )}
        {error ? <p className="text-red-400 light:text-red-600 text-xs">{error}</p> : null}
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
              // Сервер `available`-г "ирээдүйд + сул" гэж тооцдог (харах:
              // lib/appointment-slots.ts) — өнгөрсөн цагийг захиалгатай
              // цагаас ялгаж харуулахын тулд энд тусад нь шалгана.
              const isPast = new Date(slot.iso).getTime() <= Date.now();
              return (
                <button
                  key={slot.iso}
                  type="button"
                  disabled={!slot.available}
                  onClick={() => onChange(slot.iso)}
                  title={!slot.available ? (isPast ? "Өнгөрсөн" : "Захиалгатай") : undefined}
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
        {availability?.scheduleLabel ? (
          <p className="text-xs text-amber-300/80">{availability.scheduleLabel}</p>
        ) : null}
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
});
