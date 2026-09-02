"use client";

import { useActionState, useState } from "react";
import {
  type SettingsActionState,
  updatePlatformSettings,
} from "@/app/_actions/system-settings";
import { Field, FormError } from "@/app/_components/auth-shell";

export function SettingsForm({
  initial,
}: {
  initial: {
    facebookUrl: string | null;
    youtubeUrl: string | null;
    appointmentFeeEnabled: boolean;
    appointmentFeeAmount: number;
  };
}) {
  const [state, action, pending] = useActionState<SettingsActionState, FormData>(
    updatePlatformSettings,
    null,
  );
  const fe = state?.fieldErrors ?? {};
  const [feeEnabled, setFeeEnabled] = useState(initial.appointmentFeeEnabled);

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {state?.ok && state.message ? (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 text-sm text-emerald-300 light:bg-emerald-100 light:border-emerald-300 light:text-emerald-700">
          {state.message}
        </div>
      ) : null}
      <FormError message={state?.message && !state.ok ? state.message : undefined} />

      <Field
        label="Facebook URL"
        htmlFor="facebookUrl"
        hint="заавал биш — хоосон бол footer-т харагдахгүй"
        error={fe.facebookUrl}
      >
        <input
          id="facebookUrl"
          name="facebookUrl"
          type="url"
          defaultValue={initial.facebookUrl ?? ""}
          className={`compact-input ${fe.facebookUrl ? "border-red-500/50" : ""}`}
          placeholder="https://facebook.com/infosystems"
        />
      </Field>

      <Field
        label="YouTube URL"
        htmlFor="youtubeUrl"
        hint="заавал биш — хоосон бол footer-т харагдахгүй"
        error={fe.youtubeUrl}
      >
        <input
          id="youtubeUrl"
          name="youtubeUrl"
          type="url"
          defaultValue={initial.youtubeUrl ?? ""}
          className={`compact-input ${fe.youtubeUrl ? "border-red-500/50" : ""}`}
          placeholder="https://youtube.com/@infosystems"
        />
      </Field>

      <div className="border-t border-white/10 pt-4 flex flex-col gap-4">
        <div>
          <div className="text-sm font-medium text-white/90">
            Цаг захиалгын хураамж
          </div>
          <div className="text-xs text-white/40 mt-0.5">
            Хэрэглэгч онлайн цаг захиалахдаа QPay-ээр төлөх хураамж —
            орлого платформ дээр ирнэ.
          </div>
        </div>

        <label className="flex items-start gap-3 p-3.5 rounded-[10px] border border-white/10 bg-white/[0.02] cursor-pointer hover:border-white/20 max-w-md">
          <input
            type="checkbox"
            name="appointmentFeeEnabled"
            checked={feeEnabled}
            onChange={(e) => setFeeEnabled(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-violet-500"
          />
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-white/90">
              Хураамж авах
            </span>
            <span className="text-xs text-white/40">
              Идэвхгүй болговол цаг захиалга үнэгүй болно — хэрэглэгчээс
              төлбөр авахгүй, invoice үүсэхгүй.
            </span>
          </span>
        </label>

        <Field
          label="Дүн (₮)"
          htmlFor="appointmentFeeAmount"
          hint={feeEnabled ? undefined : "Хураамж идэвхгүй үед хэрэглэгдэхгүй"}
          error={fe.appointmentFeeAmount}
        >
          <input
            id="appointmentFeeAmount"
            name="appointmentFeeAmount"
            type="number"
            min="1"
            step="1"
            defaultValue={initial.appointmentFeeAmount}
            className={`compact-input font-plex-mono max-w-[160px] ${
              fe.appointmentFeeAmount ? "border-red-500/50" : ""
            }`}
          />
        </Field>
      </div>

      <div className="flex pt-2">
        <button
          type="submit"
          disabled={pending}
          className="bg-violet-600 hover:bg-violet-500 disabled:opacity-60 transition-all px-6 py-2 rounded-lg font-medium text-sm"
        >
          {pending ? "..." : "Хадгалах"}
        </button>
      </div>
    </form>
  );
}
