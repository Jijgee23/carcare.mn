"use client";

import { useActionState, useMemo, useState } from "react";
import {
  type OrderActionState,
  createOrderAction,
  updateOrderAction,
} from "@/app/_actions/orders";
import { Field, FormError } from "@/app/_components/auth-shell";
import { DatePicker } from "@/app/_components/date-picker";
import { Btn, BtnLink, SquareAddButton } from "@/app/_components/landing-ops-ui";
import { Select } from "@/app/_components/select";
import { customerLabel } from "@/lib/customers";
import {
  DIAGNOSTIC_TYPES,
  DIAGNOSTIC_TYPE_BADGE,
  DIAGNOSTIC_TYPE_LABEL,
  type DiagnosticType,
} from "@/lib/diagnostics";
import {
  type CreatedCustomer,
  InlineCustomerForm,
} from "./inline-customer-form";
import {
  type CreatedVehicle,
  InlineVehicleForm,
} from "./inline-vehicle-form";

type Initial = {
  id?: string;
  branchId: string;
  customerId: string;
  vehicleId: string;
  assignedToId: string | null;
  scheduledAt: Date | null;
  notes: string | null;
};

type Branch = { id: string; name: string };
type Customer = { id: string; fullName: string; phone: string };
type Vehicle = {
  id: string;
  plate: string;
  make: string;
  model: string;
  customerId: string | null;
  isPostpaid?: boolean;
};
type Tech = {
  id: string;
  firstName: string;
  lastName: string;
  branchId: string | null;
  assignableBranchIds: string[];
};
type DiagTemplate = { id: string; name: string; type: DiagnosticType };

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
  diagnosticTemplates = [],
  initialDiagnosticTemplateIds = [],
  allowDiagnosticEdit = true,
  backHref = "/dashboard/orders",
  appointmentId,
}: {
  initial?: Initial;
  branches: Branch[];
  customers: Customer[];
  vehicles: Vehicle[];
  technicians: Tech[];
  diagnosticTemplates?: DiagTemplate[];
  initialDiagnosticTemplateIds?: string[];
  allowDiagnosticEdit?: boolean;
  backHref?: string;
  // Цаг захиалгаас үүсгэж буй бол — үүсгэсэн захиалгыг буцаан холбоно.
  appointmentId?: string;
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

  const [selectedDiagnostics, setSelectedDiagnostics] = useState<Set<string>>(
    () => new Set(initialDiagnosticTemplateIds),
  );
  function toggleDiagnostic(id: string) {
    setSelectedDiagnostics((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  const showDiagnostics = allowDiagnosticEdit && diagnosticTemplates.length > 0;

  const fe = state?.fieldErrors ?? {};

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
  function onCustomerChange(v: string) {
    setCustomerId(v);
    const veh = vehicles.find((x) => x.id === vehicleId);
    if (!veh || veh.customerId !== v) setVehicleId("");
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
      {state?.ok ? (
        <div className="bg-[var(--oc-ok)]/10 border border-[var(--oc-ok)]/25 rounded-lg px-3 py-2 text-sm text-[var(--oc-ok)]">
          {state.message ?? "Хадгалагдлаа."}
        </div>
      ) : null}
      <FormError message={state?.message && !state.ok ? state.message : undefined} />

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
                  return {
                    value: v.id,
                    label: v.plate,
                    hint: v.isPostpaid ? `${base} · Дараа төлбөрт` : base,
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
            id="scheduledAt"
            name="scheduledAt"
            withTime
            defaultValue={toLocalDatetimeInput(
              initial?.scheduledAt ?? (isEdit ? null : new Date()),
            )}
            error={Boolean(fe.scheduledAt)}
          />
        </Field>
      </div>

      {vehicles.find((v) => v.id === vehicleId)?.isPostpaid ? (
        <div className="rounded-lg border border-sky-500/25 bg-sky-500/[0.08] px-4 py-2.5 text-xs text-sky-300 light:text-sky-700 max-w-2xl">
          Энэ машин <strong>дараа төлбөрт</strong> нөхцөлтэй — захиалга «Дараа
          төлбөрт» түүхэнд бүртгэгдэж, төлбөрийг нэгтгэн төлнө.
        </div>
      ) : null}

      {showCustomerForm ? (
        <InlineCustomerForm
          onCreated={onCustomerCreated}
          onCancel={() => setShowCustomerForm(false)}
        />
      ) : null}

      {showVehicleForm && customerId ? (
        <InlineVehicleForm
          customerId={customerId}
          onCreated={onVehicleCreated}
          onCancel={() => setShowVehicleForm(false)}
        />
      ) : null}

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

      {showDiagnostics ? (
        <div className="max-w-2xl flex flex-col gap-2">
          {[...selectedDiagnostics].map((id) => (
            <input
              key={id}
              type="hidden"
              name="diagnosticTemplateIds"
              value={id}
            />
          ))}
          <div className="text-sm font-medium text-[var(--oc-ink2)]">Оношилгоо</div>
          <p className="text-xs text-[var(--oc-muted3)] -mt-1">
            Хийх оношилгоог товлоно (бөглөхгүй). Захиалга эхэлсний дараа бөглөнө.
          </p>
          <div className="flex flex-col gap-3 mt-1">
            {DIAGNOSTIC_TYPES.map((tp) => {
              const list = diagnosticTemplates.filter((t) => t.type === tp);
              if (list.length === 0) return null;
              return (
                <div key={tp} className="flex flex-col gap-2">
                  <span
                    className={`self-start text-[10px] px-2 py-0.5 rounded-full ${DIAGNOSTIC_TYPE_BADGE[tp]}`}
                  >
                    {DIAGNOSTIC_TYPE_LABEL[tp]}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {list.map((t) => {
                      const on = selectedDiagnostics.has(t.id);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => toggleDiagnostic(t.id)}
                          className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                            on
                              ? "bg-[var(--oc-accent)]/15 text-[var(--oc-accent)] border-[var(--oc-accent)]/40"
                              : "bg-[var(--oc-panel2)] text-[var(--oc-muted2)] border-[var(--oc-line)] hover:border-[var(--oc-line2)]"
                          }`}
                        >
                          {on ? "✓ " : "+ "}
                          {t.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="flex gap-2 pt-3 border-t border-[var(--oc-line2)]">
        <BtnLink href={backHref} variant="ghost">
          ← Буцах
        </BtnLink>
        <Btn type="submit" disabled={pending}>
          {pending ? "..." : isEdit ? "Хадгалах" : "Захиалга үүсгэх"}
        </Btn>
      </div>
    </form>
  );
}
