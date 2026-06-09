"use client";

import { useActionState } from "react";
import {
  type SettingsActionState,
  updatePlatformSettings,
} from "@/app/_actions/system-settings";
import { Field, FormError } from "@/app/_components/auth-shell";

export function SettingsForm({
  initial,
}: {
  initial: { facebookUrl: string | null; youtubeUrl: string | null };
}) {
  const [state, action, pending] = useActionState<SettingsActionState, FormData>(
    updatePlatformSettings,
    null,
  );
  const fe = state?.fieldErrors ?? {};

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {state?.ok && state.message ? (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 text-sm text-emerald-300">
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
