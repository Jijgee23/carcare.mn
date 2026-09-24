"use client"; // Error boundaries must be Client Components

import { BtnLink } from "@/app/_components/landing-ops-ui";

export default function DashboardError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-16">
      <div className="max-w-md mx-auto text-center rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] p-10">
        <h1 className="text-lg font-semibold text-[var(--oc-ink)] mb-2">
          Алдаа гарлаа
        </h1>
        <p className="text-sm text-[var(--oc-muted3)] mb-6">
          Энэ хэсгийг ачаалахад алдаа гарлаа. Дахин оролдоно уу.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => unstable_retry()}
            className="inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-50 whitespace-nowrap px-4 py-2.5 text-sm rounded-lg bg-[var(--oc-accent)] hover:bg-[var(--oc-accent-hi)] text-[var(--oc-on-accent)] font-semibold"
          >
            Дахин оролдох
          </button>
          <BtnLink href="/dashboard" variant="ghost" size="md">
            Нүүр хуудас
          </BtnLink>
        </div>
        {error.digest ? (
          <p className="mt-4 text-[11px] text-[var(--oc-muted4)]">
            Код: {error.digest}
          </p>
        ) : null}
      </div>
    </div>
  );
}
