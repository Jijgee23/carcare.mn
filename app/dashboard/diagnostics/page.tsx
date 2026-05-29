import { redirect } from "next/navigation";

export default function DiagnosticsIndex() {
  redirect("/dashboard/diagnostics/reports");
}
