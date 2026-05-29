import { cookies } from "next/headers";
import {
  SYSTEM_COOKIE_NAME,
  SYSTEM_SESSION_MAX_AGE_SECONDS,
} from "./system-session";

export async function setSystemSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(SYSTEM_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SYSTEM_SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearSystemSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SYSTEM_COOKIE_NAME);
}

export async function getSystemSessionCookie(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(SYSTEM_COOKIE_NAME)?.value;
}
