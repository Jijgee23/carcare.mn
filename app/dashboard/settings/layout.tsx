import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth";

export default async function SettingsLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireUser();
  if (!user.isOwner) {
    redirect("/dashboard/profile");
  }

  return <>{children}</>;
}
