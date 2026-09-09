"use client";

import { useActionState, useRef, useState } from "react";
import type { CreatedAccountVehicle } from "@/app/_actions/account-vehicles";
import {
  type AppointmentActionState,
  createAppointment,
} from "@/app/_actions/appointments";
import { Field, FormError } from "@/app/_components/auth-shell";
import {
  BranchTimePicker,
  type BranchTimePickerHandle,
} from "@/app/_components/branch-time-picker";
import { Select } from "@/app/_components/select";
import type { Weekday } from "@/lib/branches";
import type { ScheduleException, ScheduleSeason, ScheduleRule } from "@/lib/branch-effective-schedule";
import { formatDuration } from "@/lib/category-duration";
import { InlineAccountVehicleForm } from "@/app/(app)/account/inline-account-vehicle-form";

type Category = { id: string; name: string; durationMinutes: number };
type Branch = {
  id: string;
  name: string;
  openWeekdays: Weekday[];
  schedule: {
    openTime: string | null;
    closeTime: string | null;
    schedules: ScheduleRule[];
    scheduleExceptions?: ScheduleException[];
    scheduleSeasons?: ScheduleSeason[];
  };
  categories: Category[];
};
// id нь global Vehicle id (AccountVehicle link биш).
type Vehicle = { id: string; plate: string; make: string; model: string };

export function BookingForm({
  branches,
  vehicles: initialVehicles,
  initialBranchId = "",
}: {
  branches: Branch[];
  vehicles: Vehicle[];
  initialBranchId?: string;
}) {
  const [state, formAction, pending] = useActionState<
    AppointmentActionState,
    FormData
  >(createAppointment, null);
  const fe = state?.fieldErrors ?? {};

  // Booking v2 — category-first: эхлээд үйлчилгээгээ сонгоно (заавал биш),
  // дараа нь тэдгээрийг БҮГДийг нь санал болгодог салбарууд л сонгогдоно.
  // Аль замаар ирсэн ч (discover-с тодорхой салбар сонгож орж ирсэн) энэ
  // салбар шууд идэвхтэй хэвээр — ангилал сонгох нь блоклохгүй, зөвхөн
  // БУСАД салбарыг харьцуулах/шүүх зорилготой (mobile-тай адил шийдвэр).
  const [branchId, setBranchId] = useState(
    initialBranchId || (branches.length === 1 ? branches[0].id : ""),
  );
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>(initialVehicles);
  const [vehicleId, setVehicleId] = useState(
    initialVehicles.length === 1 ? initialVehicles[0].id : "",
  );
  const [showVehForm, setShowVehForm] = useState(false);
  const [selectedIso, setSelectedIso] = useState("");
  const timePickerRef = useRef<BranchTimePickerHandle>(null);

  const selectedBranch = branches.find((b) => b.id === branchId);

  // Байгууллагын БҮХ салбарт байгаа ангиллууд (давхардалгүй, нэрээр эрэмбэлэгдсэн).
  const allCategories = (() => {
    const byId = new Map<string, Category>();
    for (const b of branches) for (const c of b.categories) byId.set(c.id, c);
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  })();

  // Сонгосон ангилал БҮГДийг санал болгодог салбарууд (АНД) — ангилал огт
  // сонгоогүй бол БҮХ салбар (`every` хоосон массив дээр үнэн).
  const compatibleBranches = branches.filter((b) =>
    categoryIds.every((id) => b.categories.some((c) => c.id === id)),
  );

  const selectedDurationMinutes = (selectedBranch?.categories ?? [])
    .filter((c) => categoryIds.includes(c.id))
    .reduce((sum, c) => sum + c.durationMinutes, 0);

  function toggleCategory(id: string, checked: boolean) {
    const next = checked
      ? [...categoryIds, id]
      : categoryIds.filter((x) => x !== id);
    setCategoryIds(next);
    // Идэвхтэй салбар цаашид тохирохгүй бол — ганц тохирох салбар үлдсэн бол
    // автоматаар түүнийг сонгоно, эс бөгөөс дахин сонгуулахаар хоослоно.
    const compatible = branches.filter((b) =>
      next.every((cid) => b.categories.some((c) => c.id === cid)),
    );
    if (!compatible.some((b) => b.id === branchId)) {
      // Салбар өөрчлөгдөнө (эсвэл хоослогдоно) — `key={branchId}`-ээр
      // remount хийгдэж дотоод төлөв (огноо гэх мэт) аль хэдийн цэвэрлэгдэнэ,
      // тул reload дуудах шаардлагагүй (хуучин instance дээр дуудвал
      // unmount-ийн дараах setState анхааруулга үүсгэнэ).
      setBranchId(compatible.length === 1 ? compatible[0].id : "");
    } else {
      timePickerRef.current?.reload(next);
    }
  }

  function onBranchChange(v: string) {
    setBranchId(v);
    setSelectedIso("");
  }

  function onVehCreated(v: CreatedAccountVehicle) {
    setVehicles((prev) => [
      { id: v.vehicleId, plate: v.plate, make: v.make, model: v.model },
      ...prev,
    ]);
    setVehicleId(v.vehicleId);
    setShowVehForm(false);
  }

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <FormError message={state?.message && !state.ok ? state.message : undefined} />
      <input type="hidden" name="requestedAt" value={selectedIso} />
      {categoryIds.map((id) => (
        <input key={id} type="hidden" name="categoryIds" value={id} />
      ))}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 items-start">
        {/* Зүүн багана: ангилал, салбар, машин, тэмдэглэл */}
        <div className="flex flex-col gap-4">
          {allCategories.length > 0 ? (
            <Field label="Үйлчилгээ" htmlFor="category-0" hint="заавал биш">
              <div className="flex flex-col gap-2">
                {categoryIds.length > 0 ? (
                  <p className="text-xs text-white/40">
                    Нийт ойролцоогоор {formatDuration(selectedDurationMinutes)}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {allCategories.map((c, i) => {
                    const checked = categoryIds.includes(c.id);
                    return (
                      <label
                        key={c.id}
                        htmlFor={`category-${i}`}
                        className={`px-3 py-1.5 rounded-lg border text-sm cursor-pointer transition-colors select-none ${
                          checked
                            ? "bg-violet-600 border-violet-500 text-white font-medium"
                            : "border-white/[0.12] bg-white/[0.04] text-white/70 hover:border-violet-500/40"
                        }`}
                      >
                        <input
                          id={`category-${i}`}
                          type="checkbox"
                          className="sr-only"
                          checked={checked}
                          onChange={(e) => toggleCategory(c.id, e.target.checked)}
                        />
                        {c.name}
                      </label>
                    );
                  })}
                </div>
              </div>
            </Field>
          ) : null}

          {/* Дэвийн шийдвэрээр: ангилал сонгогдоогүй бол салбар сонгох
              хэсгийг нуана — эхлээд орж ирсэн салбар (initialBranchId эсвэл
              цорын ганц салбар) хэвээрээ идэвхтэй хэрэглэгдэнэ. */}
          {branches.length > 1 && categoryIds.length > 0 ? (
            <Field label="Салбар" htmlFor="branchId" error={fe.branchId}>
              {compatibleBranches.length === 0 ? (
                <p className="text-xs text-red-400 light:text-red-600">
                  Сонгосон бүх үйлчилгээг нэгэн зэрэг санал болгодог салбар
                  алга байна. Үйлчилгээнийхээ сонголтоо өөрчилнө үү.
                </p>
              ) : (
                <Select
                  id="branchId"
                  name="branchId"
                  required
                  value={branchId}
                  onChange={onBranchChange}
                  error={fe.branchId}
                  placeholder="— Сонгох —"
                  options={compatibleBranches.map((b) => ({
                    value: b.id,
                    label: b.name,
                  }))}
                />
              )}
            </Field>
          ) : (
            <input type="hidden" name="branchId" value={branchId} />
          )}

          <Field
            label="Машин"
            htmlFor="vehicleId"
            hint="заавал биш"
            error={fe.vehicleId}
          >
            <div className="flex gap-2">
              <div className="flex-1 min-w-0">
                <Select
                  id="vehicleId"
                  name="vehicleId"
                  value={vehicleId}
                  onChange={setVehicleId}
                  error={fe.vehicleId}
                  placeholder={
                    vehicles.length === 0 ? "— Машингүй —" : "— Сонгох —"
                  }
                  options={vehicles.map((v) => ({
                    value: v.id,
                    label: v.plate,
                    hint: `${v.make} ${v.model}`,
                  }))}
                />
              </div>
              <button
                type="button"
                onClick={() => setShowVehForm((v) => !v)}
                className="shrink-0 px-2.5 rounded-lg border border-violet-500/30 bg-violet-500/10 hover:bg-violet-500/20 text-violet-200 light:bg-violet-100 light:hover:bg-violet-200 light:border-violet-300 light:text-violet-700 text-xs font-medium transition-colors"
                title="Шинэ машин нэмэх"
              >
                {showVehForm ? "✕" : "+"}
              </button>
            </div>
          </Field>

          {showVehForm ? (
            <InlineAccountVehicleForm
              onCreated={onVehCreated}
              onCancel={() => setShowVehForm(false)}
            />
          ) : null}

          <Field label="Тэмдэглэл" htmlFor="note" hint="заавал биш">
            <textarea
              id="note"
              name="note"
              rows={2}
              className="compact-input resize-y"
              placeholder="Ямар үйлчилгээ авах, гомдол..."
            />
          </Field>
        </div>

        {/* Дунд + баруун багана: календар | боломжит цаг */}
        <BranchTimePicker
          key={branchId || "none"}
          branchId={branchId}
          categoryIds={categoryIds}
          openWeekdays={selectedBranch?.openWeekdays}
          schedule={selectedBranch?.schedule}
          value={selectedIso}
          onChange={setSelectedIso}
          error={fe.requestedAt}
        />
      </div>

      <button
        type="submit"
        disabled={pending || !selectedIso || !branchId}
        className="self-start bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all px-6 py-2.5 rounded-xl font-medium text-sm"
      >
        {pending ? "..." : "Цаг захиалах"}
      </button>
    </form>
  );
}
