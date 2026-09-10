"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  repairAppointmentOrderLinkAction,
  type AppointmentActionState,
} from "@/app/_actions/appointments";
import { ConfirmForm } from "@/app/_components/confirm-form";
import { useToast } from "@/app/_components/toast";

export type AppointmentOrderRepairCandidateView = {
  id: string;
  number: string;
  label: string;
  statusLabel: string;
  statusClass: string;
};

/**
 * Recovery controls for a genuinely unresolved appointment → service-order
 * link. The server action repeats every scope and ownership check; these
 * controls are only a convenient, permission-gated entry point for workers.
 */
export function AppointmentOrderLinkRepair({
  appointmentId,
  candidates,
}: {
  appointmentId: string;
  candidates: AppointmentOrderRepairCandidateView[];
}) {
  const toast = useToast();
  const [state, formAction, pending] = useActionState<
    AppointmentActionState,
    FormData
  >(repairAppointmentOrderLinkAction, null);
  const handled = useRef<AppointmentActionState>(null);

  useEffect(() => {
    if (!state || state === handled.current) return;
    handled.current = state;
    if (state.ok) toast.success(state.message ?? "Амжилттай.");
    else toast.error(state.message ?? "Алдаа гарлаа.");
  }, [state, toast]);

  return (
    <div className="basis-full rounded-xl border border-red-500/25 bg-red-500/[0.05] p-3 space-y-2">
      <div>
        <p className="text-xs font-medium text-red-300 light:text-red-700">
          Холбогдсон засварын хуудас олдсонгүй.
        </p>
        <p className="mt-1 text-[11px] text-[var(--oc-muted3)]">
          Зөв тохирох засварын хуудсыг сонгох эсвэл хуучин холбоосыг салгана уу.
        </p>
      </div>

      {candidates.length > 0 ? (
        <ConfirmForm
          action={formAction}
          title="Холбоос сэргээх үү?"
          confirmLabel="Холбох"
          message="Сонгосон засварын хуудсыг энэ цагийн захиалгатай холбоно. Зөвхөн нэг цагийн захиалгатай холбогдоно."
          className="flex flex-wrap items-center gap-2"
        >
          <input type="hidden" name="appointmentId" value={appointmentId} />
          <input type="hidden" name="mode" value="relink" />
          <select
            name="orderId"
            defaultValue=""
            disabled={pending}
            required
            className="min-w-0 flex-1 rounded-lg border border-[var(--oc-line)] bg-[var(--oc-panel2)] px-2.5 py-1.5 text-xs text-[var(--oc-ink2)] disabled:opacity-60"
          >
            <option value="" disabled>
              Засварын хуудас сонгох...
            </option>
            {candidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                #{candidate.number} — {candidate.label} ({candidate.statusLabel})
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={pending}
            className="shrink-0 rounded-lg bg-[var(--oc-accent)] px-3 py-1.5 text-xs font-medium text-[var(--oc-on-accent)] transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Хадгалж байна..." : "Холболтыг сэргээх"}
          </button>
        </ConfirmForm>
      ) : (
        <p className="text-[11px] text-[var(--oc-muted4)]">
          Ижил үйлчлүүлэгч, машинд тохирох сул засварын хуудас олдсонгүй.
        </p>
      )}

      <ConfirmForm
        action={formAction}
        title="Холбоос салгах уу?"
        confirmLabel="Холбоос салгах"
        message="Энэ цагийн захиалга засварын хуудастай холбогдохоо болино. Түүх устахгүй, харин дараа нь зөв засварын хуудсыг дахин холбох шаардлагатай болно."
        className="inline-block"
      >
        <input type="hidden" name="appointmentId" value={appointmentId} />
        <input type="hidden" name="mode" value="detach" />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Холбоосыг салгах
        </button>
      </ConfirmForm>
    </div>
  );
}
