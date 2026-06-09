"use server";

import { requireUser } from "@/lib/auth";
import { requireAccount } from "@/lib/auth/account";
import { parseDeviceInput, registerDevice } from "@/lib/devices";

export type DeviceActionResult = { ok: boolean; error?: string };

/**
 * Web дээр Account (хэрэглэгч) FCM token бүртгэх. Клиент firebase web SDK-аас
 * token аваад дуудна.
 */
export async function registerAccountDevice(
  input: unknown,
): Promise<DeviceActionResult> {
  const account = await requireAccount();
  const parsed = parseDeviceInput(input);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  await registerDevice({ accountId: account.id }, parsed.data);
  return { ok: true };
}

/**
 * Web дээр ажилтан (User) FCM token бүртгэх (dashboard push мэдэгдэлд).
 */
export async function registerUserDevice(
  input: unknown,
): Promise<DeviceActionResult> {
  const user = await requireUser();
  const parsed = parseDeviceInput(input);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  await registerDevice({ userId: user.id }, parsed.data);
  return { ok: true };
}
