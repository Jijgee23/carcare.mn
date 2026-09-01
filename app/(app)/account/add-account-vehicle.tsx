"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Btn, PlusIcon } from "@/app/_components/landing-ops-ui";
import { InlineAccountVehicleForm } from "./inline-account-vehicle-form";

export function AddAccountVehicle() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Btn variant="ghost" size="md" className="self-start" onClick={() => setOpen(true)}>
        <PlusIcon /> Машин нэмэх
      </Btn>
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
