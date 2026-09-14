"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Btn, PlusIcon } from "@/app/_components/landing-ops-ui";
import { Modal } from "@/app/_components/modal";
import { ServiceKeyForm } from "./service-key-form";

export function CreateServiceKeyButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Btn type="button" onClick={() => setOpen(true)}>
        <PlusIcon />
        Нэмэх
      </Btn>
      <Modal open={open} onClose={() => setOpen(false)} title="Шинэ ажлын түлхүүр">
        <ServiceKeyForm
          onSuccess={() => {
            router.refresh();
            setOpen(false);
          }}
        />
      </Modal>
    </>
  );
}
