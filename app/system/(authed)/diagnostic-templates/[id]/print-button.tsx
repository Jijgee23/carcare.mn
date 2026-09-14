"use client";

import { btnClass } from "@/app/_components/landing-ops-ui";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={btnClass("ghost", "sm", "no-print")}
    >
      Хэвлэх
    </button>
  );
}
