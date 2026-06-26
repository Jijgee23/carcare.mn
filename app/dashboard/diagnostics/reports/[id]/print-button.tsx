"use client";

import { useState } from "react";

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
      className="no-print text-xs px-3 py-1.5 rounded-lg bg-violet-500/15 text-violet-200 hover:bg-violet-500/25 border border-violet-400/20 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
    >
      {isGenerating ? "Хүлээнэ үү..." : "PDF татах"}
    </button>
  );
}
