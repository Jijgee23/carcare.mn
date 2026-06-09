"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession, requireUser } from "@/lib/auth";
import { clearSessionCookie } from "@/lib/auth/cookies";
import {
  revokeOtherUserSessions,
  revokeUserSession,
} from "@/lib/auth/user-session";

/** Тодорхой нэвтрэлтийг (төхөөрөмжийг) гаргах. Өөрийн идэвхтэйг гаргавал logout. */
export async function revokeSessionAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const session = await getSession();
  const id = ((formData.get("id") as string) ?? "").trim();
  if (!id) return;

  await revokeUserSession(id, user.id);

  if (session?.sid === id) {
    await clearSessionCookie();
    redirect("/page/login");
  }
  revalidatePath("/dashboard/profile");
}

/** Энэ төхөөрөмжөөс бусад бүх нэвтрэлтийг гаргах. */
export async function revokeOtherSessionsAction(): Promise<void> {
  const user = await requireUser();
  const session = await getSession();
  if (!session?.sid) return;
  await revokeOtherUserSessions(user.id, session.sid);
  revalidatePath("/dashboard/profile");
}
