import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSystemSessionCookie } from "./system-cookies";
import {
  verifySystemSession,
  type SystemSessionPayload,
} from "./system-session";

export type { SystemSessionPayload } from "./system-session";

export const getSystemSession = cache(
  async (): Promise<SystemSessionPayload | null> => {
    const token = await getSystemSessionCookie();
    if (!token) return null;
    return verifySystemSession(token);
  },
);

export async function requireSystemSession(): Promise<SystemSessionPayload> {
  const session = await getSystemSession();
  if (!session) redirect("/system/login");
  return session;
}

export const requireSuperAdmin = cache(async () => {
  const session = await requireSystemSession();
  const admin = await prisma.superAdmin.findUnique({
    where: { id: session.adminId },
  });
  if (!admin) redirect("/system/login");
  return admin;
});
