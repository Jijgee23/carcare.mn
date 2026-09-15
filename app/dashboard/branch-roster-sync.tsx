"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { syncWorkingBranchToRosterAction } from "@/app/_actions/auth";
import { Modal } from "@/app/_components/modal";

/**
 * Session-ийн `workingBranchId` өнөөдрийн ажлын хувиараар тогтоосон
 * салбартай зөрсөн үед (жишээ: өчигдрийн сонголт хэвээрээ, эсвэл гараар өөр
 * сонгосон байсан) mount дээрээ автоматаар шинэчилж (session cookie дахин
 * бичих Server Action-аар — RSC render-ийн үед cookie бичих боломжгүй тул),
 * дараа нь нэг удаагийн анхааруулга харуулна. Тохирч байвал юу ч хийхгүй.
 */
export function BranchRosterSync({
  lockedBranchId,
  currentBranchId,
}: {
  lockedBranchId: string | null;
  currentBranchId: string | null;
}) {
  const router = useRouter();
  const [swappedTo, setSwappedTo] = useState<string | null>(null);

  useEffect(() => {
    if (!lockedBranchId || lockedBranchId === currentBranchId) return;
    let cancelled = false;
    syncWorkingBranchToRosterAction().then((res) => {
      if (cancelled) return;
      if (res.swapped && res.branchName) setSwappedTo(res.branchName);
      router.refresh();
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockedBranchId, currentBranchId]);

  if (!swappedTo) return null;

  return (
    <Modal
      open
      onClose={() => setSwappedTo(null)}
      title="Ажиллах салбар автоматаар солигдлоо"
      widthClassName="max-w-sm"
    >
      <p className="text-sm text-[var(--oc-ink2)]">
        Өнөөдрийн ажлын хувиараар таны ажиллах салбар{" "}
        <span className="font-semibold text-[var(--oc-accent)]">{swappedTo}</span> боллоо.
      </p>
      <button
        type="button"
        onClick={() => setSwappedTo(null)}
        className="mt-4 w-full rounded-lg bg-[var(--oc-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--oc-on-accent)] hover:bg-[var(--oc-accent-hi)] transition-colors"
      >
        Ойлголоо
      </button>
    </Modal>
  );
}
