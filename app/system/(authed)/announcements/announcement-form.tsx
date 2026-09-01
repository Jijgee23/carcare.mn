"use client";

import { useActionState } from "react";
import {
  type AnnouncementActionState,
  sendAnnouncementAction,
} from "@/app/_actions/system-announcements";
import { Field, FormError } from "@/app/_components/auth-shell";

export function AnnouncementForm() {
  const [state, action, pending] = useActionState<AnnouncementActionState, FormData>(
    sendAnnouncementAction,
    null,
  );
  const fe = state?.fieldErrors ?? {};

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {state?.ok && state.message ? (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 text-sm text-emerald-300 light:bg-emerald-100 light:border-emerald-300 light:text-emerald-700">
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
          className={`compact-input ${fe.title ? "border-red-500/50" : ""}`}
          placeholder="Жишээ: Системийн засвар үйлчилгээ"
        />
      </Field>

      <Field label="Агуулга" htmlFor="body" error={fe.body}>
        <textarea
          id="body"
          name="body"
          rows={4}
          maxLength={500}
          className={`compact-input ${fe.body ? "border-red-500/50" : ""}`}
          placeholder="Мэдэгдлийн бүтэн текст..."
        />
      </Field>

      <div>
        <div className="text-sm font-medium text-white/90 mb-2">Хүлээн авагч</div>
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm text-white/70">
            <input type="checkbox" name="targetStaff" defaultChecked className="accent-violet-600" />
            Ажилтан (байгууллагын дотоод хэрэглэгчид)
          </label>
          <label className="flex items-center gap-2 text-sm text-white/70">
            <input type="checkbox" name="targetAccount" defaultChecked className="accent-violet-600" />
            Хэрэглэгч (мобайл апп-ийн эцсийн хэрэглэгчид)
          </label>
        </div>
        {fe.targets ? <p className="text-red-400 text-xs mt-1.5">{fe.targets}</p> : null}
      </div>

      <div className="flex pt-2">
        <button
          type="submit"
          disabled={pending}
          className="bg-violet-600 hover:bg-violet-500 disabled:opacity-60 transition-all px-6 py-2 rounded-lg font-medium text-sm"
        >
          {pending ? "Илгээж байна..." : "Илгээх"}
        </button>
      </div>
    </form>
  );
}
