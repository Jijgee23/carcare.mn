"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { quickCreateCustomerAction, quickCreateVehicleAction } from "@/app/_actions/quick-create";
import { Field, FormError } from "@/app/_components/auth-shell";
import {
  CreateCustomerModal,
  type CreatedCustomer,
} from "@/app/dashboard/customers/create-customer-modal";
import { Btn, PlusIcon, SquareAddButton } from "@/app/_components/landing-ops-ui";
import { Modal } from "@/app/_components/modal";
import { Select } from "@/app/_components/select";
import { useToast } from "@/app/_components/toast";
import { useRouter } from "next/navigation";
import { customerLabel } from "@/lib/customers";
import {
  type HurVehicle,
  normalizeWheelPosition,
  ownerKindFromRegnum,
} from "@/lib/hur_service";

// Монгол улсын дугаарын хэлбэр: 4 цифр + 3 үсэг (Кирилл эсвэл Латин) —
// vehicle-form.tsx-тэй ижил (харах: тэнд тайлбарласан шалтгаан).
const PLATE_PATTERN = /^\d{4}[А-ЯЁӨҮA-Z]{3}$/;
const PLATE_FETCH_DEBOUNCE_MS = 400;

type Customer = { id: string; fullName: string; phone: string };

export type CreatedVehicle = {
  id: string;
  plate: string;
  make: string;
  model: string;
  customerId: string | null;
  isPostpaid: boolean;
};

export function CreateVehicleButton({
  label,
  customers,
}: {
  label: string;
  customers: Customer[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Btn type="button" onClick={() => setOpen(true)}>
        <PlusIcon />
        {label}
      </Btn>
      <Modal open={open} onClose={() => setOpen(false)} title="Машин бүртгэх">
        <CreateVehicleForm
          customers={customers}
          onCreated={() => {
            router.refresh();
            setOpen(false);
          }}
        />
      </Modal>
    </>
  );
}

/**
 * Өөр modal-ийн дотор (жишээ нь захиалгын форм дахь "Шинэ машин нэмэх")
 * shell-гүйгээр ашиглах хувилбар — order-form.tsx-д аль хэдийн сонгогдсон
 * үйлчлүүлэгчийг `defaultCustomerId`-аар өгч болно.
 */
export function CreateVehicleModal({
  open,
  onClose,
  onCreated,
  customers,
  defaultCustomerId,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (vehicle: CreatedVehicle) => void;
  customers: Customer[];
  defaultCustomerId?: string;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Машин бүртгэх">
      <CreateVehicleForm
        customers={customers}
        defaultCustomerId={defaultCustomerId}
        onCreated={onCreated}
      />
    </Modal>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="text-[var(--oc-muted3)]">{label}</span>
      <span className="text-[var(--oc-ink2)] text-right">{value}</span>
    </div>
  );
}

function CreateVehicleForm({
  customers,
  defaultCustomerId,
  onCreated,
}: {
  customers: Customer[];
  defaultCustomerId?: string;
  onCreated: (vehicle: CreatedVehicle) => void;
}) {
  const toast = useToast();
  const [plate, setPlate] = useState("");
  const [customerId, setCustomerId] = useState(defaultCustomerId ?? "");
  const [customersList, setCustomersList] = useState(customers);

  const [hurLoading, setHurLoading] = useState(false);
  const [hurError, setHurError] = useState<string | null>(null);
  const [hurInfo, setHurInfo] = useState<HurVehicle | null>(null);
  const [hurSource, setHurSource] = useState<"global" | "hur">("hur");
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const lastFetchedRef = useRef<string | null>(null);

  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [registeringOwner, setRegisteringOwner] = useState(false);

  const [pending, setPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  function onCustomerCreated(c: CreatedCustomer) {
    setCustomersList((prev) => [c, ...prev]);
    setCustomerId(c.id);
    setShowCustomerModal(false);
  }

  // HUR-аас эзэмшигчийн нэр/утас аль хэдийн ирсэн үед шинэ маягт нээхгүйгээр
  // шууд бүртгэнэ ("шууд хүсэлт явуулаад амжилттай бол бөглөх").
  async function registerOwnerFromHur() {
    if (!hurInfo?.owner?.phone) return;
    setRegisteringOwner(true);
    try {
      const res = await quickCreateCustomerAction({
        fullName: `${hurInfo.owner.lastName ?? ""} ${hurInfo.owner.firstName ?? ""}`.trim(),
        phone: hurInfo.owner.phone,
      });
      if (res.ok && res.customer) {
        setCustomersList((prev) => [res.customer!, ...prev]);
        setCustomerId(res.customer.id);
      } else {
        toast.error(
          "Эзэмшигч бүртгэж чадсангүй",
          res.message ?? Object.values(res.fieldErrors ?? {})[0],
        );
      }
    } catch (e) {
      toast.error("Алдаа гарлаа", e instanceof Error ? e.message : undefined);
    } finally {
      setRegisteringOwner(false);
    }
  }

  const trimmedPlate = plate.trim().toUpperCase();
  const isValidPlate = PLATE_PATTERN.test(trimmedPlate);
  const showFormatError = trimmedPlate.length > 0 && !isValidPlate;

  function matchCustomerByPhone(phone: string | null): string | null {
    if (!phone) return null;
    const normalized = phone.replace(/\D/g, "");
    if (!normalized) return null;
    const found = customersList.find((c) => c.phone.replace(/\D/g, "") === normalized);
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
      setAlreadyRegistered(false);
      try {
        const res = await fetch(
          `/api/hur/lookup?plate=${encodeURIComponent(trimmedPlate)}`,
          { signal: controller.signal },
        );
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error ?? "HUR-аас мэдээлэл татаж чадсангүй.");
        }
        const vehicle = data.vehicle as HurVehicle;
        setHurInfo(vehicle);
        setHurSource(data.source === "global" ? "global" : "hur");
        setAlreadyRegistered(Boolean(data.registered));
        if (!customerId && vehicle.owner?.phone) {
          const matched = matchCustomerByPhone(vehicle.owner.phone);
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

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!hurInfo) return;
    setPending(true);
    setMessage(null);
    setFieldErrors({});
    try {
      const res = await quickCreateVehicleAction({
        plate: trimmedPlate,
        vin: hurInfo.vin || null,
        make: hurInfo.make ?? "",
        model: hurInfo.model ?? "",
        year: hurInfo.year ?? null,
        fuelType: hurInfo.fuelType ?? null,
        wheelPosition: hurInfo.wheelPosition ?? null,
        customerId,
      });
      if (res.ok && res.vehicle) {
        onCreated(res.vehicle);
        return;
      }
      setFieldErrors(res.fieldErrors ?? {});
      setMessage(res.message ?? null);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Алдаа гарлаа.");
    } finally {
      setPending(false);
    }
  }

  const normalizedWheel = hurInfo ? normalizeWheelPosition(hurInfo.wheelPosition) : null;
  const ownerKind = hurInfo?.owner ? ownerKindFromRegnum(hurInfo.owner.regnum) : null;
  const canSubmit = Boolean(hurInfo) && !alreadyRegistered && Boolean(customerId);

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <FormError message={message ?? undefined} />

      <Field
        label="Улсын дугаар"
        htmlFor="cv-plate"
        hint={
          hurLoading
            ? "HUR-аас татаж байна..."
            : isValidPlate
              ? undefined
              : "Жишээ: 1234УБА"
        }
        error={
          showFormatError ? "Дугаар буруу хэлбэртэй." : (hurError ?? fieldErrors.plate)
        }
      >
        <div className="relative">
          <input
            id="cv-plate"
            type="text"
            required
            maxLength={7}
            value={plate}
            onChange={(e) => setPlate(e.target.value.toUpperCase())}
            className={`auth-input uppercase pr-10 font-plex-mono ${
              showFormatError || fieldErrors.plate
                ? "border-red-500/50"
                : isValidPlate && hurInfo
                  ? "border-emerald-500/40"
                  : ""
            }`}
            placeholder="1234УБА"
            autoFocus
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            {hurLoading ? (
              <svg className="w-4 h-4 animate-spin text-[var(--oc-accent)]" viewBox="0 0 24 24" fill="none">
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

      {alreadyRegistered ? (
        <div className="rounded-[10px] border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-400 light:bg-amber-100 light:border-amber-300 light:text-amber-700">
          Энэ улсын дугаартай машин танай бүртгэлд аль хэдийн байна.{" "}
          <Link
            href={`/dashboard/vehicles?q=${encodeURIComponent(trimmedPlate)}`}
            className="underline hover:no-underline"
          >
            Бүртгэлээс харах →
          </Link>
        </div>
      ) : null}

      {hurInfo ? (
        <div className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel2)] px-4 py-3 text-xs">
          <div className="text-[10.5px] uppercase tracking-[0.08em] text-[var(--oc-muted3)] mb-1.5">
            {hurSource === "global" ? "Системийн бүртгэлээс" : "HUR-аас татсан мэдээлэл"}
          </div>
          <div className="divide-y divide-[var(--oc-line)]">
            <InfoRow label="Марк" value={hurInfo.make} />
            <InfoRow label="Модель" value={hurInfo.model} />
            <InfoRow label="VIN" value={hurInfo.vin} />
            <InfoRow label="Үйлдвэрлэгдсэн он" value={hurInfo.year ? String(hurInfo.year) : null} />
            <InfoRow label="Импортлогдсон" value={hurInfo.importDate} />
            {detailsExpanded ? (
              <>
                <InfoRow label="Өнгө" value={hurInfo.color} />
                <InfoRow label="Багтаамж" value={hurInfo.capacity ? `${hurInfo.capacity} см³` : null} />
                <InfoRow label="Түлшний төрөл" value={hurInfo.fuelType} />
                <InfoRow label="Ангилал" value={hurInfo.className} />
                <InfoRow label="Зориулалт" value={hurInfo.purpose} />
                <InfoRow label="Үйлдвэрлэгдсэн улс" value={hurInfo.country} />
                <InfoRow label="Жолоо" value={normalizedWheel} />
              </>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setDetailsExpanded((v) => !v)}
            className="mt-1.5 text-[var(--oc-accent)] hover:text-[var(--oc-accent-hi)] transition-colors"
          >
            {detailsExpanded ? "← Хураангуй" : "Дэлгэрэнгүй →"}
          </button>

          {hurInfo.owner ? (
            <div className="mt-2 pt-2 border-t border-[var(--oc-line)]">
              <span className="text-[var(--oc-muted3)]">Эзэмшигч (HUR):</span>{" "}
              <span className="text-[var(--oc-ink2)]">
                {hurInfo.owner.lastName ?? ""} {hurInfo.owner.firstName ?? "—"}
                {ownerKind ? ` · ${ownerKind}` : ""}
                {hurInfo.owner.phone ? ` · ${hurInfo.owner.phone}` : ""}
              </span>
              {!customerId && hurInfo.owner.phone ? (
                <button
                  type="button"
                  onClick={registerOwnerFromHur}
                  disabled={registeringOwner}
                  className="ml-2 text-[var(--oc-accent)] hover:text-[var(--oc-accent-hi)] disabled:opacity-50"
                >
                  {registeringOwner ? "Бүртгэж..." : "→ Эзэмшигчээр бүртгэх"}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <Field label="Эзэмшигч" htmlFor="cv-customerId" error={fieldErrors.customerId}>
        <div className="flex items-center gap-2">
          <Select
            id="cv-customerId"
            name="customerId"
            value={customerId}
            onChange={setCustomerId}
            error={fieldErrors.customerId}
            placeholder={customersList.length === 0 ? "— Бүртгэгдээгүй —" : "— Сонгох —"}
            options={customersList.map((c) => ({
              value: c.id,
              label: customerLabel(c),
              hint: c.phone,
            }))}
          />
          <SquareAddButton
            type="button"
            onClick={() => setShowCustomerModal(true)}
            title="Шинэ үйлчлүүлэгч бүртгэх"
          />
        </div>
      </Field>

      <div className="flex justify-end">
        <Btn type="submit" disabled={pending || !canSubmit}>
          {pending ? "Бүртгэж..." : "Машин бүртгэх"}
        </Btn>
      </div>

      <CreateCustomerModal
        open={showCustomerModal}
        onClose={() => setShowCustomerModal(false)}
        onCreated={onCustomerCreated}
      />
    </form>
  );
}
