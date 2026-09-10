"use client";

import { useActionState, useState } from "react";
import {
  type TenantActionState,
  removeTenantLogoAction,
  uploadTenantLogoAction,
} from "@/app/_actions/tenant";
import { FormError } from "@/app/_components/auth-shell";
import { ConfirmForm } from "@/app/_components/confirm-form";
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
    <div className="flex flex-col gap-5 max-w-2xl">
      {state?.ok && state.message ? (
        <div className="bg-[var(--oc-ok)]/10 border border-[var(--oc-ok)]/25 rounded-lg px-4 py-2.5 text-sm text-[var(--oc-ok)]">
          {state.message}
        </div>
      ) : null}
      <FormError
        message={state?.message && !state.ok ? state.message : undefined}
      />

      <div className="flex flex-col sm:flex-row gap-5">
        <div className="w-32 h-32 shrink-0 rounded-xl overflow-hidden flex items-center justify-center bg-[var(--oc-panel2)] border border-[var(--oc-line)] mx-auto sm:mx-0">
          {display ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={display}
              alt="Лого"
              className="w-full h-full object-contain p-3"
            />
          ) : (
            <div className="flex flex-col items-center gap-1.5 text-[var(--oc-muted4)]">
              <ImageIcon />
              <span className="text-[10px]">Лого алга</span>
            </div>
          )}
        </div>

        <form id="logo-form" action={formAction} className="flex-1 min-w-0 flex flex-col gap-2">
          <label
            htmlFor="logo"
            className="group flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--oc-line)] hover:border-[var(--oc-accent)]/50 bg-[var(--oc-panel2)]/40 hover:bg-[var(--oc-accent)]/[0.04] transition-colors px-4 py-6 text-center cursor-pointer"
          >
            <UploadIcon />
            <div className="text-sm text-[var(--oc-ink2)]">
              <span className="text-[var(--oc-accent)] font-medium group-hover:text-[var(--oc-accent-hi)]">
                Файл сонгох
              </span>{" "}
              эсвэл энд чирж тавина уу
            </div>
            <div className="text-[11px] text-[var(--oc-muted4)]">
              PNG, JPG, WEBP, SVG · хамгийн ихдээ 2MB
            </div>
            <input
              id="logo"
              name="logo"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={onChange}
              className="sr-only"
            />
          </label>
          {fe.logo ? (
            <p className="text-xs text-red-400 light:text-red-600">{fe.logo}</p>
          ) : null}
        </form>

        <div className="flex flex-col justify-between shrink-0 w-32 mx-auto sm:mx-0">
          <Btn
            type="submit"
            form="logo-form"
            disabled={pending}
            size="sm"
            className="w-full h-11"
          >
            {pending ? "Хадгалж..." : "Хадгалах"}
          </Btn>
          {currentLogoUrl ? <RemoveButton className="w-full" /> : null}
        </div>
      </div>
    </div>
  );
}

function RemoveButton({ className = "" }: { className?: string }) {
  return (
    <ConfirmForm
      action={removeTenantLogoAction}
      message="Байгууллагын логог устгах уу?"
      className={className}
    >
      <Btn type="submit" variant="ghost" size="sm" className="w-full h-11">
        Устгах
      </Btn>
    </ConfirmForm>
  );
}

function UploadIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-[var(--oc-muted3)] group-hover:text-[var(--oc-accent)] transition-colors"
      aria-hidden="true"
    >
      <path d="M12 16V4" />
      <path d="m7 9 5-5 5 5" />
      <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="1.5" />
      <path d="m21 15-5-5L5 21" />
    </svg>
  );
}
