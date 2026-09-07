"use client";

import { useActionState } from "react";
import { type ChooseBranchState, chooseBranchAction } from "@/app/_actions/auth";
import { FormError } from "@/app/_components/landing-ops-ui";
import { ALL_BRANCHES } from "@/lib/auth/session";

export type BranchOption = {
  id: string;
  name: string;
  city: string | null;
  district: string | null;
  address: string | null;
  openTime: string | null;
  closeTime: string | null;
};

export function ChooseBranchForm({
  branches,
  allowAllBranches,
  next,
}: {
  branches: BranchOption[];
  allowAllBranches: boolean;
  next: string;
}) {
  const [state, formAction, pending] = useActionState<
    ChooseBranchState,
    FormData
  >(chooseBranchAction, null);

  return (
    <div className="flex flex-col gap-4">
      <FormError message={state && !state.ok ? state.message : undefined} />

      <div className="grid gap-3 sm:grid-cols-2">
        {branches.map((b) => {
          const detail = [b.district, b.address].filter(Boolean).join(" · ");
          return (
            <form key={b.id} action={formAction}>
              <input type="hidden" name="branchId" value={b.id} />
              <input type="hidden" name="next" value={next} />
              <button
                type="submit"
                disabled={pending}
                className="w-full h-full text-left rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] hover:border-[var(--oc-accent)]/50 hover:bg-[var(--oc-panel2)] transition-colors p-4 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="font-semibold text-[var(--oc-ink)]">{b.name}</div>
                {detail ? (
                  <div className="mt-1 text-xs text-[var(--oc-muted3)]">{detail}</div>
                ) : null}
                {b.openTime && b.closeTime ? (
                  <div className="mt-1.5 font-plex-mono text-[11px] text-[var(--oc-muted3)]">
                    {b.openTime}–{b.closeTime}
                  </div>
                ) : null}
              </button>
            </form>
          );
        })}

        {allowAllBranches ? (
          <form action={formAction}>
            <input type="hidden" name="branchId" value={ALL_BRANCHES} />
            <input type="hidden" name="next" value={next} />
            <button
              type="submit"
              disabled={pending}
              className="w-full h-full text-left rounded-[10px] border border-dashed border-[var(--oc-accent)]/40 bg-[var(--oc-accent)]/[0.05] hover:bg-[var(--oc-accent)]/[0.1] transition-colors p-4 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="font-semibold text-[var(--oc-accent)]">Бүх салбар</div>
              <div className="mt-1 text-xs text-[var(--oc-muted3)]">
                Бүх салбарын өгөгдлийг нэгэн зэрэг харах
              </div>
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
