"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession, requireUser } from "@/lib/auth";
import { clearSessionCookie } from "@/lib/auth/cookies";
import {
  revokeAccountSession,
  revokeOtherAccountSessions,
  type AccountSessionSource,
} from "@/lib/account/sessions";
import { prisma } from "@/lib/prisma";

/** Тодорхой нэвтрэлтийг (төхөөрөмжийг) гаргах. Өөрийн идэвхтэйг гаргавал logout. */
export async function revokeSessionAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const session = await getSession();
  const id = ((formData.get("id") as string) ?? "").trim();
  const rawSource = ((formData.get("source") as string) ?? "web").trim();
  const source: AccountSessionSource = rawSource === "mobile" ? "mobile" : "web";
  if (!id) return;

  await revokeAccountSession(prisma, user.id, source, id);

  if (source === "web" && session?.sid === id) {
    await clearSessionCookie();
    redirect("/page/login");
  }
  revalidatePath("/dashboard/profile");
}

/** Энэ төхөөрөмжөөс бусад бүх нэвтрэлтийг (web + mobile) гаргах. */
export async function revokeOtherSessionsAction(): Promise<void> {
  const user = await requireUser();
  const session = await getSession();
  if (!session?.sid) return;
  await revokeOtherAccountSessions(prisma, user.id, { currentSessionId: session.sid });
  revalidatePath("/dashboard/profile");
}
