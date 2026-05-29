"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useActionState, useState } from "react";
import {
  type BranchActionState,
  createBranchAction,
  updateBranchAction,
} from "@/app/_actions/branches";
import { Field, FormError } from "@/app/_components/auth-shell";
import { DEFAULT_OPEN_DAYS, WEEK_DAYS, type Weekday } from "@/lib/branches";

// Leaflet нь window-д шууд хандах учир SSR хийгдэхгүйгээр lazy load
const LocationPicker = dynamic(
  () => import("./location-picker").then((m) => m.LocationPicker),
  {
    ssr: false,
    loading: () => (
      <div className="h-72 w-full rounded-xl border border-white/[0.08] bg-white/[0.02] flex items-center justify-center text-sm text-white/40">
        Газрын зураг ачаалж байна...
      </div>
    ),
  },
);

type Initial = {
  id?: string;
  name: string;
  phone: string | null;
  city: string | null;
  district: string | null;
  khoroo: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  openTime: string | null;
  closeTime: string | null;
  openDays: Weekday[];
  isPrimary: boolean;
};

export function BranchForm({ initial }: { initial?: Initial }) {
  const isEdit = Boolean(initial?.id);
  const action = isEdit
    ? updateBranchAction.bind(null, initial!.id!)
    : createBranchAction;

  const [state, formAction, pending] = useActionState<
    BranchActionState,
    FormData
  >(action, null);

  const fe = state?.fieldErrors ?? {};
  const initialDays = initial?.openDays?.length
    ? initial.openDays
    : DEFAULT_OPEN_DAYS;
  const [days, setDays] = useState<Set<Weekday>>(new Set(initialDays));
  const [lat, setLat] = useState<number | null>(initial?.latitude ?? null);
  const [lng, setLng] = useState<number | null>(initial?.longitude ?? null);

  // Controlled — action амжилтгүй болсон үед утгууд цэвэрлэгдэхгүй
  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [district, setDistrict] = useState(initial?.district ?? "");
  const [khoroo, setKhoroo] = useState(initial?.khoroo ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [openTime, setOpenTime] = useState(initial?.openTime ?? "");
  const [closeTime, setCloseTime] = useState(initial?.closeTime ?? "");
  const [isPrimary, setIsPrimary] = useState(initial?.isPrimary ?? false);

  function onMapPick(coords: { lat: number; lng: number } | null) {
    if (!coords) {
      setLat(null);
      setLng(null);
      return;
    }
    // 6 оронгийн нарийвчлал ~10см — илүү бичих нь утгагүй
    setLat(Number(coords.lat.toFixed(6)));
    setLng(Number(coords.lng.toFixed(6)));
  }

  function onLatChange(v: string) {
    const t = v.trim().replace(",", ".");
    if (!t) return setLat(null);
    const n = Number.parseFloat(t);
    setLat(Number.isFinite(n) ? n : null);
  }
  function onLngChange(v: string) {
    const t = v.trim().replace(",", ".");
    if (!t) return setLng(null);
    const n = Number.parseFloat(t);
    setLng(Number.isFinite(n) ? n : null);
  }

  function toggleDay(value: Weekday) {
    setDays((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  const FIELD_MW = "max-w-xs";

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <FormError message={state?.message} />

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-medium text-white/50 uppercase tracking-wider">
          Үндсэн мэдээлэл
        </h2>

        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <Field label="Салбарын нэр" htmlFor="name" error={fe.name} className={FIELD_MW}>
            <input
              id="name"
              name="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`compact-input ${fe.name ? "border-red-500/50" : ""}`}
              placeholder="Жишээ: Зүүн салбар"
            />
          </Field>

          <Field label="Утас" htmlFor="phone" error={fe.phone} className={FIELD_MW}>
            <input
              id="phone"
              name="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="compact-input"
              placeholder="99000000"
            />
          </Field>
        </div>

        <label className="flex items-start gap-3 p-3 rounded-lg border border-white/[0.06] bg-white/[0.02] cursor-pointer hover:bg-white/[0.04] max-w-md">
          <input
            type="checkbox"
            name="isPrimary"
            checked={isPrimary}
            onChange={(e) => setIsPrimary(e.target.checked)}
            className="mt-0.5 accent-violet-500"
          />
          <div className="flex-1">
            <div className="text-sm font-medium text-white/90">
              Үндсэн салбар
            </div>
            <div className="text-xs text-white/40 mt-0.5">
              Анхдагчаар сонгогддог салбар.
            </div>
          </div>
        </label>
      </section>

      <section className="flex flex-col gap-3 pt-3 border-t border-white/[0.04]">
        <h2 className="text-xs font-medium text-white/50 uppercase tracking-wider">
          Хаяг
        </h2>

        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <Field label="Хот / Аймаг" htmlFor="city" error={fe.city} className={FIELD_MW}>
            <input
              id="city"
              name="city"
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="compact-input"
              placeholder="Улаанбаатар"
            />
          </Field>
          <Field label="Дүүрэг / Сум" htmlFor="district" error={fe.district} className={FIELD_MW}>
            <input
              id="district"
              name="district"
              type="text"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              className="compact-input"
              placeholder="Баянзүрх"
            />
          </Field>
          <Field label="Хороо / Баг" htmlFor="khoroo" error={fe.khoroo} className={FIELD_MW}>
            <input
              id="khoroo"
              name="khoroo"
              type="text"
              value={khoroo}
              onChange={(e) => setKhoroo(e.target.value)}
              className="compact-input"
              placeholder="6-р хороо"
            />
          </Field>
          <Field
            label="Дэлгэрэнгүй хаяг"
            htmlFor="address"
            hint="Гудамж, тоот"
            error={fe.address}
            className={FIELD_MW}
          >
            <input
              id="address"
              name="address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="compact-input"
              placeholder="Энхтайвны өргөн 25, AAA байр"
            />
          </Field>
        </div>

        <div className="flex flex-col gap-2 max-w-3xl">
          <label className="text-sm font-medium text-white/70">
            Газрын зураг дээрх байршил
          </label>
          <LocationPicker
            latitude={lat}
            longitude={lng}
            onChange={onMapPick}
          />
        </div>

        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <Field label="Latitude" htmlFor="latitude" error={fe.latitude} className={FIELD_MW}>
            <input
              id="latitude"
              name="latitude"
              type="text"
              inputMode="decimal"
              value={lat ?? ""}
              onChange={(e) => onLatChange(e.target.value)}
              className={`compact-input ${fe.latitude ? "border-red-500/50" : ""}`}
              placeholder="47.918873"
            />
          </Field>
          <Field label="Longitude" htmlFor="longitude" error={fe.longitude} className={FIELD_MW}>
            <input
              id="longitude"
              name="longitude"
              type="text"
              inputMode="decimal"
              value={lng ?? ""}
              onChange={(e) => onLngChange(e.target.value)}
              className={`compact-input ${fe.longitude ? "border-red-500/50" : ""}`}
              placeholder="106.917698"
            />
          </Field>
        </div>
      </section>

      <section className="flex flex-col gap-3 pt-3 border-t border-white/[0.04]">
        <h2 className="text-xs font-medium text-white/50 uppercase tracking-wider">
          Ажиллах хуваарь
        </h2>

        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <Field
            label="Эхлэх цаг"
            htmlFor="openTime"
            hint="HH:MM"
            error={fe.openTime}
            className={FIELD_MW}
          >
            <input
              id="openTime"
              name="openTime"
              type="time"
              value={openTime}
              onChange={(e) => setOpenTime(e.target.value)}
              className={`compact-input ${fe.openTime ? "border-red-500/50" : ""}`}
            />
          </Field>
          <Field
            label="Дуусах цаг"
            htmlFor="closeTime"
            hint="HH:MM"
            error={fe.closeTime}
            className={FIELD_MW}
          >
            <input
              id="closeTime"
              name="closeTime"
              type="time"
              value={closeTime}
              onChange={(e) => setCloseTime(e.target.value)}
              className={`compact-input ${fe.closeTime ? "border-red-500/50" : ""}`}
            />
          </Field>
        </div>

        <div>
          <label className="text-sm font-medium text-white/70 mb-2 block">
            Ажиллах өдрүүд
          </label>
          <div className="flex flex-wrap gap-2">
            {WEEK_DAYS.map((d) => {
              const active = days.has(d.value);
              return (
                <label
                  key={d.value}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer transition-colors text-sm ${
                    active
                      ? "bg-violet-600/20 text-violet-200 border-violet-500/30"
                      : "bg-white/[0.03] text-white/50 border-white/[0.06] hover:bg-white/[0.06]"
                  }`}
                >
                  <input
                    type="checkbox"
                    name="workDays"
                    value={d.value}
                    checked={active}
                    onChange={() => toggleDay(d.value)}
                    className="sr-only"
                  />
                  {d.long}
                </label>
              );
            })}
          </div>
          <p className="text-xs text-white/30 mt-2">
            Юу ч сонгохгүй бол анхдагч Даваа–Баасан ашиглагдана.
          </p>
        </div>
      </section>

      <div className="flex gap-2 pt-3 border-t border-white/[0.05]">
        <Link
          href="/dashboard/branches"
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
