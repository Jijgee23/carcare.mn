"use client";

import { useCallback, useEffect, useState } from "react";
import { Modal } from "@/app/_components/modal";

// QA #14: хүлээн авах бүртгэл — захиалга үүсгэх үед бичигдсэн, зөвхөн унших.
// Хуудсыг уртасгахгүйн тулд товч хураангуй + modal-д бүрэн харагдана.

type Props = {
  notes: string | null;
  photos: { id: string; path: string }[];
  signaturePath: string | null;
  // Огноог server дээр UB цагаар форматлана (hydration зөрөхгүй).
  recordedAtLabel: string | null;
  recordedBy: string | null;
};

export function IntakeRecord({ notes, photos, signaturePath, recordedAtLabel, recordedBy }: Props) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  if (!recordedAtLabel) {
    return <p className="text-sm text-[var(--oc-muted3)]">Хүлээн авах бүртгэл хийгээгүй.</p>;
  }

  const summary = [
    notes ? "тэмдэглэл" : null,
    photos.length > 0 ? `${photos.length} зураг` : null,
    signaturePath ? "гарын үсэг" : null,
  ].filter(Boolean);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-between gap-3 rounded-md border border-[var(--oc-line)] px-3 py-2 text-left hover:bg-[var(--oc-line2)]"
      >
        <span className="min-w-0">
          <span className="block text-sm font-medium text-[var(--oc-ink2)]">🔒 Хүлээн авах</span>
          <span className="block truncate text-[11px] text-[var(--oc-muted3)]">
            {summary.join(" · ") || "хоосон"}
          </span>
        </span>
        <span className="shrink-0 text-xs text-[var(--oc-muted2)]">Харах →</span>
      </button>

      <Modal open={open} onClose={close} title="Хүлээн авах" widthClassName="max-w-3xl">
        <IntakeDetails
          notes={notes}
          photos={photos}
          signaturePath={signaturePath}
          recordedAtLabel={recordedAtLabel}
          recordedBy={recordedBy}
        />
      </Modal>
    </>
  );
}

function IntakeDetails({ notes, photos, signaturePath, recordedAtLabel, recordedBy }: Props) {
  const [viewing, setViewing] = useState<number | null>(null);

  // Томруулсан зураг дээр ←/→ товчоор шилжинэ.
  useEffect(() => {
    if (viewing === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") setViewing((i) => (i === null ? i : (i + 1) % photos.length));
      if (e.key === "ArrowLeft") setViewing((i) => (i === null ? i : (i - 1 + photos.length) % photos.length));
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [viewing, photos.length]);

  if (viewing !== null && photos[viewing]) {
    const photo = photos[viewing];
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between text-xs text-[var(--oc-muted2)]">
          <button type="button" onClick={() => setViewing(null)} className="underline">
            ← Бүх зураг
          </button>
          <span>
            {viewing + 1}/{photos.length}
          </span>
        </div>
        <div className="relative flex items-center justify-center rounded-md bg-black/40">
          {/* eslint-disable-next-line @next/next/no-img-element -- /uploads нь runtime файл */}
          <img src={photo.path} alt={`Хүлээн авах зураг ${viewing + 1}`} className="max-h-[65vh] w-auto object-contain" />
          {photos.length > 1 ? (
            <>
              <button
                type="button"
                onClick={() => setViewing((viewing - 1 + photos.length) % photos.length)}
                aria-label="Өмнөх зураг"
                className="absolute left-2 rounded-full bg-black/60 px-3 py-2 text-white hover:bg-black/80"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => setViewing((viewing + 1) % photos.length)}
                aria-label="Дараагийн зураг"
                className="absolute right-2 rounded-full bg-black/60 px-3 py-2 text-white hover:bg-black/80"
              >
                ›
              </button>
            </>
          ) : null}
        </div>
        <a href={photo.path} target="_blank" rel="noreferrer" className="self-end text-xs text-[var(--oc-muted2)] underline">
          Эх зургийг нээх
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md bg-[var(--oc-panel2)] px-3 py-2 text-xs text-[var(--oc-muted2)]">
        <span>
          Бүртгэсэн: <strong className="text-[var(--oc-ink2)]">{recordedBy ?? "—"}</strong>
        </span>
        <span>{recordedAtLabel}</span>
        <span>🔒 Үүсгэсний дараа засагдахгүй</span>
      </div>

      <section>
        <h3 className="mb-1.5 text-xs font-medium text-[var(--oc-muted3)]">Тэмдэглэл</h3>
        {notes ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--oc-ink2)]">{notes}</p>
        ) : (
          <p className="text-sm text-[var(--oc-muted3)]">—</p>
        )}
      </section>

      <section>
        <h3 className="mb-1.5 text-xs font-medium text-[var(--oc-muted3)]">Зураг ({photos.length})</h3>
        {photos.length > 0 ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {photos.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setViewing(i)}
                aria-label={`Зураг ${i + 1} томруулах`}
                className="block overflow-hidden rounded-md border border-[var(--oc-line)] hover:opacity-90"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- /uploads нь runtime файл */}
                <img src={p.path} alt={`Хүлээн авах зураг ${i + 1}`} className="aspect-square w-full object-cover" />
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--oc-muted3)]">—</p>
        )}
      </section>

      <section>
        <h3 className="mb-1.5 text-xs font-medium text-[var(--oc-muted3)]">Үйлчлүүлэгчийн гарын үсэг</h3>
        {signaturePath ? (
          // eslint-disable-next-line @next/next/no-img-element -- /uploads нь runtime файл
          <img
            src={signaturePath}
            alt="Үйлчлүүлэгчийн гарын үсэг"
            className="h-24 rounded-md border border-[var(--oc-line)] bg-white"
          />
        ) : (
          <p className="text-sm text-[var(--oc-muted3)]">Гарын үсэг аваагүй.</p>
        )}
      </section>
    </div>
  );
}
