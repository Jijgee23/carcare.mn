import { cookies } from "next/headers";
import {
  ACCOUNT_COOKIE_NAME,
  ACCOUNT_SESSION_MAX_AGE_SECONDS,
} from "./account-session";

export async function setAccountSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(ACCOUNT_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ACCOUNT_SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearAccountSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(ACCOUNT_COOKIE_NAME);
}

export async function getAccountSessionCookie(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(ACCOUNT_COOKIE_NAME)?.value;
}
