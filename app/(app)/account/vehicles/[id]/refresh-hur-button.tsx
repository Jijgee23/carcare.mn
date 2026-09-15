"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { refreshVehicleFromHur } from "@/app/_actions/account-vehicles";
import { useToast } from "@/app/_components/toast";

/**
 * Машины дэлгэрэнгүй хуудасны баруун дээд буланд байрлах "HUR-аас шинэчлэх"
 * товч. Дарахад шууд серверийн `refreshVehicleFromHur`-ыг дуудаж (тусад нь
 * форм/review алхамгүй) амжилттай бол хуудсыг сервер талд дахин зурна
 * (`revalidatePath`-ийн ачаар `router.refresh()`-гүйгээр ч шинэ утгууд
 * харагдана) — доорх мэдээллийн блок шууд шинэчлэгдэнэ.
 */
export function RefreshHurButton({ vehicleId }: { vehicleId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      const res = await refreshVehicleFromHur(vehicleId);
      if (res.ok) {
        toast.success("Машины мэдээлэл HUR-аас шинэчлэгдлээ.");
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--oc-line)] bg-[var(--oc-panel2)] px-3 py-1.5 text-xs font-medium text-[var(--oc-ink2)] hover:text-[var(--oc-ink)] hover:border-[var(--oc-accent)]/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={pending ? "animate-spin" : ""}
      >
        <path d="M21 12a9 9 0 1 1-2.64-6.36" />
        <path d="M21 3v6h-6" />
      </svg>
      {pending ? "Шинэчилж байна..." : "HUR-аас шинэчлэх"}
    </button>
  );
}
