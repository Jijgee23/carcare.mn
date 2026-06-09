"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  type AppointmentActionState,
  registerAppointmentByStaff,
} from "@/app/_actions/appointments";
import { Field, FormError } from "@/app/_components/auth-shell";
import { BranchTimePicker } from "@/app/_components/branch-time-picker";
import { Select } from "@/app/_components/select";
import {
  type CreatedCustomer,
  InlineCustomerForm,
} from "@/app/dashboard/orders/inline-customer-form";
import type { Weekday } from "@/lib/branches";
import { customerLabel } from "@/lib/customers";

type Branch = { id: string; name: string; openWeekdays: Weekday[] };
type Customer = { id: string; fullName: string; phone: string };

export function AppointmentForm({
  branches,
  customers: initialCustomers,
  defaultBranchId,
}: {
  branches: Branch[];
  customers: Customer[];
  defaultBranchId?: string;
}) {
  const [state, formAction, pending] = useActionState<
    AppointmentActionState,
    FormData
  >(registerAppointmentByStaff, null);

  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [branchId, setBranchId] = useState(defaultBranchId ?? "");
  const [customerId, setCustomerId] = useState("");
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [selectedIso, setSelectedIso] = useState("");

  const fe = state?.fieldErrors ?? {};
  const selectedBranch = branches.find((b) => b.id === branchId);

  function onBranchChange(v: string) {
    setBranchId(v);
    setSelectedIso("");
  }

  function onCustomerCreated(c: CreatedCustomer) {
    setCustomers((prev) => [c, ...prev]);
    setCustomerId(c.id);
    setShowCustomerForm(false);
  }

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <FormError message={state?.message && !state.ok ? state.message : undefined} />
      <input type="hidden" name="requestedAt" value={selectedIso} />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 items-start">
        {/* Зүүн багана: салбар, үйлчлүүлэгч, тэмдэглэл */}
        <div className="flex flex-col gap-4">
          <Field label="Салбар" htmlFor="branchId" error={fe.branchId}>
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

          <Field label="Үйлчлүүлэгч" htmlFor="customerId" error={fe.customerId}>
            <div className="flex gap-2">
              <div className="flex-1 min-w-0">
                <Select
                  id="customerId"
                  name="customerId"
                  required
                  value={customerId}
                  onChange={setCustomerId}
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
                className="shrink-0 px-2.5 rounded-lg border border-violet-500/30 bg-violet-500/10 hover:bg-violet-500/20 text-violet-200 text-xs font-medium transition-colors"
                title="Шинэ үйлчлүүлэгч нэмэх"
              >
                {showCustomerForm ? "✕" : "+"}
              </button>
            </div>
          </Field>

          {showCustomerForm ? (
            <InlineCustomerForm
              onCreated={onCustomerCreated}
              onCancel={() => setShowCustomerForm(false)}
            />
          ) : null}

          <Field label="Тэмдэглэл" htmlFor="note" hint="заавал биш">
            <textarea
              id="note"
              name="note"
              rows={2}
              className="compact-input resize-y"
              placeholder="Гомдол, тусгай хүсэлт..."
            />
          </Field>
        </div>

        {/* Дунд + баруун багана: календар | боломжит цаг */}
        <BranchTimePicker
          key={branchId || "none"}
          branchId={branchId}
          openWeekdays={selectedBranch?.openWeekdays}
          value={selectedIso}
          onChange={setSelectedIso}
          error={fe.requestedAt}
        />
      </div>

      <div className="flex gap-2 pt-3 border-t border-white/[0.05]">
        <Link
          href="/dashboard/appointments"
          className="bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] transition-all px-5 py-2 rounded-lg font-medium text-sm text-white/60 text-center"
        >
          ← Буцах
        </Link>
        <button
          type="submit"
          disabled={pending || !selectedIso}
          className="bg-violet-600 hover:bg-violet-500 disabled:opacity-60 disabled:cursor-not-allowed transition-all px-6 py-2 rounded-lg font-medium text-sm"
        >
          {pending ? "..." : "Цаг бүртгэх"}
        </button>
      </div>
    </form>
  );
}
