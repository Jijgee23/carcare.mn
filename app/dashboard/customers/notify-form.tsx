"use client";

import { useActionState } from "react";
import {
  type CustomerNotifyActionState,
  sendCustomerBroadcastAction,
} from "@/app/_actions/customers";
import { Field, FormError } from "@/app/_components/auth-shell";
import { Btn } from "@/app/_components/landing-ops-ui";

/**
 * Тухайн тенантын онлайн бүртгэлтэй бүх үйлчлүүлэгчид push зар/урамслал
 * (хямдрал гэх мэт) илгээх маягт — систем админы "Мэдэгдэл илгээх" хуудастай
 * (app/system/(authed)/announcements/announcement-form.tsx) адил хэлбэр,
 * гэхдээ хүлээн авагч сонголтгүй (үргэлж зөвхөн ӨӨРИЙН үйлчлүүлэгчид л явна).
 */
export function CustomerNotifyForm() {
  const [state, formAction, pending] = useActionState<
    CustomerNotifyActionState,
    FormData
  >(sendCustomerBroadcastAction, null);
  const fe = state?.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state?.ok && state.message ? (
        <div className="bg-[var(--oc-ok)]/10 border border-[var(--oc-ok)]/25 rounded-lg px-3 py-2 text-sm text-[var(--oc-ok)]">
          {state.message}
        </div>
      ) : null}
      <FormError message={state?.message && !state.ok ? state.message : undefined} />

      <Field label="Гарчиг" htmlFor="title" error={fe.title}>
        <input
          id="title"
          name="title"
          type="text"
          maxLength={120}
          className={`auth-input ${fe.title ? "border-red-500/50" : ""}`}
          placeholder="Жишээ: 7 хоногийн хямдрал!"
        />
      </Field>

      <Field label="Агуулга" htmlFor="body" error={fe.body}>
        <textarea
          id="body"
          name="body"
          rows={4}
          maxLength={500}
          className={`auth-input ${fe.body ? "border-red-500/50" : ""}`}
          placeholder="Жишээ: Энэ 7 хоногт тос солиулах үйлчилгээ 20% хямдралтай!"
        />
      </Field>

      <div className="flex pt-1">
        <Btn type="submit" disabled={pending}>
          {pending ? "Илгээж байна..." : "Илгээх"}
        </Btn>
      </div>
    </form>
  );
}
