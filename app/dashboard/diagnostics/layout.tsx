import type { ReactNode } from "react";
import { DiagnosticsTabs } from "./tabs";

export default function DiagnosticsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <DiagnosticsTabs />
      <div className="flex-1 flex flex-col min-h-0">{children}</div>
    </div>
  );
}
