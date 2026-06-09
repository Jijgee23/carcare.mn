"use client";

import { useEffect, useRef, useState } from "react";
import {
  type CreatedAccountVehicle,
  quickCreateAccountVehicle,
} from "@/app/_actions/account-vehicles";
import { Field } from "@/app/_components/auth-shell";
import { Select } from "@/app/_components/select";
import { type PublicHurVehicle, normalizeWheelPosition } from "@/lib/hur_service";

const PLATE_PATTERN = /^\d{4}[А-ЯA-Z]{3}$/;
const PLATE_FETCH_DEBOUNCE_MS = 400;

export function InlineAccountVehicleForm({
  onCreated,
  onCancel,
}: {
  onCreated: (v: CreatedAccountVehicle) => void;
  onCancel?: () => void;
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
  const [hurInfo, setHurInfo] = useState<PublicHurVehicle | null>(null);
  const lastFetchedRef = useRef<string | null>(null);

  const trimmedPlate = plate.trim().toUpperCase();
  const isValidPlate = PLATE_PATTERN.test(trimmedPlate);

  // Дугаар хүчинтэй болмогц HUR-аас (admin-тай ижил) мэдээллийг автоматаар татна.
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
          `/api/account/hur/lookup?plate=${encodeURIComponent(trimmedPlate)}`,
          { signal: controller.signal },
        );
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error ?? "HUR-аас мэдээлэл татаж чадсангүй.");
        }
        const v = data.vehicle as PublicHurVehicle;
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
      const res = await quickCreateAccountVehicle({
        plate,
        make,
        model,
        year,
        vin: vin || null,
        fuelType: fuelType || null,
        wheelPosition: wheelPosition || null,
      });
      if (res.ok && res.vehicle) {
        onCreated(res.vehicle);
        setPlate("");
        setVin("");
        setMake("");
        setModel("");
        setYear("");
        setFuelType("");
        setWheelPosition("");
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
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-white/50 hover:text-white/80 transition-colors"
          >
            ✕ Болих
          </button>
        ) : null}
      </div>

      {message ? <p className="text-xs text-red-400">{message}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Улсын дугаар"
          htmlFor="av-plate"
          hint={
            hurLoading
              ? "HUR-аас татаж байна..."
              : "Жишээ: 1234УБА (4 цифр + 3 үсэг)"
          }
          error={fieldErrors.plate ?? hurError ?? undefined}
        >
          <input
            id="av-plate"
            type="text"
            maxLength={7}
            value={plate}
            onChange={(e) => setPlate(e.target.value.toUpperCase())}
            className={`compact-input uppercase ${fieldErrors.plate ? "border-red-500/50" : isValidPlate ? "border-emerald-500/40" : ""}`}
            placeholder="1234УБА"
          />
        </Field>
        <Field label="VIN" htmlFor="av-vin" hint="заавал биш" error={fieldErrors.vin}>
          <input
            id="av-vin"
            type="text"
            maxLength={17}
            value={vin}
            onChange={(e) => setVin(e.target.value.toUpperCase())}
            className="compact-input uppercase"
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
        <Field label="Марк" htmlFor="av-make" error={fieldErrors.make}>
          <input
            id="av-make"
            value={make}
            onChange={(e) => setMake(e.target.value)}
            className={`compact-input ${fieldErrors.make ? "border-red-500/50" : ""}`}
            placeholder="Toyota"
          />
        </Field>
        <Field label="Загвар" htmlFor="av-model" error={fieldErrors.model}>
          <input
            id="av-model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className={`compact-input ${fieldErrors.model ? "border-red-500/50" : ""}`}
            placeholder="Prius 30"
          />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Үйлдвэрлэсэн он" htmlFor="av-year" hint="заавал биш" error={fieldErrors.year}>
          <input
            id="av-year"
            inputMode="numeric"
            value={year}
            onChange={(e) => setYear(e.target.value.replace(/\D/g, ""))}
            className={`compact-input ${fieldErrors.year ? "border-red-500/50" : ""}`}
            placeholder="2018"
          />
        </Field>
        <Field label="Шатахуун" htmlFor="av-fuel" hint="заавал биш">
          <input
            id="av-fuel"
            type="text"
            list="av-fuel-types"
            value={fuelType}
            onChange={(e) => setFuelType(e.target.value)}
            className="compact-input"
            placeholder="Бензин"
          />
          <datalist id="av-fuel-types">
            <option value="Бензин" />
            <option value="Дизель" />
            <option value="Хийн" />
            <option value="Цахилгаан" />
            <option value="Эрлийз" />
          </datalist>
        </Field>
        <Field label="Жолооны хүрд" htmlFor="av-wheel">
          <Select
            id="av-wheel"
            name="wheelPosition"
            value={wheelPosition}
            onChange={setWheelPosition}
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
          {pending ? "Нэмж..." : "Машин нэмэх"}
        </button>
      </div>
    </div>
  );
}
