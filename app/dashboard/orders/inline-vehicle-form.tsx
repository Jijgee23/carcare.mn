"use client";

import { useEffect, useRef, useState } from "react";
import { quickCreateVehicleAction } from "@/app/_actions/quick-create";
import { Field } from "@/app/_components/auth-shell";
import { Select } from "@/app/_components/select";
import { type HurVehicle, normalizeWheelPosition } from "@/lib/hur_service";

export type CreatedVehicle = {
  id: string;
  plate: string;
  make: string;
  model: string;
  customerId: string | null;
};

// 4 цифр + 3 үсэг. Кирилл `А-Я` муж нь Монгол тусгай үсэг Ө/Ү/Ё-г агуулдаггүй
// тул орон нутгийн дугаар (ж: ӨВ…, Ү-тэй) тусад нь нэмнэ.
const PLATE_PATTERN = /^\d{4}[А-ЯЁӨҮA-Z]{3}$/;
const PLATE_FETCH_DEBOUNCE_MS = 400;

export function InlineVehicleForm({
  customerId,
  onCreated,
  onCancel,
}: {
  customerId: string;
  onCreated: (v: CreatedVehicle) => void;
  onCancel: () => void;
}) {
  const [plate, setPlate] = useState("");
  const [vin, setVin] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [fuelType, setFuelType] = useState("");
  const [wheelPosition, setWheelPosition] = useState("");
  const [pending, setPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  const [hurLoading, setHurLoading] = useState(false);
  const [hurError, setHurError] = useState<string | null>(null);
  const [hurInfo, setHurInfo] = useState<HurVehicle | null>(null);
  const lastFetchedRef = useRef<string | null>(null);

  const trimmedPlate = plate.trim().toUpperCase();
  const isValidPlate = PLATE_PATTERN.test(trimmedPlate);

  useEffect(() => {
    if (!isValidPlate) return;
    if (lastFetchedRef.current === trimmedPlate) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      lastFetchedRef.current = trimmedPlate;
      setHurLoading(true);
      setHurError(null);
      setHurInfo(null);
      try {
        const res = await fetch(
          `/api/hur/lookup?plate=${encodeURIComponent(trimmedPlate)}`,
          { signal: controller.signal },
        );
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error ?? "HUR-аас мэдээлэл татаж чадсангүй.");
        }
        const v = data.vehicle as HurVehicle;
        setHurInfo(v);
        if (v.plate) setPlate(v.plate);
        if (v.make) setMake(v.make);
        if (v.model) setModel(v.model);
        if (v.year) setYear(String(v.year));
        if (v.vin) setVin(v.vin);
        if (v.fuelType) setFuelType(v.fuelType);
        const w = normalizeWheelPosition(v.wheelPosition);
        if (w) setWheelPosition(w);
      } catch (e) {
        if (controller.signal.aborted) return;
        setHurError(e instanceof Error ? e.message : "Алдаа гарлаа.");
        lastFetchedRef.current = null;
      } finally {
        if (!controller.signal.aborted) setHurLoading(false);
      }
    }, PLATE_FETCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmedPlate, isValidPlate]);

  async function onSubmit() {
    setPending(true);
    setMessage(null);
    setFieldErrors({});
    try {
      const yearNum = year ? Number.parseInt(year, 10) : null;
      const res = await quickCreateVehicleAction({
        plate,
        vin: vin || null,
        make,
        model,
        year: yearNum && Number.isFinite(yearNum) ? yearNum : null,
        fuelType: fuelType || null,
        wheelPosition: wheelPosition || null,
        customerId,
      });
      if (res.ok && res.vehicle) {
        onCreated(res.vehicle);
        return;
      }
      setFieldErrors(res.fieldErrors ?? {});
      setMessage(res.message ?? null);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Алдаа гарлаа.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-lg border border-violet-500/25 bg-violet-500/[0.06] p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-violet-200">Шинэ машин</h3>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-white/50 hover:text-white/80 transition-colors"
        >
          ✕ Болих
        </button>
      </div>

      {message ? <p className="text-xs text-red-400">{message}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Улсын дугаар"
          htmlFor="qv-plate"
          hint={
            hurLoading
              ? "HUR-аас татаж байна..."
              : "Жишээ: 1234УБА (4 цифр + 3 үсэг)"
          }
          error={fieldErrors.plate ?? hurError ?? undefined}
        >
          <input
            id="qv-plate"
            type="text"
            required
            maxLength={7}
            value={plate}
            onChange={(e) => setPlate(e.target.value.toUpperCase())}
            className={`compact-input uppercase ${fieldErrors.plate ? "border-red-500/50" : isValidPlate ? "border-emerald-500/40" : ""}`}
            placeholder="1234УБА"
          />
        </Field>
        <Field
          label="VIN"
          htmlFor="qv-vin"
          hint="заавал биш"
          error={fieldErrors.vin}
        >
          <input
            id="qv-vin"
            type="text"
            maxLength={17}
            value={vin}
            onChange={(e) => setVin(e.target.value.toUpperCase())}
            className={`compact-input uppercase ${fieldErrors.vin ? "border-red-500/50" : ""}`}
          />
        </Field>
      </div>

      {hurInfo ? (
        <div className="text-xs text-violet-300">
          HUR-аас татав
          {hurInfo.color ? ` · ${hurInfo.color}` : ""}
          {hurInfo.fuelType ? ` · ${hurInfo.fuelType}` : ""}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Марк" htmlFor="qv-make" error={fieldErrors.make}>
          <input
            id="qv-make"
            type="text"
            required
            value={make}
            onChange={(e) => setMake(e.target.value)}
            className={`compact-input ${fieldErrors.make ? "border-red-500/50" : ""}`}
            placeholder="Toyota"
          />
        </Field>
        <Field label="Модель" htmlFor="qv-model" error={fieldErrors.model}>
          <input
            id="qv-model"
            type="text"
            required
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className={`compact-input ${fieldErrors.model ? "border-red-500/50" : ""}`}
            placeholder="Prius 30"
          />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field
          label="Үйлдвэрлэсэн он"
          htmlFor="qv-year"
          hint="заавал биш"
          error={fieldErrors.year}
        >
          <input
            id="qv-year"
            type="number"
            min={1900}
            max={2100}
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className={`compact-input ${fieldErrors.year ? "border-red-500/50" : ""}`}
            placeholder="2015"
          />
        </Field>
        <Field label="Шатахуун" htmlFor="qv-fuel" hint="заавал биш">
          <input
            id="qv-fuel"
            type="text"
            list="qv-fuel-types"
            value={fuelType}
            onChange={(e) => setFuelType(e.target.value)}
            className="compact-input"
            placeholder="Бензин"
          />
          <datalist id="qv-fuel-types">
            <option value="Бензин" />
            <option value="Дизель" />
            <option value="Хийн" />
            <option value="Цахилгаан" />
            <option value="Эрлийз" />
          </datalist>
        </Field>
        <Field
          label="Жолооны хүрд"
          htmlFor="qv-wheel"
          error={fieldErrors.wheelPosition}
        >
          <Select
            id="qv-wheel"
            name="wheelPosition"
            value={wheelPosition}
            onChange={setWheelPosition}
            error={fieldErrors.wheelPosition}
            options={[
              { value: "Зүүн", label: "Зүүн талдаа" },
              { value: "Баруун", label: "Баруун талдаа" },
            ]}
          />
        </Field>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          disabled={pending}
          onClick={onSubmit}
          className="bg-violet-600 hover:bg-violet-500 disabled:opacity-60 transition-colors px-4 py-2 rounded-lg text-sm font-medium"
        >
          {pending ? "Үүсгэж..." : "Машин үүсгэх"}
        </button>
      </div>
    </div>
  );
}
