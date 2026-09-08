"use client";

import { useRouter } from "next/navigation";
import { DatePicker } from "@/app/_components/date-picker";
import { Select } from "@/app/_components/select";

// Prev/Өнөөдөр/Next-ээр зэрэгцээд дурын огноо руу шууд үсрэх боломж — одоогийн
// interval (Өдөр/7 хоног/Сар) болон layout-аа хадгалж, зөвхөн anchor солино.
// Сар харагдацад өдөр хамаагүй (тухайн сарыг бүхэлд нь харуулдаг) тул өдрийн
// торгүй, зөвхөн сар+жилийн сонголт өгнө — Өдөр/7 хоногт бол бүтэн
// огнооны сонгогч (сонгосон өдрийг агуулсан 7 хоног/тухайн өдөр рүү шилжинэ).
export function CalendarDateJump({
  anchorKey,
  interval,
  branchId,
  layout,
}: {
  anchorKey: string;
  interval: string;
  branchId?: string;
  layout?: string;
}) {
  const router = useRouter();

  function goToAnchor(next: string) {
    if (!next) return;
    const p = new URLSearchParams();
    if (branchId) p.set("branchId", branchId);
    p.set("interval", interval);
    if (layout) p.set("layout", layout);
    p.set("anchor", next);
    router.push(`/dashboard/appointments/calendar?${p.toString()}`);
  }

  if (interval === "month") {
    const d = new Date(`${anchorKey}T00:00:00`);
    const year = d.getFullYear();
    const month = d.getMonth(); // 0-based

    function goToMonth(y: number, m: number) {
      const mm = String(m + 1).padStart(2, "0");
      goToAnchor(`${y}-${mm}-01`);
    }

    const monthOptions = Array.from({ length: 12 }, (_, i) => ({
      value: String(i),
      label: `${i + 1}-р сар`,
    }));
    const currentYear = new Date().getFullYear();
    const yearOptions = Array.from({ length: 11 }, (_, i) => {
      const y = currentYear - 5 + i;
      return { value: String(y), label: String(y) };
    });

    return (
      <div className="flex gap-1.5">
        <Select
          name="month"
          value={String(month)}
          onChange={(v) => goToMonth(year, Number(v))}
          options={monthOptions}
        />
        <Select
          name="year"
          value={String(year)}
          onChange={(v) => goToMonth(Number(v), month)}
          options={yearOptions}
        />
      </div>
    );
  }

  return (
    <DatePicker
      value={anchorKey}
      onChange={goToAnchor}
      className="w-36"
      placeholder="Огноо сонгох"
    />
  );
}
