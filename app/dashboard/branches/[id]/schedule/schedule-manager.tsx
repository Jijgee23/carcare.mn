"use client";

import { useActionState, useState } from "react";
import { Field, FormError } from "@/app/_components/auth-shell";
import { ConfirmForm } from "@/app/_components/confirm-form";
import { Btn } from "@/app/_components/landing-ops-ui";
import { Select } from "@/app/_components/select";
import {
  deleteBranchScheduleExceptionAction,
  deleteBranchScheduleSeasonAction,
  upsertBranchScheduleExceptionAction,
  upsertBranchScheduleSeasonAction,
  type BranchScheduleActionState,
} from "@/app/_actions/branch-schedules";
import { WEEK_DAYS, type Weekday } from "@/lib/branches";

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const value = `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 === 0 ? "00" : "30"}`;
  return { value, label: value };
});

type ExceptionItem = {
  id: string;
  date: string;
  isOpen: boolean;
  openTime: string | null;
  closeTime: string | null;
  label: string | null;
};

type SeasonItem = {
  id: string;
  name: string;
  startsOn: string;
  endsOn: string;
  days: Record<Weekday, { isOpen: boolean; openTime: string; closeTime: string }>;
};

type Props = {
  branchId: string;
  exceptions: ExceptionItem[];
  seasons: SeasonItem[];
  baseDays: Record<Weekday, { isOpen: boolean; openTime: string; closeTime: string }>;
};

export function BranchScheduleManager({ branchId, exceptions, seasons, baseDays }: Props) {
  const [exceptionState, exceptionAction, exceptionPending] = useActionState<BranchScheduleActionState, FormData>(
    upsertBranchScheduleExceptionAction.bind(null, branchId), null,
  );
  const [seasonState, seasonAction, seasonPending] = useActionState<BranchScheduleActionState, FormData>(
    upsertBranchScheduleSeasonAction.bind(null, branchId), null,
  );
  const [exceptionOpen, setExceptionOpen] = useState(false);
  const [seasonOpen, setSeasonOpen] = useState(false);
  const [exception, setException] = useState<ExceptionItem>({ id: "", date: "", isOpen: false, openTime: "", closeTime: "", label: "" });
  const [season, setSeason] = useState<SeasonItem>(() => newSeason(baseDays));

  function editException(item: ExceptionItem) {
    setException(item);
    setExceptionOpen(true);
  }

  function editSeason(item: SeasonItem) {
    setSeason(item);
    setSeasonOpen(true);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="font-semibold text-[var(--oc-ink)]">Нэг удаагийн тусгай өдөр</h2>
            <p className="text-xs text-[var(--oc-muted3)] mt-1">Баяр, амралт, эсвэл тухайн өдрийн өөр цаг.</p>
          </div>
          <Btn type="button" variant="ghost" onClick={() => { setException(newException()); setExceptionOpen(true); }}>Нэмэх</Btn>
        </div>
        {exceptionOpen ? (
          <form action={exceptionAction} className="space-y-4 border-b border-[var(--oc-line)] pb-5 mb-5">
            <input type="hidden" name="exceptionId" value={exception.id} />
            <FormError message={exceptionState?.message} />
            <Field label="Огноо" htmlFor="exception-date" error={exceptionState?.fieldErrors?.date}>
              <input id="exception-date" name="date" type="date" required value={exception.date} onChange={(e) => setException({ ...exception, date: e.target.value })} className="auth-input" />
            </Field>
            <label className="flex items-center gap-2 text-sm text-[var(--oc-ink2)]">
              <input type="checkbox" name="exception_isOpen" checked={exception.isOpen} onChange={(e) => setException({ ...exception, isOpen: e.target.checked })} className="accent-[var(--oc-accent)]" />
              Энэ өдөр ажиллана
            </label>
            {exception.isOpen ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Нээх" htmlFor="exception-open" error={exceptionState?.fieldErrors?.exception_openTime}>
                  <Select id="exception-open" name="exception_openTime" value={exception.openTime ?? ""} onChange={(v) => setException({ ...exception, openTime: v })} options={TIME_OPTIONS} placeholder="—" />
                </Field>
                <Field label="Хаах" htmlFor="exception-close" error={exceptionState?.fieldErrors?.exception_closeTime}>
                  <Select id="exception-close" name="exception_closeTime" value={exception.closeTime ?? ""} onChange={(v) => setException({ ...exception, closeTime: v })} options={TIME_OPTIONS} placeholder="—" />
                </Field>
              </div>
            ) : null}
            <Field label="Тайлбар" htmlFor="exception-label" error={exceptionState?.fieldErrors?.label}>
              <input id="exception-label" name="label" value={exception.label ?? ""} onChange={(e) => setException({ ...exception, label: e.target.value })} className="auth-input" placeholder="Наадам" />
            </Field>
            <div className="flex gap-2">
              <Btn type="submit" disabled={exceptionPending}>{exceptionPending ? "..." : "Хадгалах"}</Btn>
              <Btn type="button" variant="ghost" onClick={() => setExceptionOpen(false)}>Болих</Btn>
            </div>
          </form>
        ) : null}
        {exceptions.length === 0 ? <p className="text-sm text-[var(--oc-muted3)]">Тусгай өдөр тохируулаагүй.</p> : (
          <div className="space-y-2">
            {exceptions.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--oc-line)] bg-[var(--oc-panel2)] px-3 py-3">
                <div>
                  <div className="font-plex-mono text-sm text-[var(--oc-ink)]">{item.date} · {item.isOpen ? `${item.openTime}–${item.closeTime}` : "Амрана"}</div>
                  <div className="text-xs text-[var(--oc-muted3)]">{item.label || "Тусгай өдөр"}</div>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => editException(item)} className="text-xs text-[var(--oc-accent)]">Засах</button>
                  <ConfirmForm action={deleteBranchScheduleExceptionAction} message={`${item.date} тусгай өдрийн тохиргоог устгах уу?`}><input type="hidden" name="branchId" value={branchId} /><input type="hidden" name="id" value={item.id} /><button type="submit" className="text-xs text-red-400">Устгах</button></ConfirmForm>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="font-semibold text-[var(--oc-ink)]">Улирлын хуваарь</h2>
            <p className="text-xs text-[var(--oc-muted3)] mt-1">Давхцахгүй хугацаанд долоо хоногийн цагийг өөрчилнө.</p>
          </div>
          <Btn type="button" variant="ghost" onClick={() => { setSeason(newSeason(baseDays)); setSeasonOpen(true); }}>Нэмэх</Btn>
        </div>
        {seasonOpen ? (
          <form action={seasonAction} className="space-y-4 border-b border-[var(--oc-line)] pb-5 mb-5">
            <input type="hidden" name="seasonId" value={season.id} />
            <FormError message={seasonState?.message} />
            <Field label="Нэр" htmlFor="season-name" error={seasonState?.fieldErrors?.name}>
              <input id="season-name" name="name" required value={season.name} onChange={(e) => setSeason({ ...season, name: e.target.value })} className="auth-input" placeholder="Зуны цаг" />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Эхлэх" htmlFor="season-start" error={seasonState?.fieldErrors?.startsOn}>
                <input id="season-start" name="startsOn" type="date" required value={season.startsOn} onChange={(e) => setSeason({ ...season, startsOn: e.target.value })} className="auth-input" />
              </Field>
              <Field label="Дуусах" htmlFor="season-end" error={seasonState?.fieldErrors?.endsOn}>
                <input id="season-end" name="endsOn" type="date" required value={season.endsOn} onChange={(e) => setSeason({ ...season, endsOn: e.target.value })} className="auth-input" />
              </Field>
            </div>
            <div className="space-y-2">
              {WEEK_DAYS.map((day) => {
                const value = season.days[day.value];
                return <div key={day.value} className="grid gap-2 sm:grid-cols-[100px_1fr_1fr] items-center rounded-lg border border-[var(--oc-line)] px-2 py-2">
                  <label className="flex items-center gap-2 text-xs text-[var(--oc-ink2)]"><input type="checkbox" name={`season_${day.value}_isOpen`} checked={value.isOpen} onChange={(e) => setSeason({ ...season, days: { ...season.days, [day.value]: { ...value, isOpen: e.target.checked } } })} className="accent-[var(--oc-accent)]" />{day.short}</label>
                  <Select name={`season_${day.value}_openTime`} value={value.openTime} onChange={(v) => setSeason({ ...season, days: { ...season.days, [day.value]: { ...value, openTime: v } } })} options={TIME_OPTIONS} placeholder="Нээх" />
                  <Select name={`season_${day.value}_closeTime`} value={value.closeTime} onChange={(v) => setSeason({ ...season, days: { ...season.days, [day.value]: { ...value, closeTime: v } } })} options={TIME_OPTIONS} placeholder="Хаах" />
                </div>;
              })}
            </div>
            <div className="flex gap-2"><Btn type="submit" disabled={seasonPending}>{seasonPending ? "..." : "Хадгалах"}</Btn><Btn type="button" variant="ghost" onClick={() => setSeasonOpen(false)}>Болих</Btn></div>
          </form>
        ) : null}
        {seasons.length === 0 ? <p className="text-sm text-[var(--oc-muted3)]">Улирлын хуваарь тохируулаагүй.</p> : (
          <div className="space-y-2">{seasons.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--oc-line)] bg-[var(--oc-panel2)] px-3 py-3"><div><div className="font-medium text-sm text-[var(--oc-ink)]">{item.name}</div><div className="font-plex-mono text-xs text-[var(--oc-muted3)]">{item.startsOn} → {item.endsOn}</div></div><div className="flex gap-2"><button type="button" onClick={() => editSeason(item)} className="text-xs text-[var(--oc-accent)]">Засах</button><ConfirmForm action={deleteBranchScheduleSeasonAction} message={`${item.name} улирлын хуваарийг устгах уу?`}><input type="hidden" name="branchId" value={branchId} /><input type="hidden" name="id" value={item.id} /><button type="submit" className="text-xs text-red-400">Устгах</button></ConfirmForm></div></div>)}</div>
        )}
      </section>
    </div>
  );
}

function newException(): ExceptionItem {
  return { id: "", date: "", isOpen: false, openTime: "", closeTime: "", label: "" };
}

function newSeason(baseDays: Props["baseDays"]): SeasonItem {
  const days = {} as SeasonItem["days"];
  for (const day of WEEK_DAYS) {
    const base = baseDays[day.value];
    days[day.value] = { isOpen: base.isOpen, openTime: base.openTime, closeTime: base.closeTime };
  }
  return { id: "", name: "", startsOn: "", endsOn: "", days };
}
