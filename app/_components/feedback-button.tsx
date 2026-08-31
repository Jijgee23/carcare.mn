"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { FeedbackActionState } from "@/app/_actions/feedback";
import { Select } from "@/app/_components/select";
import { useToast } from "@/app/_components/toast";
import { FEEDBACK_TYPE_LABEL, FEEDBACK_TYPE_VALUES } from "@/lib/feedback";

/**
 * Хаанаас ч дуудагдах "Санал хүсэлт" товч + бичих цонх. Dashboard (ажилтан)
 * болон account (үйлчлүүлэгч) хоёулаа submitAction-оо дамжуулж ашиглана
 * (status-controls.tsx-ийн modal хэв маягийг дагасан).
 */
export function FeedbackButton({
  submitAction,
  className,
  compact = false,
}: {
  submitAction: (
    prevState: FeedbackActionState,
    formData: FormData,
  ) => Promise<FeedbackActionState>;
  className?: string;
  compact?: boolean;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState<
    FeedbackActionState,
    FormData
  >(submitAction, null);
  const handled = useRef<FeedbackActionState>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const clearScreenshot = useCallback(() => {
    setScreenshotPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const closeDialog = useCallback(() => {
    setOpen(false);
    clearScreenshot();
  }, [clearScreenshot]);

  function onScreenshotChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setScreenshotPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return file ? URL.createObjectURL(file) : null;
    });
  }

  useEffect(() => {
    if (!state || state === handled.current) return;
    handled.current = state;
    if (state.ok) {
      toast.success(state.message ?? "Илгээгдлээ.");
      formRef.current?.reset();
      closeDialog();
    } else {
      toast.error(state.message ?? "Алдаа гарлаа.");
    }
  }, [state, toast, closeDialog]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeDialog();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, closeDialog]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          "inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/60 transition-colors hover:bg-white/[0.08] hover:text-white/85"
        }
        aria-label="Санал хүсэлт илгээх"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        {!compact ? "Санал хүсэлт" : null}
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <>
              <button
                type="button"
                tabIndex={-1}
                aria-label="Хаах"
                onClick={closeDialog}
                className="fixed inset-0 z-[100] cursor-default bg-black/60"
              />
              <div
                role="dialog"
                aria-modal="true"
                className="fixed left-1/2 top-1/2 z-[110] w-[min(92vw,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-[var(--surface)] p-5 shadow-2xl backdrop-blur-xl"
              >
                <h3 className="font-semibold text-white">Санал хүсэлт илгээх</h3>
                <p className="mt-1 text-sm text-white/50">
                  Алдаа ажигласан эсвэл санал байвал бидэнд бичээрэй.
                </p>

                <form
                  ref={formRef}
                  action={formAction}
                  className="mt-4 flex flex-col gap-3"
                >
                  <input
                    type="hidden"
                    name="pageUrl"
                    value={typeof window !== "undefined" ? window.location.href : ""}
                  />
                  <input
                    type="hidden"
                    name="userAgent"
                    value={typeof navigator !== "undefined" ? navigator.userAgent : ""}
                  />

                  <label className="text-xs text-white/50">
                    Төрөл
                    <div className="mt-1">
                      <Select
                        name="type"
                        required
                        defaultValue="BUG"
                        options={FEEDBACK_TYPE_VALUES.map((t) => ({
                          value: t,
                          label: FEEDBACK_TYPE_LABEL[t],
                        }))}
                      />
                    </div>
                  </label>

                  <label className="text-xs text-white/50">
                    Мессеж
                    <textarea
                      name="message"
                      required
                      minLength={5}
                      maxLength={2000}
                      rows={4}
                      placeholder="Юу ажигласан бэ?"
                      className="auth-input mt-1 w-full resize-none"
                    />
                  </label>

                  <label className="text-xs text-white/50">
                    Дэлгэцийн зураг (заавал биш)
                    <input
                      ref={fileInputRef}
                      type="file"
                      name="screenshot"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={onScreenshotChange}
                      className="mt-1 block w-full text-xs text-white/60 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-white/[0.08] file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white/80 hover:file:bg-white/[0.12]"
                    />
                    <span className="mt-1 block text-[11px] text-white/30">
                      PNG, JPG, WEBP · хамгийн ихдээ 2MB
                    </span>
                  </label>
                  {screenshotPreview ? (
                    <div className="relative self-start">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={screenshotPreview}
                        alt=""
                        className="max-h-32 rounded-lg border border-white/10 object-contain"
                      />
                      <button
                        type="button"
                        onClick={clearScreenshot}
                        aria-label="Зураг арилгах"
                        className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white/80 transition-colors hover:bg-black/90 hover:text-white"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                  ) : null}

                  <div className="mt-1 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={closeDialog}
                      disabled={pending}
                      className="rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2 text-sm text-white/70 transition-colors hover:bg-white/[0.08] disabled:opacity-50"
                    >
                      Болих
                    </button>
                    <button
                      type="submit"
                      disabled={pending}
                      className="rounded-lg bg-violet-600 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {pending ? "Илгээж байна..." : "Илгээх"}
                    </button>
                  </div>
                </form>
              </div>
            </>,
            document.body,
          )
        : null}
    </>
  );
}
