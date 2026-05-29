"use client";

import { useActionState, useState } from "react";
import {
  deleteTenantQPayAction,
  saveTenantQPayAction,
  type TenantQPayActionState,
} from "@/app/_actions/tenant-qpay";
import { Field, FormError } from "@/app/_components/auth-shell";

type Initial = {
  username: string;
  invoiceCode: string;
  callbackUrl: string | null;
  enabled: boolean;
  hasPassword: boolean;
};

const FIELD_MW = "max-w-sm";

export function TenantQPayForm({ initial }: { initial: Initial | null }) {
  const [state, formAction, pending] = useActionState<
    TenantQPayActionState,
    FormData
  >(saveTenantQPayAction, null);

  const [username, setUsername] = useState(initial?.username ?? "");
  const [password, setPassword] = useState("");
  const [invoiceCode, setInvoiceCode] = useState(initial?.invoiceCode ?? "");
  const [callbackUrl, setCallbackUrl] = useState(initial?.callbackUrl ?? "");
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);
  const [showPassword, setShowPassword] = useState(false);

  const fe = state?.fieldErrors ?? {};
  const isConfigured = Boolean(initial);

  return (
    <>
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state?.ok && state.message ? (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 text-sm text-emerald-300">
          {state.message}
        </div>
      ) : null}
      <FormError
        message={state?.message && !state.ok ? state.message : undefined}
      />

      <div className="grid gap-3.5 sm:grid-cols-2">
        <Field
          label="Username"
          htmlFor="qp-username"
          error={fe.username}
          className={FIELD_MW}
        >
          <input
            id="qp-username"
            name="username"
            type="text"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className={`compact-input ${fe.username ? "border-red-500/50" : ""}`}
            placeholder="QPay merchant username"
          />
        </Field>

        <Field
          label="Password"
          htmlFor="qp-password"
          hint={
            initial?.hasPassword
              ? "Хоосон үлдээвэл хуучин үлдэнэ"
              : "QPay merchant нууц үг"
          }
          error={fe.password}
          className={FIELD_MW}
        >
          <div className="relative">
            <input
              id="qp-password"
              name="password"
              type={showPassword ? "text" : "password"}
              required={!isConfigured}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`compact-input pr-14 ${fe.password ? "border-red-500/50" : ""}`}
              placeholder={initial?.hasPassword ? "••••••••" : "QPay password"}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors text-xs"
            >
              {showPassword ? "Нуух" : "Харах"}
            </button>
          </div>
        </Field>

        <Field
          label="Invoice code"
          htmlFor="qp-invoiceCode"
          error={fe.invoiceCode}
          className={FIELD_MW}
        >
          <input
            id="qp-invoiceCode"
            name="invoiceCode"
            type="text"
            required
            value={invoiceCode}
            onChange={(e) => setInvoiceCode(e.target.value)}
            className={`compact-input ${fe.invoiceCode ? "border-red-500/50" : ""}`}
            placeholder="QPay invoice code"
          />
        </Field>

        <Field
          label="Callback URL"
          htmlFor="qp-callbackUrl"
          hint="заавал биш"
          error={fe.callbackUrl}
          className={FIELD_MW}
        >
          <input
            id="qp-callbackUrl"
            name="callbackUrl"
            type="url"
            value={callbackUrl}
            onChange={(e) => setCallbackUrl(e.target.value)}
            className="compact-input"
            placeholder="https://your-domain.com/qpay-callback"
          />
        </Field>
      </div>

      <label className="flex items-start gap-3 p-3 rounded-lg border border-white/[0.06] bg-white/[0.02] cursor-pointer hover:bg-white/[0.04] max-w-md">
        <input
          type="checkbox"
          name="enabled"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          value="on"
          className="mt-0.5 accent-violet-500"
        />
        <div className="flex-1">
          <div className="text-sm font-medium text-white/90">Идэвхтэй</div>
          <div className="text-xs text-white/40 mt-0.5">
            Захиалгад QPay QR үүсгэх боломжтой болно. Идэвхгүй болговол одоо
            байгаа QR-ууд хэвээр, шинээр үүсгэхгүй.
          </div>
        </div>
      </label>
      {!enabled ? <input type="hidden" name="enabled" value="off" /> : null}

      <div className="flex gap-2 pt-3 border-t border-white/[0.05]">
        <button
          type="submit"
          disabled={pending}
          className="bg-violet-600 hover:bg-violet-500 disabled:opacity-60 disabled:cursor-not-allowed transition-all px-6 py-2 rounded-lg font-medium text-sm"
        >
          {pending ? "..." : "Хадгалах"}
        </button>
      </div>
    </form>
    {isConfigured ? (
      <form action={deleteTenantQPayAction} className="pt-2">
        <button
          type="submit"
          className="bg-white/[0.04] hover:bg-red-500/20 border border-white/[0.08] hover:border-red-500/30 text-white/60 hover:text-red-300 transition-all px-5 py-2 rounded-lg font-medium text-sm"
        >
          Тохиргоог устгах
        </button>
      </form>
    ) : null}
    </>
  );
}
