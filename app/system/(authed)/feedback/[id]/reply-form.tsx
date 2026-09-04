"use client";

import { useActionState, useEffect, useRef } from "react";
import { replyToFeedback, type FeedbackActionState } from "@/app/_actions/feedback";
import { useToast } from "@/app/_components/toast";

export function FeedbackReplyForm({ id }: { id: string }) {
  const toast = useToast();
  const [state, formAction, pending] = useActionState<
    FeedbackActionState,
    FormData
  >(replyToFeedback, null);
  const handled = useRef<FeedbackActionState>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state || state === handled.current) return;
    handled.current = state;
    if (state.ok) {
      toast.success(state.message ?? "Хариу илгээгдлээ.");
      formRef.current?.reset();
    } else {
      toast.error(state.message ?? "Алдаа гарлаа.");
    }
  }, [state, toast]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="mt-6 flex flex-col gap-3 border-t border-[var(--oc-line2)] pt-5"
    >
      <input type="hidden" name="id" value={id} />

      <label className="text-xs text-[var(--oc-muted)]">
        Хариу бичих (илгээгчид мэдэгдэл болж очно)
        <textarea
          name="message"
          required
          minLength={2}
          maxLength={2000}
          rows={3}
          placeholder="Илгээгчид харагдах хариу..."
          className="auth-input mt-1 w-full resize-none"
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="self-end rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-500 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {pending ? "Илгээж байна..." : "Хариу илгээх"}
      </button>
    </form>
  );
}
