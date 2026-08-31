"use client";

import { useActionState, useState } from "react";
import {
  type TenantActionState,
  removeTenantLogoAction,
  uploadTenantLogoAction,
} from "@/app/_actions/tenant";
import { Field, FormError } from "@/app/_components/auth-shell";
import { Btn } from "@/app/_components/landing-ops-ui";

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
        <div className="bg-[var(--oc-ok)]/10 border border-[var(--oc-ok)]/25 rounded-lg px-4 py-2.5 text-sm text-[var(--oc-ok)]">
          {state.message}
        </div>
      ) : null}
      <FormError
        message={state?.message && !state.ok ? state.message : undefined}
      />

      <div className="flex items-center gap-4 max-w-2xl">
        <div className="w-16 h-16 shrink-0 rounded-lg overflow-hidden flex items-center justify-center bg-[var(--oc-panel2)] border border-[var(--oc-line)]">
          {display ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={display}
              alt="Лого"
              className="w-full h-full object-contain"
            />
          ) : (
            <span className="text-xs text-[var(--oc-muted4)]">Алга</span>
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
                className="block w-full text-xs text-[var(--oc-muted2)] file:mr-3 file:rounded-md file:border-0 file:bg-[var(--oc-panel2)] file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-[var(--oc-ink2)] hover:file:bg-[var(--oc-line)] file:cursor-pointer"
              />
            </Field>
            <Btn type="submit" disabled={pending} size="sm" className="self-start">
              {pending ? "Хадгалж..." : "Хадгалах"}
            </Btn>
          </form>
          {currentLogoUrl ? <RemoveButton /> : null}
        </div>
      </div>

      <p className="text-xs text-[var(--oc-muted4)]">
        PNG, JPG, WEBP, SVG · хамгийн ихдээ 2MB
      </p>
    </div>
  );
}

function RemoveButton() {
  return (
    <form action={removeTenantLogoAction}>
      <Btn type="submit" variant="ghost" size="sm">
        Устгах
      </Btn>
    </form>
  );
}
