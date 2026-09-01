"use server";

import { requireUser } from "@/lib/auth";
import { requireAccount } from "@/lib/auth/account";
import { requireSuperAdmin } from "@/lib/auth/system";
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

/**
 * Web дээр систем админы (SuperAdmin) FCM token бүртгэх (/system push мэдэгдэлд).
 */
export async function registerSuperAdminDevice(
  input: unknown,
): Promise<DeviceActionResult> {
  const admin = await requireSuperAdmin();
  const parsed = parseDeviceInput(input);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  await registerDevice({ superAdminId: admin.id }, parsed.data);
  return { ok: true };
}
