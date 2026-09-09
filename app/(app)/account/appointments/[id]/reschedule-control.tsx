"use client";

import { useActionState, useState } from "react";
import {
  type AppointmentActionState,
  rescheduleAppointmentByAccount,
} from "@/app/_actions/appointments";
import { BranchTimePicker } from "@/app/_components/branch-time-picker";
import { ConfirmForm } from "@/app/_components/confirm-form";
import { Btn } from "@/app/_components/landing-ops-ui";
import { useToast } from "@/app/_components/toast";
import type { Weekday } from "@/lib/branches";

// Хэрэглэгч өөрийн PENDING/CONFIRMED цагаа шилжүүлэх — booking-ийн адил
// BranchTimePicker (слот сонголт) ашиглана, ажилтны талын чөлөөт
// огноо+давхцлын мессежтэй (өөр үйлчлүүлэгчийн нэр/утас агуулсан) адилгүй —
// энд зөвхөн "сул/захиалгатай" л харагдана, хэн эзэлснийг харуулахгүй.
export function AccountRescheduleControl({
  appointmentId,
  branchId,
  openWeekdays,
  categoryIds,
}: {
  appointmentId: string;
  branchId: string;
  openWeekdays: Weekday[];
  categoryIds: string[];
}) {
  const toast = useToast();
  const [state, formAction, pending] = useActionState<
    AppointmentActionState,
    FormData
  >(rescheduleAppointmentByAccount, null);
  const [editing, setEditing] = useState(false);
  const [iso, setIso] = useState("");
  const [prevState, setPrevState] = useState<AppointmentActionState>(null);

  if (state !== prevState) {
    setPrevState(state);
    if (state?.ok) {
      toast.success(state.message ?? "Амжилттай.");
      setEditing(false);
    } else if (state) {
      toast.error(state.message ?? "Алдаа гарлаа.");
    }
  }

  if (!editing) {
    return (
      <Btn
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => {
          setIso("");
          setEditing(true);
        }}
      >
        Цагаа шилжүүлэх
      </Btn>
    );
  }

  return (
    <div className="w-full rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] p-4">
      <ConfirmForm
        action={formAction}
        className="flex flex-col gap-4"
        message="Сонгосон шинэ цаг руу захиалгыг шилжүүлэх үү?"
        title="Цагаа шилжүүлэх"
        confirmLabel="Тийм, шилжүүлэх"
      >
        <input type="hidden" name="id" value={appointmentId} />
        <input type="hidden" name="requestedAt" value={iso} />
        <div className="grid gap-4 sm:grid-cols-2">
          <BranchTimePicker
            branchId={branchId}
            categoryIds={categoryIds}
            openWeekdays={openWeekdays}
            value={iso}
            onChange={setIso}
            error={state && !state.ok ? state.fieldErrors?.requestedAt : undefined}
          />
        </div>
        <div className="flex items-center gap-2">
          <Btn type="submit" size="sm" disabled={pending || !iso}>
            {pending ? "Шилжүүлж байна..." : "Шилжүүлэх"}
          </Btn>
          <Btn type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
            Болих
          </Btn>
        </div>
      </ConfirmForm>
    </div>
  );
}
