"use client";

import { useActionState, useEffect, useRef } from "react";
import { updateFeedbackStatus, type FeedbackActionState } from "@/app/_actions/feedback";
import { useToast } from "@/app/_components/toast";
import { FEEDBACK_STATUS_LABEL, FEEDBACK_STATUS_VALUES } from "@/lib/feedback";
import type { FeedbackStatus } from "@/app/generated/prisma/client";

export function FeedbackStatusForm({
  id,
  status,
  adminNote,
}: {
  id: string;
  status: FeedbackStatus;
  adminNote: string;
}) {
  const toast = useToast();
  const [state, formAction, pending] = useActionState<
    FeedbackActionState,
    FormData
  >(updateFeedbackStatus, null);
  const handled = useRef<FeedbackActionState>(null);

  useEffect(() => {
    if (!state || state === handled.current) return;
    handled.current = state;
    if (state.ok) toast.success(state.message ?? "Хадгалагдлаа.");
    else toast.error(state.message ?? "Алдаа гарлаа.");
  }, [state, toast]);

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-3 border-t border-white/[0.06] pt-5">
      <input type="hidden" name="id" value={id} />

      <label className="text-xs text-white/50">
        Төлөв
        <select name="status" defaultValue={status} className="auth-input mt-1 w-full">
          {FEEDBACK_STATUS_VALUES.map((v) => (
            <option key={v} value={v}>
              {FEEDBACK_STATUS_LABEL[v]}
            </option>
          ))}
        </select>
      </label>

      <label className="text-xs text-white/50">
        Тэмдэглэл (SuperAdmin-д л харагдана)
        <textarea
          name="adminNote"
          defaultValue={adminNote}
          rows={3}
          maxLength={2000}
          className="auth-input mt-1 w-full resize-none"
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="self-end rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {pending ? "Хадгалж байна..." : "Хадгалах"}
      </button>
    </form>
  );
}
