"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import {
  type VehicleActionState,
  createVehicleAction,
  updateVehicleAction,
} from "@/app/_actions/vehicles";
import { Field, FormError } from "@/app/_components/auth-shell";
import { Btn, BtnLink } from "@/app/_components/landing-ops-ui";
import { Select } from "@/app/_components/select";
import { customerLabel } from "@/lib/customers";
import {
  type HurVehicle,
  normalizeWheelPosition,
  ownerKindFromRegnum,
} from "@/lib/hur_service";

// Монгол улсын дугаарын хэлбэр: 4 цифр + 3 үсэг (Кирилл эсвэл Латин).
// 4 цифр + 3 үсэг. Кирилл `А-Я` муж нь Монгол тусгай үсэг Ө/Ү/Ё-г агуулдаггүй
// тул орон нутгийн дугаар (ж: ӨВ…, Ү-тэй) тусад нь нэмнэ.
const PLATE_PATTERN = /^\d{4}[А-ЯЁӨҮA-Z]{3}$/;
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
  colorName: string | null;
  capacity: number | null;
  purpose: string | null;
  ownerRegnum: string | null;
  customerId: string | null;
  isPostpaid?: boolean;
};

type Customer = { id: string; fullName: string; phone: string };

export const VEHICLE_FORM_ID = "vehicle-form";

const FIELD_MW = "max-w-xs";

/* HUR-аас автоматаар бөглөгддөг талбарын тэмдэглэгээ: талбар бүрт hint
   давтахын оронд label дээр жижиг badge + grid-ийн доор нэг тайлбар. */
function HurBadge() {
  return (
    <span
      title="HUR-аас автоматаар бөглөгдөнө"
      className="inline-flex items-center rounded px-1 py-px text-[9px] font-semibold tracking-wider bg-sky-500/15 text-sky-400 light:bg-sky-100 light:text-sky-700"
    >
      HUR
    </span>
  );
}

function HurLabel({ children }: { children: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {children}
      <HurBadge />
    </span>
  );
}

/* HUR-аас бөглөгддөг талбаруудын input-д зөөлөн туяа — гараар бөглөх
   талбаруудаас визуалаар ялгана (засах боломжтой хэвээр). */
const HUR_TINT = "bg-sky-500/[0.05]";

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
  const [colorName, setColorName] = useState<string>(initial?.colorName ?? "");
  const [capacity, setCapacity] = useState<string>(
    initial?.capacity != null ? String(initial.capacity) : "",
  );
  const [purpose, setPurpose] = useState<string>(initial?.purpose ?? "");
  const [ownerRegnum, setOwnerRegnum] = useState<string>(
    initial?.ownerRegnum ?? "",
  );
  const [customerId, setCustomerId] = useState(
    initial?.customerId ?? defaultCustomerId ?? "",
  );
  const [isPostpaid, setIsPostpaid] = useState(initial?.isPostpaid ?? false);

  const [hurLoading, setHurLoading] = useState(false);
  const [hurError, setHurError] = useState<string | null>(null);
  const [hurInfo, setHurInfo] = useState<HurVehicle | null>(null);
  // Мэдээллийн эх сурвалж: системийн global бүртгэл эсвэл HUR registry.
  const [hurSource, setHurSource] = useState<"global" | "hur">("hur");
  // Энэ tenant-д аль хэдийн бүртгэлтэй — хадгалахад алдаа өгөх тул урьдчилан анхааруулна.
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
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

  // HUR-аас ирсэн мэдээллийг form талбаруудад тавина.
  function applyHurVehicle(v: HurVehicle) {
    setHurInfo(v);
    if (v.plate) setPlate(v.plate);
    if (v.make) setMake(v.make);
    if (v.model) setModel(v.model);
    if (v.year) setYear(String(v.year));
    if (v.vin) setVin(v.vin);
    if (v.fuelType) setFuelType(v.fuelType);
    const normalizedWheel = normalizeWheelPosition(v.wheelPosition);
    if (normalizedWheel) setWheelPosition(normalizedWheel);
    if (v.color) setColorName(v.color);
    if (v.capacity) setCapacity(String(v.capacity));
    if (v.purpose) setPurpose(v.purpose);
    if (v.owner?.regnum) setOwnerRegnum(v.owner.regnum);
    if (!customerId && v.owner?.phone) {
      const matched = matchCustomerByPhone(v.owner.phone);
      if (matched) setCustomerId(matched);
    }
  }

  // Гар аргаар HUR-аас дахин татах (debounce/guard-гүй). Дэлгэрэнгүй хуудсанд
  // дугаар хэвээр байгаа тул auto-fetch ажиллахгүй — энэ товчоор шинэчилнэ.
  async function refreshFromHur() {
    const p = plate.trim().toUpperCase();
    if (!PLATE_PATTERN.test(p)) {
      setHurError("Дугаар буруу хэлбэртэй.");
      return;
    }
    setHurLoading(true);
    setHurError(null);
    setHurInfo(null);
    try {
      const res = await fetch(
        `/api/hur/lookup?plate=${encodeURIComponent(p)}`,
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "HUR-аас мэдээлэл татаж чадсангүй.");
      }
      applyHurVehicle(data.vehicle as HurVehicle);
      setHurSource(data.source === "global" ? "global" : "hur");
      setAlreadyRegistered(Boolean(data.registered) && !isEdit);
      lastFetchedRef.current = p;
    } catch (e) {
      setHurError(e instanceof Error ? e.message : "Алдаа гарлаа.");
    } finally {
      setHurLoading(false);
    }
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
        applyHurVehicle(data.vehicle as HurVehicle);
        setHurSource(data.source === "global" ? "global" : "hur");
        setAlreadyRegistered(Boolean(data.registered) && !isEdit);
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
    <form id={VEHICLE_FORM_ID} action={formAction} className="flex flex-col gap-4" noValidate>
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
              className={`auth-input uppercase pr-10 ${fe.plate || showFormatError
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
                  className="w-4 h-4 animate-spin text-[var(--oc-accent)]"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              ) : isValidPlate && hurInfo ? (
                <svg className="w-4 h-4 text-[var(--oc-ok)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : null}
            </div>
          </div>
        </Field>

        <Field label={<HurLabel>VIN</HurLabel>} htmlFor="vin" hint="17 тэмдэгт, заавал биш" error={fe.vin} className={FIELD_MW}>
          <input
            id="vin"
            name="vin"
            type="text"
            maxLength={17}
            value={vin}
            onChange={(e) => setVin(e.target.value.toUpperCase())}
            className={`auth-input uppercase ${HUR_TINT} ${fe.vin ? "border-red-500/50" : ""}`}
            placeholder="JT2BF22K1W0123456"
          />
        </Field>

        <Field label={<HurLabel>Марк</HurLabel>} htmlFor="make" error={fe.make} className={FIELD_MW}>
          <input
            id="make"
            name="make"
            type="text"
            required
            value={make}
            onChange={(e) => setMake(e.target.value)}
            className={`auth-input ${HUR_TINT} ${fe.make ? "border-red-500/50" : ""}`}
            placeholder="Toyota"
          />
        </Field>
        <Field label={<HurLabel>Модель</HurLabel>} htmlFor="model" error={fe.model} className={FIELD_MW}>
          <input
            id="model"
            name="model"
            type="text"
            required
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className={`auth-input ${HUR_TINT} ${fe.model ? "border-red-500/50" : ""}`}
            placeholder="Prius 30"
          />
        </Field>

        <Field label={<HurLabel>Үйлдвэрлэсэн он</HurLabel>} htmlFor="year" hint="заавал биш" error={fe.year} className={FIELD_MW}>
          <input
            id="year"
            name="year"
            type="number"
            min={1900}
            max={2100}
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className={`auth-input ${HUR_TINT} ${fe.year ? "border-red-500/50" : ""}`}
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
            className={`auth-input ${fe.mileage ? "border-red-500/50" : ""}`}
            placeholder="120000"
          />
        </Field>

        <Field label={<HurLabel>Шатахуун</HurLabel>} htmlFor="fuelType" error={fe.fuelType} className={FIELD_MW}>
          <input
            id="fuelType"
            name="fuelType"
            type="text"
            list="fuel-types"
            value={fuelType}
            onChange={(e) => setFuelType(e.target.value)}
            className={`auth-input ${HUR_TINT} ${fe.fuelType ? "border-red-500/50" : ""}`}
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
        <Field label={<HurLabel>Жолооны хүрд</HurLabel>} htmlFor="wheelPosition" error={fe.wheelPosition} className={FIELD_MW}>
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

        <Field label={<HurLabel>Өнгө</HurLabel>} htmlFor="colorName" error={fe.colorName} className={FIELD_MW}>
          <input
            id="colorName"
            name="colorName"
            type="text"
            value={colorName}
            onChange={(e) => setColorName(e.target.value)}
            className={`auth-input ${HUR_TINT} ${fe.colorName ? "border-red-500/50" : ""}`}
            placeholder="Цагаан"
          />
        </Field>
        <Field label={<HurLabel>Моторын хэмжээ (см³)</HurLabel>} htmlFor="capacity" error={fe.capacity} className={FIELD_MW}>
          <input
            id="capacity"
            name="capacity"
            type="number"
            min={0}
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            className={`auth-input ${HUR_TINT} ${fe.capacity ? "border-red-500/50" : ""}`}
            placeholder="1496"
          />
        </Field>
        <Field label={<HurLabel>Зориулалт</HurLabel>} htmlFor="purpose" error={fe.purpose} className={FIELD_MW}>
          <input
            id="purpose"
            name="purpose"
            type="text"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            className={`auth-input ${HUR_TINT} ${fe.purpose ? "border-red-500/50" : ""}`}
            placeholder="Суудал"
          />
        </Field>
        <Field
          label={<HurLabel>Эзэмшигчийн регистр</HurLabel>}
          htmlFor="ownerRegnum"
          hint={ownerKindFromRegnum(ownerRegnum) ?? undefined}
          error={fe.ownerRegnum}
          className={FIELD_MW}
        >
          <input
            id="ownerRegnum"
            name="ownerRegnum"
            type="text"
            value={ownerRegnum}
            onChange={(e) => setOwnerRegnum(e.target.value)}
            className={`auth-input ${HUR_TINT} ${fe.ownerRegnum ? "border-red-500/50" : ""}`}
            placeholder="РГ95112617 / 1234567"
          />
        </Field>
      </div>

      {/* HUR badge-ийн нэгдсэн тайлбар — талбар бүрт hint давтахгүй */}
      <p className="text-xs text-[var(--oc-muted3)] flex items-center gap-1.5 flex-wrap">
        <HurBadge /> тэмдэгтэй талбарууд улсын дугаараар HUR буюу системийн
        бүртгэлээс автоматаар бөглөгдөнө — шаардлагатай бол гараар засаж болно.
      </p>

      <label className="flex items-start gap-2.5 cursor-pointer select-none max-w-2xl">
        <input
          type="checkbox"
          name="isPostpaid"
          checked={isPostpaid}
          onChange={(e) => setIsPostpaid(e.target.checked)}
          className="mt-0.5 w-4 h-4 accent-[var(--oc-accent)] shrink-0"
        />
        <span>
          <span className="text-sm text-[var(--oc-ink2)] font-medium">
            Дараа төлбөрт машин
          </span>
          <span className="block text-xs text-[var(--oc-muted3)] mt-0.5">
            Захиалгын төлбөрийг тухай бүрд нь биш, гэрээгээр (сараар) нэгтгэн
            төлнө. Захиалгууд нь «Дараа төлбөрт» түүхэнд тусдаа харагдана.
          </span>
        </span>
      </label>

      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={refreshFromHur}
          disabled={hurLoading || !isValidPlate}
          className="inline-flex items-center gap-2 text-sm text-[var(--oc-accent)] hover:text-[var(--oc-accent-hi)] disabled:text-[var(--oc-muted4)] disabled:cursor-not-allowed border border-[var(--oc-accent)]/30 hover:border-[var(--oc-accent)]/50 disabled:border-[var(--oc-line)] bg-[var(--oc-accent)]/[0.06] hover:bg-[var(--oc-accent)]/[0.12] disabled:bg-transparent transition-all px-4 py-2 rounded-lg font-medium"
        >
          {hurLoading ? (
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 2v6h-6M3 12a9 9 0 0115-6.7L21 8M3 22v-6h6M21 12a9 9 0 01-15 6.7L3 16" />
            </svg>
          )}
          {hurLoading ? "Татаж байна..." : "HUR-аас мэдээлэл шинэчлэх"}
        </button>
        {!isValidPlate ? (
          <span className="text-xs text-[var(--oc-muted4)]">
            Зөв улсын дугаар оруулсны дараа боломжтой
          </span>
        ) : null}
      </div>

      {alreadyRegistered ? (
        <div className="rounded-[10px] border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-400 light:bg-amber-100 light:border-amber-300 light:text-amber-700 max-w-3xl">
          Энэ улсын дугаартай машин танай бүртгэлд аль хэдийн байна — дахин
          үүсгэх боломжгүй.{" "}
          <Link
            href={`/dashboard/vehicles?q=${encodeURIComponent(trimmedPlate)}`}
            className="underline hover:no-underline"
          >
            Бүртгэлээс харах →
          </Link>
        </div>
      ) : null}

      {hurInfo ? (
        <div className="rounded-[10px] border border-[var(--oc-accent)]/20 bg-[var(--oc-accent)]/[0.06] px-4 py-3 text-xs text-[var(--oc-ink2)] flex flex-col gap-1 max-w-3xl">
          <div className="text-[var(--oc-accent)] font-medium">
            {hurSource === "global" ? "Системийн бүртгэлээс" : "HUR-аас татав"}
            {hurInfo.color ? ` · ${hurInfo.color}` : ""}
            {hurInfo.capacity ? ` · ${hurInfo.capacity} см³` : ""}
            {hurInfo.fuelType ? ` · ${hurInfo.fuelType}` : ""}
            {hurInfo.purpose ? ` · ${hurInfo.purpose}` : ""}
            {hurInfo.country ? ` · ${hurInfo.country}` : ""}
            {hurInfo.wheelPosition ? ` · ${hurInfo.wheelPosition} жолоо` : ""}
          </div>
          {hurInfo.owner ? (
            <div>
              <span className="text-[var(--oc-muted3)]">Эзэмшигч:</span>{" "}
              {hurInfo.owner.lastName ?? ""} {hurInfo.owner.firstName ?? "—"}
              {ownerKindFromRegnum(hurInfo.owner.regnum)
                ? ` · ${ownerKindFromRegnum(hurInfo.owner.regnum)}`
                : ""}
              {hurInfo.owner.phone ? ` · ${hurInfo.owner.phone}` : ""}
              {hurInfo.owner.address ? ` · ${hurInfo.owner.address}` : ""}
              {!customerId && hurInfo.owner.phone ? (
                <Link
                  href={`/dashboard/customers/new?fullName=${encodeURIComponent(`${hurInfo.owner.lastName ?? ""} ${hurInfo.owner.firstName ?? ""}`.trim())}&phone=${encodeURIComponent(hurInfo.owner.phone)}`}
                  target="_blank"
                  className="ml-2 text-[var(--oc-accent)] hover:text-[var(--oc-accent-hi)]"
                >
                  → Үйлчлүүлэгч нэмэх
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Sticky action bar — урт форм scroll хийхэд ч Хадгалах үргэлж харагдана */}
      <div className="sticky bottom-0 z-10 flex gap-2 pl-3 pt-3 pb-3 -mb-1 border-t border-[var(--oc-line2)] bg-[var(--oc-carbon)]/95 backdrop-blur-md">
        <BtnLink href={backHref} variant="ghost">
          ← Буцах
        </BtnLink>
        <Btn type="submit" disabled={pending}>
          {pending ? "..." : isEdit ? "Хадгалах" : "Үүсгэх"}
        </Btn>
      </div>
    </form>
  );
}
