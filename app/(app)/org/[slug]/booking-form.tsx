"use client";

import { useActionState, useState } from "react";
import type { CreatedAccountVehicle } from "@/app/_actions/account-vehicles";
import {
  type AppointmentActionState,
  createAppointment,
} from "@/app/_actions/appointments";
import { Field, FormError } from "@/app/_components/auth-shell";
import { BranchTimePicker } from "@/app/_components/branch-time-picker";
import { Select } from "@/app/_components/select";
import type { Weekday } from "@/lib/branches";
import { InlineAccountVehicleForm } from "@/app/(app)/account/inline-account-vehicle-form";

type Branch = { id: string; name: string; openWeekdays: Weekday[] };
type Vehicle = { id: string; plate: string; make: string; model: string };

export function BookingForm({
  branches,
  vehicles: initialVehicles,
}: {
  branches: Branch[];
  vehicles: Vehicle[];
}) {
  const [state, formAction, pending] = useActionState<
    AppointmentActionState,
    FormData
  >(createAppointment, null);
  const fe = state?.fieldErrors ?? {};

  const [branchId, setBranchId] = useState(
    branches.length === 1 ? branches[0].id : "",
  );
  const [vehicles, setVehicles] = useState<Vehicle[]>(initialVehicles);
  const [vehicleId, setVehicleId] = useState(
    initialVehicles.length === 1 ? initialVehicles[0].id : "",
  );
  const [showVehForm, setShowVehForm] = useState(false);
  const [selectedIso, setSelectedIso] = useState("");

  const selectedBranch = branches.find((b) => b.id === branchId);

  function onBranchChange(v: string) {
    setBranchId(v);
    setSelectedIso("");
  }

  function onVehCreated(v: CreatedAccountVehicle) {
    setVehicles((prev) => [
      { id: v.id, plate: v.plate, make: v.make, model: v.model },
      ...prev,
    ]);
    setVehicleId(v.id);
    setShowVehForm(false);
  }

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <FormError message={state?.message && !state.ok ? state.message : undefined} />
      <input type="hidden" name="requestedAt" value={selectedIso} />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 items-start">
        {/* Зүүн багана: салбар, машин, тэмдэглэл */}
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

          <Field
            label="Машин"
            htmlFor="accountVehicleId"
            hint="заавал биш"
            error={fe.accountVehicleId}
          >
            <div className="flex gap-2">
              <div className="flex-1 min-w-0">
                <Select
                  id="accountVehicleId"
                  name="accountVehicleId"
                  value={vehicleId}
                  onChange={setVehicleId}
                  error={fe.accountVehicleId}
                  placeholder={
                    vehicles.length === 0 ? "— Машингүй —" : "— Сонгох —"
                  }
                  options={vehicles.map((v) => ({
                    value: v.id,
                    label: v.plate,
                    hint: `${v.make} ${v.model}`,
                  }))}
                />
              </div>
              <button
                type="button"
                onClick={() => setShowVehForm((v) => !v)}
                className="shrink-0 px-2.5 rounded-lg border border-violet-500/30 bg-violet-500/10 hover:bg-violet-500/20 text-violet-200 text-xs font-medium transition-colors"
                title="Шинэ машин нэмэх"
              >
                {showVehForm ? "✕" : "+"}
              </button>
            </div>
          </Field>

          {showVehForm ? (
            <InlineAccountVehicleForm
              onCreated={onVehCreated}
              onCancel={() => setShowVehForm(false)}
            />
          ) : null}

          <Field label="Тэмдэглэл" htmlFor="note" hint="заавал биш">
            <textarea
              id="note"
              name="note"
              rows={2}
              className="compact-input resize-y"
              placeholder="Ямар үйлчилгээ авах, гомдол..."
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

      <button
        type="submit"
        disabled={pending || !selectedIso}
        className="self-start bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all px-6 py-2.5 rounded-xl font-medium text-sm"
      >
        {pending ? "..." : "Цаг захиалах"}
      </button>
    </form>
  );
}
