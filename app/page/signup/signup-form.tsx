"use client";

import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import { signUpAction, type ActionState } from "@/app/_actions/auth";
import {
  Field,
  FormError,
  SubmitButton,
} from "@/app/_components/auth-shell";

const REGNO_PATTERN = /^\d{7}$/;
const REGNO_FETCH_DEBOUNCE_MS = 400;

export function SignUpForm() {
  
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    signUpAction,
    null,
  );

  const fe = state?.fieldErrors ?? {};
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const awaitingOtp = Boolean(state?.awaitingOtp);

  // Нууц үгийг controlled — render-бүрт state-д хадгалагдана. Server-руу values
  // дотор буцаахгүй (аюулгүй байдлын үүднээс), client дотроо л хадгална.
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");

  // Регистр / Байгууллагын нэр — controlled (lookup-аар бөглөж болохын тулд)
  const [registerNumber, setRegisterNumber] = useState(
    state?.values?.registerNumber ?? "",
  );
  const [orgName, setOrgName] = useState(state?.values?.orgName ?? "");
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [regFound, setRegFound] = useState(false);
  // Хэрэглэгч нэрийг гараар өөрчилсөн бол дахин дарж бичихгүй
  const userEditedNameRef = useRef(false);
  const lastFetchedRegnoRef = useRef<string | null>(null);

  // Server-ээс буцаасан values-ийг controlled талбарт сэргээх
  // (form submit → алдаа → state өөрчлөгдөн дахин render үед).
  const lastValuesRef = useRef(state?.values);
  useEffect(() => {
    if (state?.values && state.values !== lastValuesRef.current) {
      lastValuesRef.current = state.values;
      setRegisterNumber(state.values.registerNumber);
      setOrgName(state.values.orgName);
      // Сэргээгдсэн нэрийг хэрэглэгч засаагүй гэж тооцох уу гэдэг асуудал —
      // нэр сонгогдсон бол lookup-аар дарагдахгүйн тулд userEdited гэж тэмдэглэе.
      if (state.values.orgName) {
        userEditedNameRef.current = true;
      }
    }
  }, [state]);

  useEffect(() => {
    const cleanRegno = registerNumber.replace(/\D+/g, "");
    if (!REGNO_PATTERN.test(cleanRegno)) {
      setRegFound(false);
      setRegError(null);
      return;
    }
    if (lastFetchedRegnoRef.current === cleanRegno) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      lastFetchedRegnoRef.current = cleanRegno;
      setRegLoading(true);
      setRegError(null);
      setRegFound(false);
      try {
        const res = await fetch(
          `/api/ebarimt/lookup?regno=${encodeURIComponent(cleanRegno)}`,
          { signal: controller.signal },
        );
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error ?? "Регистр шалгаж чадсангүй.");
        }
        const org = data.org as {
          found: boolean;
          name: string | null;
        } | null;
        if (org?.found && org.name) {
          setRegFound(true);
          if (!userEditedNameRef.current) {
            setOrgName(org.name);
          }
        } else {
          setRegFound(false);
        }
      } catch (e) {
        if (controller.signal.aborted) return;
        setRegError(e instanceof Error ? e.message : "Алдаа гарлаа.");
        lastFetchedRegnoRef.current = null;
      } finally {
        if (!controller.signal.aborted) setRegLoading(false);
      }
    }, REGNO_FETCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [registerNumber]);

  function onLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      setLogoPreview(null);
      return;
    }
    setLogoPreview(URL.createObjectURL(file));
  }

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      {awaitingOtp && state?.message ? (
        <div className="bg-violet-500/10 border border-violet-500/25 rounded-xl px-4 py-3 text-sm text-violet-200">
          {state.message}
        </div>
      ) : (
        <FormError message={state?.message} />
      )}

      <section className="flex flex-col gap-5">
        <div>
          <h2 className="font-semibold text-white">Байгууллагын мэдээлэл</h2>
          <p className="mt-1 text-xs text-white/40">
            carcare-д бүртгүүлэх үндсэн мэдээлэл.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field
            label="Байгууллагын регистр"
            htmlFor="registerNumber"
            hint={
              regLoading
                ? "Шалгаж байна..."
                : regFound
                  ? "Олдсон · нэр автоматаар бөглөгдсөн"
                  : "7 оронтой тоо — нэрийг автоматаар татна"
            }
            error={fe.registerNumber ?? regError ?? undefined}
          >
            <div className="relative">
              <input
                id="registerNumber"
                name="registerNumber"
                type="text"
                inputMode="numeric"
                pattern="\d{7}"
                maxLength={7}
                required
                value={registerNumber}
                onChange={(e) =>
                  setRegisterNumber(e.target.value.replace(/\D+/g, ""))
                }
                className={`auth-input pr-9 ${
                  fe.registerNumber
                    ? "border-red-500/50"
                    : regFound
                      ? "border-emerald-500/40"
                      : ""
                }`}
                placeholder="1234567"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                {regLoading ? (
                  <svg
                    className="w-4 h-4 animate-spin text-violet-300"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8z"
                    />
                  </svg>
                ) : regFound ? (
                  <svg
                    className="w-4 h-4 text-emerald-400"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : null}
              </div>
            </div>
          </Field>

          <Field
            label="Байгууллагын нэр"
            htmlFor="orgName"
            error={fe.orgName}
            className="lg:col-span-2"
          >
            <input
              id="orgName"
              name="orgName"
              type="text"
              required
              value={orgName}
              onChange={(e) => {
                userEditedNameRef.current = true;
                setOrgName(e.target.value);
              }}
              className={`auth-input ${fe.orgName ? "border-red-500/50" : ""}`}
              placeholder="Жишээ: Гранд Гараж ХХК"
            />
          </Field>

          <Field
            label="Байгууллагын имэйл"
            htmlFor="orgEmail"
            error={fe.orgEmail}
          >
            <input
              key={`orgEmail-${state?.values?.orgEmail ?? ""}`}
              id="orgEmail"
              name="orgEmail"
              type="email"
              required
              defaultValue={state?.values?.orgEmail ?? ""}
              className={`auth-input ${fe.orgEmail ? "border-red-500/50" : ""}`}
              placeholder="garage@gmail.com"
            />
          </Field>

          <Field label="Утас 1" htmlFor="phone1" error={fe.phone1}>
            <input
              key={`phone1-${state?.values?.phone1 ?? ""}`}
              id="phone1"
              name="phone1"
              type="tel"
              inputMode="numeric"
              maxLength={8}
              pattern="[0-9]{8}"
              required
              defaultValue={state?.values?.phone1 ?? ""}
              className={`auth-input ${fe.phone1 ? "border-red-500/50" : ""}`}
              placeholder="99000000"
            />
          </Field>
          <Field
            label="Утас 2"
            htmlFor="phone2"
            hint="заавал биш"
            error={fe.phone2}
          >
            <input
              key={`phone2-${state?.values?.phone2 ?? ""}`}
              id="phone2"
              name="phone2"
              type="tel"
              inputMode="numeric"
              maxLength={8}
              pattern="[0-9]{8}"
              defaultValue={state?.values?.phone2 ?? ""}
              className="auth-input"
              placeholder="88000000"
            />
          </Field>
        </div>

        <Field
          label="Лого"
          htmlFor="logo"
          hint="PNG, JPG, WEBP, SVG · хамгийн ихдээ 2MB"
          error={fe.logo}
        >
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 shrink-0 rounded-xl overflow-hidden flex items-center justify-center glass">
              {logoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoPreview}
                  alt="Лого preview"
                  className="w-full h-full object-contain"
                />
              ) : (
                <span className="text-[10px] text-white/30">Урьдчилан</span>
              )}
            </div>
            <input
              id="logo"
              name="logo"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={onLogoChange}
              className="block w-full text-sm text-white/60 file:mr-3 file:rounded-lg file:border-0 file:bg-white/[0.08] file:px-3 file:py-2 file:text-sm file:font-medium file:text-white/80 hover:file:bg-white/[0.12] file:cursor-pointer"
            />
          </div>
        </Field>
      </section>

      <section className="flex flex-col gap-5 pt-6 border-t border-white/[0.06]">
        <div>
          <h2 className="font-semibold text-white">Админ хэрэглэгч</h2>
          <p className="mt-1 text-xs text-white/40">
            Системийн анхны админ (OWNER) хэрэглэгч.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Овог" htmlFor="lastName" error={fe.lastName}>
            <input
              key={`lastName-${state?.values?.lastName ?? ""}`}
              id="lastName"
              name="lastName"
              type="text"
              required
              defaultValue={state?.values?.lastName ?? ""}
              className={`auth-input ${fe.lastName ? "border-red-500/50" : ""}`}
              placeholder="Батын"
            />
          </Field>
          <Field label="Нэр" htmlFor="firstName" error={fe.firstName}>
            <input
              key={`firstName-${state?.values?.firstName ?? ""}`}
              id="firstName"
              name="firstName"
              type="text"
              required
              defaultValue={state?.values?.firstName ?? ""}
              className={`auth-input ${fe.firstName ? "border-red-500/50" : ""}`}
              placeholder="Болд"
            />
          </Field>
          <Field label="Утас" htmlFor="adminPhone" error={fe.adminPhone}>
            <input
              key={`adminPhone-${state?.values?.adminPhone ?? ""}`}
              id="adminPhone"
              name="adminPhone"
              type="tel"
              inputMode="numeric"
              maxLength={8}
              pattern="[0-9]{8}"
              required
              defaultValue={state?.values?.adminPhone ?? ""}
              className={`auth-input ${fe.adminPhone ? "border-red-500/50" : ""}`}
              placeholder="99000000"
            />
          </Field>
          <Field label="Имэйл" htmlFor="adminEmail" error={fe.adminEmail}>
            <input
              key={`adminEmail-${state?.values?.adminEmail ?? ""}`}
              id="adminEmail"
              name="adminEmail"
              type="email"
              required
              defaultValue={state?.values?.adminEmail ?? ""}
              className={`auth-input ${fe.adminEmail ? "border-red-500/50" : ""}`}
              placeholder="bold@gmail.com"
            />
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Нууц үг"
            htmlFor="password"
            hint="8+ тэмдэгт"
            error={fe.password}
          >
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`auth-input pr-14 ${fe.password ? "border-red-500/50" : ""}`}
                placeholder="••••••••"
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
            label="Нууц үг давтан"
            htmlFor="passwordConfirm"
            error={fe.passwordConfirm}
          >
            <input
              id="passwordConfirm"
              name="passwordConfirm"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              className={`auth-input ${fe.passwordConfirm ? "border-red-500/50" : ""}`}
              placeholder="••••••••"
            />
          </Field>
        </div>
      </section>

      {awaitingOtp ? (
        <section className="flex flex-col gap-3 pt-6 border-t border-white/[0.06]">
          <div>
            <h2 className="font-semibold text-white">Баталгаажуулалт</h2>
            <p className="mt-1 text-xs text-white/40">
              Утсанд илгээсэн 6 оронтой кодыг доорх нүдэнд оруулна уу.
            </p>
          </div>
          <Field label="Баталгаажуулах код" htmlFor="otpCode" error={fe.otpCode}>
            <input
              id="otpCode"
              name="otpCode"
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              autoComplete="one-time-code"
              required
              autoFocus
              className={`auth-input tracking-[0.5em] text-center font-mono ${fe.otpCode ? "border-red-500/50" : ""}`}
              placeholder="••••••"
            />
          </Field>
          <p className="text-[11px] text-white/40">
            Код ирээгүй юу? Кодны талбарыг хоосон үлдээгээд "Бүртгүүлэх"-ыг
            дарвал шинэ код илгээнэ.
          </p>
        </section>
      ) : null}

      <SubmitButton pending={pending}>
        {awaitingOtp ? "Бүртгэл баталгаажуулах →" : "Бүртгүүлэх →"}
      </SubmitButton>

      <p className="text-xs text-white/30 leading-relaxed">
        Бүртгүүлснээр манай{" "}
        <a className="text-violet-400 hover:text-violet-300" href="/terms">
          Үйлчилгээний нөхцөл
        </a>{" "}
        болон{" "}
        <a className="text-violet-400 hover:text-violet-300" href="/privacy">
          Нууцлалын бодлого
        </a>
        -г хүлээн зөвшөөрнө.
      </p>
    </form>
  );
}
