"use client";

import { useState } from "react";
import { btnClass } from "@/app/_components/landing-ops-ui";

export function PrintButton() {
  const [isGenerating, setIsGenerating] = useState(false);

  const handlePrint = async () => {
    // Browser-н өндөрлөг print API ашиглаж PDF болгон хадгалах
    window.print();
  };

  const handleDownloadPDF = async () => {
    setIsGenerating(true);
    try {
      // Хэвлэх цонхоор дамжуулан PDF болгон хадгалахаас өмнө
      // Хүлээх хугацаа өгөх (browser-н render-ын хугацаа)
      setTimeout(() => {
        window.print();
      }, 100);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleDownloadPDF}
      disabled={isGenerating}
      className={btnClass("ghost", "sm", "no-print")}
    >
      {isGenerating ? "Хүлээнэ үү..." : "PDF татах"}
    </button>
  );
}
