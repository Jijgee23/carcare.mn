"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { getBookingBranchResults, type BookingBranchResult } from "@/app/_actions/book";
import { CategoryPickerModal } from "./category-picker-modal";
import { CategoryTagsBar } from "./category-tags-bar";
import type { ServiceKey } from "./category-picker-grid";

/**
 * Booking v2 нэгтгэсэн хуудас: ажлын төрөл сонгох (tag bar + modal) болон
 * тэдгээрийг гүйцэтгэдэг салбаруудын жагсаалт НЭГ хуудсан дээр, хуудас
 * шилжилтгүйгээр. Сонголт өөрчлөгдөх бүрд `getBookingBranchResults`
 * server action-ыг дуудаж жагсаалтыг дахин татна; URL-ийг (`?keys=`) shallow
 * `router.replace`-ээр хадгалж, шууд линк/refresh хэвээр ажиллана.
 */
export function BookingFlow({
  serviceKeys,
  initialSelectedIds,
  initialResults,
}: {
  serviceKeys: ServiceKey[];
  initialSelectedIds: string[];
  initialResults: BookingBranchResult[];
}) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds);
  const [results, setResults] = useState<BookingBranchResult[]>(initialResults);
  const [modalOpen, setModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Эхний render-ийн `initialResults`-ыг дахин татахгүй байхын тулд (props-оор
  // ирсэн эхний утга аль хэдийн зөв) — зөвхөн ХОЖИМ сонголт өөрчлөгдөхөд л
  // fetch хийнэ.
  const isFirstRender = useRef(true);

  const applySelection = useCallback(
    (ids: string[]) => {
      setSelectedIds(ids);
      const qs = ids.length > 0 ? `?keys=${ids.map(encodeURIComponent).join(",")}` : "";
      router.replace(`/book${qs}`, { scroll: false });
    },
    [router],
  );

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    startTransition(async () => {
      const next = await getBookingBranchResults(selectedIds);
      setResults(next);
    });
  }, [selectedIds]);

  function removeCategory(id: string) {
    applySelection(selectedIds.filter((x) => x !== id));
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold">Цаг захиалах</h1>
        <p className="text-[var(--oc-muted3)] text-sm mt-1">
          Ямар ажил хийлгэхээ сонгоход тэдгээрийг БҮГДийг нь гүйцэтгэдэг
          салбарууд доор харагдана.
        </p>
      </div>

      <CategoryTagsBar
        serviceKeys={serviceKeys}
        selectedIds={selectedIds}
        onRemove={removeCategory}
        onOpenPicker={() => setModalOpen(true)}
      />

      <CategoryPickerModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onApply={applySelection}
        serviceKeys={serviceKeys}
        currentSelected={selectedIds}
      />

      <div className={`transition-opacity ${isPending ? "opacity-50" : ""}`}>
        {selectedIds.length === 0 ? (
          <div className="rounded-[10px] border border-dashed border-[var(--oc-line)] p-10 text-center text-sm text-[var(--oc-muted3)]">
            Ажлын төрлөө сонгоход тохирох салбарууд эндээс харагдана.
          </div>
        ) : results.length === 0 ? (
          <div className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] p-10 text-center text-sm text-[var(--oc-muted3)]">
            Сонгосон ажлуудыг зэрэг гүйцэтгэдэг салбар олдсонгүй. Ажлын
            төрлөөсөө хасаад дахин үзнэ үү.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((r) => (
              <Link
                key={r.id}
                href={`/book/branch/${r.id}${selectedIds.length > 0 ? `?keys=${selectedIds.map(encodeURIComponent).join(",")}` : ""}`}
                className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] p-4 flex flex-col gap-2 hover:bg-[var(--oc-panel2)] transition-colors"
              >
                <div className="flex items-center gap-3">
                  {r.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.logoUrl}
                      alt=""
                      className="w-10 h-10 rounded-lg object-contain bg-[var(--oc-panel2)] border border-[var(--oc-line)] shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-[var(--oc-accent)]/12 border border-[var(--oc-accent)]/30 shrink-0 flex items-center justify-center text-sm font-bold text-[var(--oc-accent)]">
                      {r.tenantName.slice(0, 1)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-[var(--oc-ink)] truncate">
                      {r.name}
                    </div>
                    <div className="text-xs text-[var(--oc-muted3)] truncate">
                      {r.tenantName}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-[var(--oc-muted3)] truncate">
                  {r.address}
                </div>
                <div className={`text-xs font-medium ${r.open ? "text-emerald-500" : "text-[var(--oc-muted3)]"}`}>
                  {r.open ? "Нээлттэй" : "Хаалттай"} · {r.hours}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div>
        <Link
          href="/discover"
          className="text-sm text-[var(--oc-accent)] hover:text-[var(--oc-accent-hi)] transition-colors"
        >
          Бүх автосервисийн каталогийг үзэх →
        </Link>
      </div>
    </div>
  );
}
