"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import {
  type VehicleActionState,
  createVehicleAction,
  updateVehicleAction,
} from "@/app/_actions/vehicles";
import { Field, FormError } from "@/app/_components/auth-shell";
import { Select } from "@/app/_components/select";
import { customerLabel } from "@/lib/customers";
import { type HurVehicle, normalizeWheelPosition } from "@/lib/hur_service";

// Монгол улсын дугаарын хэлбэр: 4 цифр + 3 үсэг (Кирилл эсвэл Латин).
const PLATE_PATTERN = /^\d{4}[А-ЯA-Z]{3}$/;
const PLATE_FETCH_DEBOUNCE_MS = 400;

type Initial = {
  id?: string;
  plate: string;
  vin: string | null;
  make: string;
  model: string;
  year: number | null;
  mileage: number | null;
  fuelType: string | null;
  wheelPosition: string | null;
  customerId: string | null;
};

type Customer = { id: string; fullName: string; phone: string };

const FIELD_MW = "max-w-xs";

export function VehicleForm({
  initial,
  customers,
  defaultCustomerId,
  backHref = "/dashboard/vehicles",
}: {
  initial?: Initial;
  customers: Customer[];
  defaultCustomerId?: string;
  backHref?: string;
}) {
  const isEdit = Boolean(initial?.id);
  const action = isEdit
    ? updateVehicleAction.bind(null, initial!.id!)
    : createVehicleAction;

  const [state, formAction, pending] = useActionState<
    VehicleActionState,
    FormData
  >(action, null);

  const fe = state?.fieldErrors ?? {};

  const [plate, setPlate] = useState(initial?.plate ?? "");
  const [vin, setVin] = useState(initial?.vin ?? "");
  const [make, setMake] = useState(initial?.make ?? "");
  const [model, setModel] = useState(initial?.model ?? "");
  const [year, setYear] = useState<string>(
    initial?.year != null ? String(initial.year) : "",
  );
  const [mileage, setMileage] = useState<string>(
    initial?.mileage != null ? String(initial.mileage) : "",
  );
  const [fuelType, setFuelType] = useState<string>(initial?.fuelType ?? "");
  const [wheelPosition, setWheelPosition] = useState<string>(
    initial?.wheelPosition ?? "",
  );
  const [customerId, setCustomerId] = useState(
    initial?.customerId ?? defaultCustomerId ?? "",
  );

  const [hurLoading, setHurLoading] = useState(false);
  const [hurError, setHurError] = useState<string | null>(null);
  const [hurInfo, setHurInfo] = useState<HurVehicle | null>(null);
  const lastFetchedRef = useRef<string | null>(initial?.plate ?? null);

  const trimmedPlate = plate.trim().toUpperCase();
  const isValidPlate = PLATE_PATTERN.test(trimmedPlate);
  const showFormatError = trimmedPlate.length > 0 && !isValidPlate;

  function matchCustomerByPhone(phone: string | null): string | null {
    if (!phone) return null;
    const normalized = phone.replace(/\D/g, "");
    if (!normalized) return null;
    const found = customers.find(
      (c) => c.phone.replace(/\D/g, "") === normalized,
    );
    return found?.id ?? null;
  }

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
        const normalizedWheel = normalizeWheelPosition(v.wheelPosition);
        if (normalizedWheel) setWheelPosition(normalizedWheel);
        if (!customerId && v.owner?.phone) {
          const matched = matchCustomerByPhone(v.owner.phone);
          if (matched) setCustomerId(matched);
        }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmedPlate, isValidPlate]);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <FormError message={state?.message} />

      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <Field label="Эзэмшигч" htmlFor="customerId" error={fe.customerId} className={FIELD_MW}>
          <Select
            id="customerId"
            name="customerId"
            value={customerId}
            onChange={setCustomerId}
            error={fe.customerId}
            options={customers.map((c) => ({
              value: c.id,
              label: customerLabel(c),
              hint: c.phone,
            }))}
          />
        </Field>

        <Field
          label="Улсын дугаар"
          htmlFor="plate"
          hint={
            hurLoading
              ? "HUR-аас татаж байна..."
              : isValidPlate
                ? "Зөв · мэдээлэл татна"
                : "Жишээ: 1234УБА"
          }
          error={
            fe.plate ??
            (showFormatError
              ? "Дугаар буруу хэлбэртэй."
              : (hurError ?? undefined))
          }
          className={FIELD_MW}
        >
          <div className="relative">
            <input
              id="plate"
              name="plate"
              type="text"
              required
              maxLength={7}
              value={plate}
              onChange={(e) => setPlate(e.target.value.toUpperCase())}
              aria-invalid={showFormatError || Boolean(fe.plate)}
              className={`compact-input uppercase pr-10 ${
                fe.plate || showFormatError
                  ? "border-red-500/50"
                  : isValidPlate
                    ? "border-emerald-500/40"
                    : ""
              }`}
              placeholder="1234УБА"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
              {hurLoading ? (
                <svg
                  className="w-4 h-4 animate-spin text-violet-300"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              ) : isValidPlate && hurInfo ? (
                <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : null}
            </div>
          </div>
        </Field>

        <Field label="VIN" htmlFor="vin" hint="17 тэмдэгт, заавал биш" error={fe.vin} className={FIELD_MW}>
          <input
            id="vin"
            name="vin"
            type="text"
            maxLength={17}
            value={vin}
            onChange={(e) => setVin(e.target.value.toUpperCase())}
            className={`compact-input uppercase ${fe.vin ? "border-red-500/50" : ""}`}
            placeholder="JT2BF22K1W0123456"
          />
        </Field>

        <Field label="Марк" htmlFor="make" error={fe.make} className={FIELD_MW}>
          <input
            id="make"
            name="make"
            type="text"
            required
            value={make}
            onChange={(e) => setMake(e.target.value)}
            className={`compact-input ${fe.make ? "border-red-500/50" : ""}`}
            placeholder="Toyota"
          />
        </Field>
        <Field label="Модель" htmlFor="model" error={fe.model} className={FIELD_MW}>
          <input
            id="model"
            name="model"
            type="text"
            required
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className={`compact-input ${fe.model ? "border-red-500/50" : ""}`}
            placeholder="Prius 30"
          />
        </Field>

        <Field label="Үйлдвэрлэсэн он" htmlFor="year" hint="заавал биш" error={fe.year} className={FIELD_MW}>
          <input
            id="year"
            name="year"
            type="number"
            min={1900}
            max={2100}
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className={`compact-input ${fe.year ? "border-red-500/50" : ""}`}
            placeholder="2015"
          />
        </Field>
        <Field label="Гүйлт (км)" htmlFor="mileage" hint="заавал биш" error={fe.mileage} className={FIELD_MW}>
          <input
            id="mileage"
            name="mileage"
            type="number"
            min={0}
            value={mileage}
            onChange={(e) => setMileage(e.target.value)}
            className={`compact-input ${fe.mileage ? "border-red-500/50" : ""}`}
            placeholder="120000"
          />
        </Field>

        <Field label="Шатахуун" htmlFor="fuelType" hint="HUR-аас автоматаар" error={fe.fuelType} className={FIELD_MW}>
          <input
            id="fuelType"
            name="fuelType"
            type="text"
            list="fuel-types"
            value={fuelType}
            onChange={(e) => setFuelType(e.target.value)}
            className={`compact-input ${fe.fuelType ? "border-red-500/50" : ""}`}
            placeholder="Бензин"
          />
          <datalist id="fuel-types">
            <option value="Бензин" />
            <option value="Дизель" />
            <option value="Хийн" />
            <option value="Цахилгаан" />
            <option value="Эрлийз" />
          </datalist>
        </Field>
        <Field label="Жолооны хүрд" htmlFor="wheelPosition" error={fe.wheelPosition} className={FIELD_MW}>
          <Select
            id="wheelPosition"
            name="wheelPosition"
            value={wheelPosition}
            onChange={setWheelPosition}
            error={fe.wheelPosition}
            options={[
              { value: "Зүүн", label: "Зүүн талдаа" },
              { value: "Баруун", label: "Баруун талдаа" },
            ]}
          />
        </Field>
      </div>

      {hurInfo ? (
        <div className="rounded-lg border border-violet-500/20 bg-violet-500/[0.06] px-4 py-3 text-xs text-white/70 flex flex-col gap-1 max-w-3xl">
          <div className="text-violet-300 font-medium">
            HUR-аас татав
            {hurInfo.color ? ` · ${hurInfo.color}` : ""}
            {hurInfo.fuelType ? ` · ${hurInfo.fuelType}` : ""}
            {hurInfo.country ? ` · ${hurInfo.country}` : ""}
            {hurInfo.wheelPosition ? ` · ${hurInfo.wheelPosition} жолоо` : ""}
          </div>
          {hurInfo.owner ? (
            <div>
              <span className="text-white/40">Эзэмшигч:</span>{" "}
              {hurInfo.owner.lastName ?? ""} {hurInfo.owner.firstName ?? "—"}
              {hurInfo.owner.phone ? ` · ${hurInfo.owner.phone}` : ""}
              {hurInfo.owner.address ? ` · ${hurInfo.owner.address}` : ""}
              {!customerId && hurInfo.owner.phone ? (
                <Link
                  href={`/dashboard/customers/new?fullName=${encodeURIComponent(`${hurInfo.owner.lastName ?? ""} ${hurInfo.owner.firstName ?? ""}`.trim())}&phone=${encodeURIComponent(hurInfo.owner.phone)}`}
                  target="_blank"
                  className="ml-2 text-violet-300 hover:text-violet-200"
                >
                  → Үйлчлүүлэгч нэмэх
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex gap-2 pt-3 border-t border-white/[0.05]">
        <Link
          href={backHref}
          className="bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] transition-all px-5 py-2 rounded-lg font-medium text-sm text-white/60 text-center"
        >
          ← Буцах
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="bg-violet-600 hover:bg-violet-500 disabled:opacity-60 disabled:cursor-not-allowed transition-all px-6 py-2 rounded-lg font-medium text-sm"
        >
          {pending ? "..." : isEdit ? "Хадгалах" : "Үүсгэх"}
        </button>
      </div>
    </form>
  );
}
