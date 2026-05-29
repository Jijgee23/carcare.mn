"use client";

import { useActionState, useState } from "react";
import {
  type TenantActionState,
  removeTenantLogoAction,
  uploadTenantLogoAction,
} from "@/app/_actions/tenant";
import { Field, FormError } from "@/app/_components/auth-shell";

export function LogoForm({
  currentLogoUrl,
}: {
  currentLogoUrl: string | null;
}) {
  const [state, formAction, pending] = useActionState<
    TenantActionState,
    FormData
  >(uploadTenantLogoAction, null);

  const [preview, setPreview] = useState<string | null>(null);

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return setPreview(null);
    setPreview(URL.createObjectURL(file));
  }

  const fe = state?.fieldErrors ?? {};
  const display = preview ?? currentLogoUrl;

  return (
    <div className="flex flex-col gap-4">
      {state?.ok && state.message ? (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2.5 text-sm text-emerald-300">
          {state.message}
        </div>
      ) : null}
      <FormError
        message={state?.message && !state.ok ? state.message : undefined}
      />

      <div className="flex items-center gap-4 max-w-2xl">
        <div className="w-16 h-16 shrink-0 rounded-lg overflow-hidden flex items-center justify-center bg-white/[0.04] border border-white/[0.08]">
          {display ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={display}
              alt="Лого"
              className="w-full h-full object-contain"
            />
          ) : (
            <span className="text-xs text-white/30">Алга</span>
          )}
        </div>

        <div className="flex-1 flex flex-col gap-2.5">
          <form action={formAction} className="flex flex-col gap-2.5">
            <Field label="Шинэ лого" htmlFor="logo" error={fe.logo}>
              <input
                id="logo"
                name="logo"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={onChange}
                className="block w-full text-xs text-white/60 file:mr-3 file:rounded-md file:border-0 file:bg-white/[0.08] file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white/80 hover:file:bg-white/[0.12] file:cursor-pointer"
              />
            </Field>
            <button
              type="submit"
              disabled={pending}
              className="self-start bg-violet-600 hover:bg-violet-500 disabled:opacity-60 transition-colors px-4 py-1.5 rounded-lg text-sm font-medium"
            >
              {pending ? "Хадгалж..." : "Хадгалах"}
            </button>
          </form>
          {currentLogoUrl ? <RemoveButton /> : null}
        </div>
      </div>

      <p className="text-xs text-white/30">
        PNG, JPG, WEBP, SVG · хамгийн ихдээ 2MB
      </p>
    </div>
  );
}

function RemoveButton() {
  return (
    <form action={removeTenantLogoAction}>
      <button
        type="submit"
        className="bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] transition-colors px-4 py-1.5 rounded-lg text-sm font-medium text-white/60"
      >
        Устгах
      </button>
    </form>
  );
}
