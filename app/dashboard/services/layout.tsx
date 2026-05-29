import type { ReactNode } from "react";
import { ServicesTabs } from "./tabs";

export default function ServicesLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <ServicesTabs />
      <div className="flex-1 flex flex-col min-h-0">{children}</div>
    </div>
  );
}
