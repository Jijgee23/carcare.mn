"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  type BranchDurationActionState,
  setBranchCategoryDurationAction,
} from "@/app/_actions/branch-category-durations";
import { Btn } from "@/app/_components/landing-ops-ui";
import { formatDuration } from "@/lib/category-duration";
import { DurationHmInput } from "./duration-input";

export type BranchDurationRow = {
  id: string;
  name: string;
  defaultMinutes: number | null;
  overrideMinutes: number | null;
  effectiveMinutes: number;
};

export type BranchOpt = { id: string; name: string };

export function BranchDurationsSection({
  rows,
  branches,
  currentBranchId,
  currentBranchName,
  canSwitchBranch,
  formBranchId,
}: {
  rows: BranchDurationRow[];
  branches: BranchOpt[];
  currentBranchId: string;
  currentBranchName: string;
  canSwitchBranch: boolean;
  formBranchId: string | null;
}) {
  return (
    <div className="flex flex-col gap-5">
      {canSwitchBranch ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-[var(--oc-muted3)]">Салбар сонгох</span>
          <div className="flex flex-wrap gap-2">
            {branches.map((b) => {
              const active = b.id === currentBranchId;
              return (
                <Link
                  key={b.id}
                  href={`/dashboard/services/durations?branch=${b.id}`}
                  className={`text-sm rounded-lg px-2.5 py-1.5 border transition-colors ${
                    active
                      ? "border-[var(--oc-accent)] text-[var(--oc-accent-hi)] bg-[var(--oc-accent)]/10"
                      : "border-[var(--oc-line)] text-[var(--oc-ink2)] hover:border-[var(--oc-line2)]"
                  }`}
                >
                  {b.name}
                </Link>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="text-xs text-[var(--oc-muted3)]">
          Салбар: <span className="text-[var(--oc-ink2)]">{currentBranchName}</span>
        </p>
      )}

      {rows.length === 0 ? (
        <p className="text-xs text-[var(--oc-muted3)]">
          Энэ салбарт санал болгож буй ангилал алга байна.
        </p>
      ) : (
        <div className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] overflow-hidden overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="border-b border-[var(--oc-line)]">
                <th className="text-left font-plex-mono text-[10.5px] uppercase tracking-[0.08em] text-[var(--oc-muted3)] font-medium px-4 py-2.5">
                  Ангилал
                </th>
                <th className="text-left font-plex-mono text-[10.5px] uppercase tracking-[0.08em] text-[var(--oc-muted3)] font-medium px-4 py-2.5 w-32">
                  Нийтлэг
                </th>
                <th className="text-left font-plex-mono text-[10.5px] uppercase tracking-[0.08em] text-[var(--oc-muted3)] font-medium px-4 py-2.5 w-32">
                  Одоо
                </th>
                <th className="text-left font-plex-mono text-[10.5px] uppercase tracking-[0.08em] text-[var(--oc-muted3)] font-medium px-4 py-2.5 w-80">
                  Салбарын хугацаа
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--oc-line)]">
              {rows.map((r) => (
                <DurationRow key={r.id} row={r} formBranchId={formBranchId} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DurationRow({
  row,
  formBranchId,
}: {
  row: BranchDurationRow;
  formBranchId: string | null;
}) {
  const [state, formAction, pending] = useActionState<
    BranchDurationActionState,
    FormData
  >(setBranchCategoryDurationAction, null);

  const fieldError = state?.fieldErrors?.[row.id];

  return (
    <tr className="hover:bg-white/[0.02] transition-colors">
      <td className="px-4 py-3 text-[var(--oc-ink)]">{row.name}</td>
      <td className="px-4 py-3 font-plex-mono text-xs text-[var(--oc-muted3)] whitespace-nowrap">
        {row.defaultMinutes != null ? formatDuration(row.defaultMinutes) : "30 мин*"}
      </td>
      <td className="px-4 py-3 font-plex-mono text-xs text-[var(--oc-muted2)] whitespace-nowrap">
        {formatDuration(row.effectiveMinutes)}
        {row.overrideMinutes != null ? (
          <span className="ml-1 text-[var(--oc-accent-hi)]" title="Салбар-тусгай">
            •
          </span>
        ) : null}
      </td>
      <td className="px-4 py-3">
        <form action={formAction} className="flex flex-col gap-1">
          <input type="hidden" name="categoryId" value={row.id} />
          {formBranchId ? (
            <input type="hidden" name="branchId" value={formBranchId} />
          ) : null}
          <div className="flex items-center gap-2">
            <div title="Хоосон орхиж хадгалбал салбарын тохиргоо цэвэрлэгдэж, default руу буцна.">
              <DurationHmInput
                defaultMinutes={row.overrideMinutes}
                invalid={!!fieldError}
                compact
              />
            </div>
            <Btn type="submit" disabled={pending} size="sm">
              {pending ? "..." : "Хадгалах"}
            </Btn>
          </div>
          {fieldError ? (
            <span className="text-red-400 text-xs light:text-red-600">
              {fieldError}
            </span>
          ) : state?.message ? (
            <span
              className={`text-xs ${
                state.ok ? "text-[var(--oc-ok)]" : "text-red-400 light:text-red-600"
              }`}
            >
              {state.message}
            </span>
          ) : null}
        </form>
      </td>
    </tr>
  );
}
