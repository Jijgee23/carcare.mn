"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { InlineAccountVehicleForm } from "./inline-account-vehicle-form";

export function AddAccountVehicle() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start text-sm px-4 py-2 rounded-lg border border-violet-500/30 bg-violet-500/10 hover:bg-violet-500/20 text-violet-200 font-medium transition-colors"
      >
        + Машин нэмэх
      </button>
    );
  }

  return (
    <InlineAccountVehicleForm
      onCreated={() => {
        setOpen(false);
        router.refresh();
      }}
      onCancel={() => setOpen(false)}
    />
  );
}
