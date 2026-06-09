import {
  getFirebaseTokensForAccount,
  getFirebaseTokensForUser,
} from "@/lib/devices";
import { getFirebaseMessaging } from "@/lib/firebase-admin";
import { prisma } from "@/lib/prisma";

export type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, string>; // FCM data — бүгд string байх ёстой
};

export type PushResult = { sent: number; failed: number };

// FCM-ийн хүчингүй болсон token-уудыг таних код.
const STALE_TOKEN_ERRORS = [
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",
];

/**
 * Өгөгдсөн FCM token-ууд руу push илгээнэ. Тохируулга байхгүй бол чимээгүй
 * 0 буцаана. Хүчингүй болсон token-уудыг Device-ээс цэвэрлэнэ.
 */
export async function sendPushToTokens(
  tokens: string[],
  payload: PushPayload,
): Promise<PushResult> {
  const messaging = getFirebaseMessaging();
  const unique = [...new Set(tokens)].filter(Boolean);
  if (!messaging || unique.length === 0) return { sent: 0, failed: 0 };

  const res = await messaging.sendEachForMulticast({
    tokens: unique,
    notification: { title: payload.title, body: payload.body },
    ...(payload.data ? { data: payload.data } : {}),
  });

  const stale: string[] = [];
  res.responses.forEach((r, i) => {
    if (!r.success) {
      const code = r.error?.code ?? "";
      if (STALE_TOKEN_ERRORS.some((c) => code.includes(c))) {
        stale.push(unique[i]);
      }
    }
  });
  if (stale.length > 0) {
    await prisma.device.updateMany({
      where: { firebaseToken: { in: stale } },
      data: { firebaseToken: null },
    });
  }

  return { sent: res.successCount, failed: res.failureCount };
}

/** Ажилтны (User) бүх төхөөрөмж рүү push. */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<PushResult> {
  return sendPushToTokens(await getFirebaseTokensForUser(userId), payload);
}

/** Хэрэглэгчийн (Account) бүх төхөөрөмж рүү push. */
export async function sendPushToAccount(
  accountId: string,
  payload: PushPayload,
): Promise<PushResult> {
  return sendPushToTokens(await getFirebaseTokensForAccount(accountId), payload);
}
