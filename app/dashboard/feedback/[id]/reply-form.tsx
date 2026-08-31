"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  addSubmitterFeedbackReply,
  type FeedbackActionState,
} from "@/app/_actions/feedback";
import { Btn } from "@/app/_components/landing-ops-ui";
import { useToast } from "@/app/_components/toast";

export function DashboardFeedbackReplyForm({ id }: { id: string }) {
  const toast = useToast();
  const [state, formAction, pending] = useActionState<
    FeedbackActionState,
    FormData
  >(addSubmitterFeedbackReply, null);
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
      className="mt-6 flex flex-col gap-3 border-t border-[var(--oc-line)] pt-5"
    >
      <input type="hidden" name="id" value={id} />

      <label className="text-xs text-[var(--oc-muted3)]">
        Хариу бичих
        <textarea
          name="message"
          required
          minLength={2}
          maxLength={2000}
          rows={3}
          placeholder="Админд илгээх хариу..."
          className="auth-input mt-1 w-full resize-none"
        />
      </label>

      <Btn type="submit" disabled={pending} className="self-end">
        {pending ? "Илгээж байна..." : "Хариу илгээх"}
      </Btn>
    </form>
  );
}
