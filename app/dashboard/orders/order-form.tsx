"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import {
  type OrderActionState,
  createOrderAction,
  updateOrderAction,
} from "@/app/_actions/orders";
import { Field, FormError } from "@/app/_components/auth-shell";
import { DatePicker } from "@/app/_components/date-picker";
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
};
type Tech = { id: string; firstName: string; lastName: string };
type DiagTemplate = { id: string; name: string; type: DiagnosticType };

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

  const filteredVehicles = useMemo(() => {
    if (!customerId) return [];
    return vehicles.filter((v) => v.customerId === customerId);
  }, [vehicles, customerId]);

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
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state?.ok ? (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 text-sm text-emerald-300">
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
            onChange={setBranchId}
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
            options={technicians.map((t) => ({
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
                onChange={(v) => {
                  setCustomerId(v);
                  setVehicleId("");
                }}
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
            <button
              type="button"
              onClick={() => setShowCustomerForm((v) => !v)}
              data-stop-row-click
              className="shrink-0 px-2.5 rounded-lg border border-violet-500/30 bg-violet-500/10 hover:bg-violet-500/20 text-violet-200 text-xs font-medium transition-colors"
              title="Шинэ үйлчлүүлэгч нэмэх"
            >
              {showCustomerForm ? "✕" : "+"}
            </button>
          </div>
        </Field>

        <Field
          label="Машин"
          htmlFor="vehicleId"
          hint={
            !customerId
              ? "Эхлээд үйлчлүүлэгч"
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
                onChange={setVehicleId}
                disabled={!customerId}
                error={fe.vehicleId}
                options={filteredVehicles.map((v) => ({
                  value: v.id,
                  label: v.plate,
                  hint: `${v.make} ${v.model}`,
                }))}
              />
            </div>
            <button
              type="button"
              disabled={!customerId}
              onClick={() => setShowVehicleForm((v) => !v)}
              data-stop-row-click
              className="shrink-0 px-2.5 rounded-lg border border-violet-500/30 bg-violet-500/10 hover:bg-violet-500/20 text-violet-200 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={
                customerId
                  ? "Шинэ машин нэмэх"
                  : "Эхлээд үйлчлүүлэгчээ сонгоно уу"
              }
            >
              {showVehicleForm ? "✕" : "+"}
            </button>
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
            defaultValue={toLocalDatetimeInput(initial?.scheduledAt ?? null)}
            error={Boolean(fe.scheduledAt)}
          />
        </Field>
      </div>

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
          className="compact-input resize-y"
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
          <div className="text-sm font-medium text-white/80">Оношилгоо</div>
          <p className="text-xs text-white/40 -mt-1">
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
                              ? "bg-violet-600/30 text-violet-200 border-violet-500/40"
                              : "bg-white/[0.04] text-white/60 border-white/10 hover:border-white/20"
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
          {pending ? "..." : isEdit ? "Хадгалах" : "Захиалга үүсгэх"}
        </button>
      </div>
    </form>
  );
}
