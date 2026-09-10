"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import {
  type OrderActionState,
  createOrderAction,
  updateOrderAction,
} from "@/app/_actions/orders";
import {
  getBranchDaySchedulePreview,
  type BranchDaySchedulePreview,
} from "@/app/_actions/schedule-preview";
import { Field, FormError } from "@/app/_components/auth-shell";
import { DatePicker, todayStr } from "@/app/_components/date-picker";
import { Btn, BtnLink, SquareAddButton } from "@/app/_components/landing-ops-ui";
import { Select } from "@/app/_components/select";
import { SchedulePreviewGrid } from "@/app/_components/schedule-preview-grid";
import { customerLabel } from "@/lib/customers";
import { DurationHmInput } from "@/app/dashboard/services/duration-input";
import {
  CreateCustomerModal,
  type CreatedCustomer,
} from "@/app/dashboard/customers/create-customer-modal";
import {
  CreateVehicleModal,
  type CreatedVehicle,
} from "@/app/dashboard/vehicles/create-vehicle-modal";

type Initial = {
  id?: string;
  branchId: string;
  customerId: string;
  vehicleId: string;
  assignedToId: string | null;
  scheduledAt: Date | null;
  notes: string | null;
};

type Branch = { id: string; name: string; slotMinutes?: number | null };
type Customer = { id: string; fullName: string; phone: string };
type Vehicle = {
  id: string;
  plate: string;
  make: string;
  model: string;
  customerId: string | null;
  isPostpaid?: boolean;
  isAccountVehicle?: boolean;
};
type Tech = {
  id: string;
  firstName: string;
  lastName: string;
  branchId: string | null;
  assignableBranchIds: string[];
};
export const ORDER_FORM_ID = "order-form";

const FIELD_MW = "max-w-xs";

function toLocalDatetimeInput(d: Date | null): string {
  if (!d) return "";
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export function OrderForm({
  initial,
  branches,
  customers: initialCustomers,
  vehicles: initialVehicles,
  technicians,
  bookingCategories = [],
  bookingDurationMinutes = null,
  backHref = "/dashboard/orders",
  appointmentId,
  next,
}: {
  initial?: Initial;
  branches: Branch[];
  customers: Customer[];
  vehicles: Vehicle[];
  technicians: Tech[];
  bookingCategories?: Array<{ id: string; name: string }>;
  bookingDurationMinutes?: number | null;
  backHref?: string;
  // Цаг захиалгаас үүсгэж буй бол — үүсгэсэн захиалгыг буцаан холбоно.
  appointmentId?: string;
  // Амжилттай хадгалсны дараа буцах зам (жишээ нь: хуваарийн хуудас) —
  // ирээгүй бол одоогийн адил үүсгэсэн захиалга руугаа орно.
  next?: string;
}) {
  const isEdit = Boolean(initial?.id);
  const action = isEdit
    ? updateOrderAction.bind(null, initial!.id!)
    : createOrderAction;

  const [state, formAction, pending] = useActionState<
    OrderActionState,
    FormData
  >(action, null);

  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [vehicles, setVehicles] = useState<Vehicle[]>(initialVehicles);

  const [branchId, setBranchId] = useState(initial?.branchId ?? "");
  const [assignedToId, setAssignedToId] = useState(initial?.assignedToId ?? "");
  const [customerId, setCustomerId] = useState(initial?.customerId ?? "");
  const [vehicleId, setVehicleId] = useState(initial?.vehicleId ?? "");

  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [showVehicleForm, setShowVehicleForm] = useState(false);

  // Товлосон огноог өөр ажилтай давхцуулж хадгалахаас өмнө сервэрийн
  // анхааруулгыг харуулж, ЗӨВХӨН дараагийн (дахин) дарахад confirmed=true
  // явуулна — reviseExpectedFinishAction/status-controls.tsx-ийн адил
  // зарчим. Render-ийн үед нөхцөлт setState (useEffect биш) ашиглав.
  const [scheduleConfirmArmed, setScheduleConfirmArmed] = useState(false);
  const [prevState, setPrevState] = useState<OrderActionState>(null);
  if (state !== prevState) {
    setPrevState(state);
    setScheduleConfirmArmed(Boolean(state?.fieldErrors?.confirmNeeded));
  }

  const fe = state?.fieldErrors ?? {};

  // Шинэ захиалгад "одоо" гэсэн анхны утгыг зөвхөн client дээр mount-ын дараа
  // тавина (server/client hydration-ий хооронд минут шилжвэл текст зөрж,
  // hydration mismatch өгдөг байсан тул render дундаа `new Date()` дуудахгүй).
  const [autoScheduledAt, setAutoScheduledAt] = useState<Date | null>(
    () => initial?.scheduledAt ?? null,
  );
  // Товлосон огноо/цаг + ойролцоо хугацааг (аль аль нь uncontrolled input,
  // native form submit-д хэвээр ашиглагдана) зөвхөн доорх "ghost" урьдчилсан
  // харагдацад зориулж ажиглана — DatePicker/DurationHmInput-ийн жинхэнэ
  // утгыг удирдахгүй, зөвхөн нэмэлт onChange.
  const [scheduledAtLocal, setScheduledAtLocal] = useState(() =>
    toLocalDatetimeInput(initial?.scheduledAt ?? null),
  );
  const [durationMinutes, setDurationMinutes] = useState<number | null>(null);
  useEffect(() => {
    if (!isEdit && !initial?.scheduledAt) {
      const now = new Date();
      setAutoScheduledAt(now);
      setScheduledAtLocal(toLocalDatetimeInput(now));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scheduledDateKey = scheduledAtLocal.slice(0, 10);
  const [preview, setPreview] = useState<BranchDaySchedulePreview | null>(null);
  const previewReqIdRef = useRef(0);
  useEffect(() => {
    // Салбар/огноо хоосон бол зүгээр татахгүй — доорх render-ийн нөхцөл
    // (`branchId && scheduledDateKey && preview`) аль хэдийн preview-г
    // харуулахгүй тул энд `setPreview(null)` дуудаж дахин render үүсгэх
    // шаардлагагүй.
    if (!branchId || !scheduledDateKey) return;
    const id = ++previewReqIdRef.current;
    getBranchDaySchedulePreview(branchId, scheduledDateKey)
      .then((res) => {
        if (id === previewReqIdRef.current) setPreview(res);
      })
      .catch(() => {
        if (id === previewReqIdRef.current) setPreview(null);
      });
  }, [branchId, scheduledDateKey]);

  // Одоо бөглөж буй захиалгын "ghost" блок — сонгосон цаг байхгүй бол алга.
  // Цаг захиалгаас үүссэн бол booking-ийн category-уудаар тооцсон immutable
  // хугацааны snapshot-ыг ашиглана. Шууд walk-in захиалгад хугацаа хоосон
  // байвал сервер талын default-той адил 30 минутын ghost харуулна.
  const ghost = useMemo(() => {
    if (!scheduledAtLocal) return null;
    const startMs = new Date(scheduledAtLocal).getTime();
    if (!Number.isFinite(startMs)) return null;
    const minutes =
      durationMinutes && durationMinutes > 0
        ? durationMinutes
        : bookingDurationMinutes && bookingDurationMinutes > 0
          ? bookingDurationMinutes
          : branches.find((branch) => branch.id === branchId)?.slotMinutes ?? 30;
    return { startMs, endMs: startMs + minutes * 60000, label: "Энэ захиалга" };
  }, [scheduledAtLocal, durationMinutes, bookingDurationMinutes, branches, branchId]);

  const customerById = useMemo(
    () => new Map(customers.map((c) => [c.id, c])),
    [customers],
  );

  // Үйлчлүүлэгч сонгоогүй бол эзэмшигчтэй бүх машиныг харуулна (машинаа түрүүлж
  // сонгож болно — эзэмшигч нь автоматаар бичигдэнэ). Эзэмшигчгүй машиныг
  // харуулахгүй — сервер захиалгыг эзэмшигчтэй нь тааруулахыг шаарддаг.
  // Үйлчлүүлэгч сонгосон бол зөвхөн түүний машинууд.
  const filteredVehicles = useMemo(() => {
    if (!customerId) return vehicles.filter((v) => v.customerId);
    return vehicles.filter((v) => v.customerId === customerId);
  }, [vehicles, customerId]);

  // Хариуцах мастерыг сонгосон салбараар шүүнэ: тухайн салбарын ажилтан +
  // салбар харьяалалгүй (branchId=null, ж: эзэн/удирдлага бүх салбарыг
  // хариуцдаг) хүмүүс + тухайн салбарыг нэмэлтээр ажилладаг гэж тэмдэглэсэн
  // хүмүүс (олон салбарт дамжиж ажилладаг мастер). Салбар сонгоогүй бол
  // бүгдийг харуулна.
  function isTechAssignableAt(tech: Tech, branch: string): boolean {
    return (
      !tech.branchId ||
      tech.branchId === branch ||
      tech.assignableBranchIds.includes(branch)
    );
  }

  const filteredTechnicians = useMemo(() => {
    if (!branchId) return technicians;
    return technicians.filter((t) => isTechAssignableAt(t, branchId));
  }, [technicians, branchId]);

  // Салбар солиход одоо сонгогдсон мастер шинэ салбарт хамаарахгүй бол цэвэрлэнэ.
  function onBranchChange(v: string) {
    setBranchId(v);
    const tech = technicians.find((t) => t.id === assignedToId);
    if (tech && !isTechAssignableAt(tech, v)) {
      setAssignedToId("");
    }
  }

  // Машин сонгоход эзэмшигчийг нь автоматаар үйлчлүүлэгч болгож тавина.
  function onVehicleChange(v: string) {
    setVehicleId(v);
    const veh = vehicles.find((x) => x.id === v);
    if (veh?.customerId && veh.customerId !== customerId) {
      setCustomerId(veh.customerId);
    }
  }

  // Үйлчлүүлэгч солиход — сонгосон машин нь шинэ эзэмшигчийнх биш бол цэвэрлэнэ.
  // Тухайн үйлчлүүлэгч яг ганц машинтай бол уг машиныг автоматаар сонгоно.
  function onCustomerChange(v: string) {
    setCustomerId(v);
    const veh = vehicles.find((x) => x.id === vehicleId);
    if (veh && veh.customerId === v) return;
    const owned = vehicles.filter((x) => x.customerId === v);
    setVehicleId(owned.length === 1 ? owned[0].id : "");
  }

  function onCustomerCreated(c: CreatedCustomer) {
    setCustomers((prev) => [c, ...prev]);
    setCustomerId(c.id);
    setVehicleId("");
    setShowCustomerForm(false);
  }

  function onVehicleCreated(v: CreatedVehicle) {
    setVehicles((prev) => [v, ...prev]);
    setVehicleId(v.id);
    setShowVehicleForm(false);
  }

  return (
    <form id={ORDER_FORM_ID} action={formAction} className="flex flex-col gap-4" noValidate>
      {appointmentId && !isEdit ? (
        <input type="hidden" name="appointmentId" value={appointmentId} />
      ) : null}
      {next && !isEdit ? <input type="hidden" name="next" value={next} /> : null}
      <input
        type="hidden"
        name="confirmed"
        value={scheduleConfirmArmed ? "true" : ""}
      />
      {state?.ok ? (
        <div className="bg-[var(--oc-ok)]/10 border border-[var(--oc-ok)]/25 rounded-lg px-3 py-2 text-sm text-[var(--oc-ok)]">
          {state.message ?? "Хадгалагдлаа."}
        </div>
      ) : null}
      <FormError message={state?.message && !state.ok ? state.message : undefined} />

      {/* Тухайн өдрийн бодит хуваарь — календарын Өдөр харагдацтай адил
          дээд хэсэгт, бүтэн өргөнөөр. */}
      {branchId && scheduledDateKey && preview ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-[var(--oc-ink2)]">Өдрийн хуваарь</span>
          <SchedulePreviewGrid
            rows={preview.rows}
            axisStartMs={preview.axisStartMs}
            axisEndMs={preview.axisEndMs}
            ghost={ghost}
          />
        </div>
      ) : null}

      {bookingCategories.length > 0 ? (
        <div className="rounded-lg border border-violet-500/25 bg-violet-500/[0.07] px-4 py-3 max-w-3xl">
          <div className="text-xs font-medium text-violet-200 light:text-violet-800">
            Захиалгаар сонгосон ангилал
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {bookingCategories.map((category) => (
              <span
                key={category.id}
                className="rounded-full border border-violet-400/25 bg-violet-400/10 px-2.5 py-1 text-xs text-violet-100 light:text-violet-800"
              >
                {category.name}
              </span>
            ))}
          </div>
          <p className="mt-2 text-xs text-[var(--oc-muted3)]">
            Энэ нь хэрэглэгчийн хүсэлтийн ангилал. Бодит ажил, сэлбэг, оношилгоог доороос нэмж өөрчилнө үү.
          </p>
        </div>
      ) : null}

      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <Field label="Салбар" htmlFor="branchId" error={fe.branchId} className={FIELD_MW}>
          <Select
            id="branchId"
            name="branchId"
            required
            value={branchId}
            onChange={onBranchChange}
            error={fe.branchId}
            options={branches.map((b) => ({ value: b.id, label: b.name }))}
            disabled={branches.length <= 1}
          />
        </Field>

        <Field
          label="Хариуцах мастер"
          htmlFor="assignedToId"
          hint="заавал биш"
          error={fe.assignedToId}
          className={FIELD_MW}
        >
          <Select
            id="assignedToId"
            name="assignedToId"
            value={assignedToId}
            onChange={setAssignedToId}
            error={fe.assignedToId}
            options={filteredTechnicians.map((t) => ({
              value: t.id,
              label: `${t.lastName} ${t.firstName}`,
            }))}
          />
        </Field>

        <Field label="Үйлчлүүлэгч" htmlFor="customerId" error={fe.customerId} className={FIELD_MW}>
          <div className="flex gap-2">
            <div className="flex-1 min-w-0">
              <Select
                id="customerId"
                name="customerId"
                required
                value={customerId}
                onChange={onCustomerChange}
                error={fe.customerId}
                placeholder={
                  customers.length === 0 ? "— Бүртгэгдээгүй —" : "— Сонгох —"
                }
                options={customers.map((c) => ({
                  value: c.id,
                  label: customerLabel(c),
                  hint: c.phone,
                }))}
              />
            </div>
            <SquareAddButton
              active={showCustomerForm}
              onClick={() => setShowCustomerForm((v) => !v)}
              data-stop-row-click
              title="Шинэ үйлчлүүлэгч нэмэх"
            />
          </div>
        </Field>

        <Field
          label="Машин"
          htmlFor="vehicleId"
          hint={
            !customerId
              ? "Сонгоход эзэмшигч автоматаар бичигдэнэ"
              : filteredVehicles.length === 0
                ? "Машин бүртгэгдээгүй"
                : undefined
          }
          error={fe.vehicleId}
          className={FIELD_MW}
        >
          <div className="flex gap-2">
            <div className="flex-1 min-w-0">
              <Select
                id="vehicleId"
                name="vehicleId"
                required
                value={vehicleId}
                onChange={onVehicleChange}
                error={fe.vehicleId}
                options={filteredVehicles.map((v) => {
                  const owner = v.customerId
                    ? customerById.get(v.customerId)
                    : null;
                  const base =
                    !customerId && owner
                      ? `${v.make} ${v.model} · ${customerLabel(owner)}`
                      : `${v.make} ${v.model}`;
                  const hint = v.isAccountVehicle
                    ? `${base} · Хэрэглэгчийн бүртгэлээс — энэ хуудастай холбоно`
                    : v.isPostpaid
                      ? `${base} · Дараа төлбөрт`
                      : base;
                  return {
                    value: v.id,
                    label: v.plate,
                    hint,
                  };
                })}
              />
            </div>
            <SquareAddButton
              active={showVehicleForm}
              disabled={!customerId}
              onClick={() => setShowVehicleForm((v) => !v)}
              data-stop-row-click
              title={
                customerId
                  ? "Шинэ машин нэмэх"
                  : "Эхлээд үйлчлүүлэгчээ сонгоно уу"
              }
            />
          </div>
        </Field>

        <Field
          label="Товлосон огноо"
          htmlFor="scheduledAt"
          hint="заавал биш"
          error={fe.scheduledAt}
          className={FIELD_MW}
        >
          <DatePicker
            key={autoScheduledAt ? "seeded" : "empty"}
            id="scheduledAt"
            name="scheduledAt"
            withTime
            min={todayStr()}
            defaultValue={toLocalDatetimeInput(autoScheduledAt)}
            onChange={(v) => {
              setScheduleConfirmArmed(false);
              setScheduledAtLocal(v);
            }}
            error={Boolean(fe.scheduledAt)}
          />
        </Field>

        {!isEdit && !appointmentId ? (
          // Цаг захиалгаас үүссэн бол хугацааны тооцоолол автоматаар удамшина
          // (D-041 маягийн зарчим) — энд зөвхөн шууд ирсэн (walk-in) захиалгад
          // л ойролцоо хугацааг гараар оруулна. Хадгалагдсаны дараа энэ утга
          // өөрчлөгддөггүй (immutable анхны тооцоолол), тул засах маягтад алга.
          <Field
            label="Ойролцоо хугацаа"
            htmlFor="durationHours"
            hint="заавал биш"
            error={fe.durationMinutes}
            className={FIELD_MW}
          >
            <DurationHmInput
              defaultMinutes={null}
              invalid={Boolean(fe.durationMinutes)}
              onChange={setDurationMinutes}
            />
          </Field>
        ) : null}
      </div>

      {vehicles.find((v) => v.id === vehicleId)?.isPostpaid ? (
        <div className="rounded-lg border border-sky-500/25 bg-sky-500/[0.08] px-4 py-2.5 text-xs text-sky-300 light:text-sky-700 max-w-2xl">
          Энэ машин <strong>дараа төлбөрт</strong> нөхцөлтэй — засварын хуудас «Дараа
          төлбөрт» түүхэнд бүртгэгдэж, төлбөрийг нэгтгэн төлнө.
        </div>
      ) : null}

      <CreateCustomerModal
        open={showCustomerForm}
        onClose={() => setShowCustomerForm(false)}
        onCreated={onCustomerCreated}
      />

      <CreateVehicleModal
        open={showVehicleForm}
        onClose={() => setShowVehicleForm(false)}
        onCreated={onVehicleCreated}
        customers={customers}
        defaultCustomerId={customerId}
      />

      <Field label="Тэмдэглэл" htmlFor="notes" hint="заавал биш" error={fe.notes} className="max-w-2xl">
        <textarea
          id="notes"
          name="notes"
          rows={2}
          defaultValue={initial?.notes ?? ""}
          className="auth-input resize-y"
          placeholder="Гомдол, тусгай хүсэлт..."
        />
      </Field>

      <div className="flex gap-2 pt-3 border-t border-[var(--oc-line2)]">
        <BtnLink href={backHref} variant="ghost">
          ← Буцах
        </BtnLink>
        <Btn type="submit" disabled={pending}>
          {pending
            ? "..."
            : scheduleConfirmArmed
              ? "Тийм, үргэлжлүүлэх"
              : isEdit
                ? "Хадгалах"
                : "Засварын хуудас үүсгэх"}
        </Btn>
      </div>
    </form>
  );
}
