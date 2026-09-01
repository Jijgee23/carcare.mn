import {
  getFirebaseTokensForAccount,
  getFirebaseTokensForSuperAdmin,
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

// FCM-ийн хүчингүй болсон token-уудыг таних код — дахин оролдохгүй, шууд цэвэрлэнэ.
const STALE_TOKEN_ERRORS = [
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",
];

// Түр зуурын (сервер/сүлжээний) алдаа — дахин оролдвол амжилттай болох
// магадлалтай тул хүчингүй token-той андуурахгүй тусад нь таних код.
const RETRYABLE_ERRORS = [
  "messaging/internal-error",
  "messaging/server-unavailable",
  "messaging/unknown-error",
  "messaging/message-rate-exceeded",
  "messaging/device-message-rate-exceeded",
];

const MAX_ATTEMPTS = 2; // анхны оролдлого + 1 дахин
const RETRY_DELAY_MS = 400;

// FCM sendEachForMulticast нэг дуудлагад дэмждэг дээд token тоо.
const FCM_MAX_TOKENS_PER_CALL = 500;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Өгөгдсөн FCM token-ууд руу push илгээнэ. Тохируулга байхгүй бол чимээгүй
 * 0 буцаана. Хүчингүй болсон token-уудыг Device-ээс цэвэрлэнэ. Түр зуурын
 * алдаатай token-уудыг богино саатал (400мс)-тайгаар нэг удаа дахин оролдоно.
 *
 * `apns` тохиргоог мессеж бүрт үргэлж хавсаргана — FCM токены платформоор нь
 * тохирох хэсгийг өөрөө сонгож хэрэглэдэг тул push бүрийг платформоор
 * (WEB/ANDROID/IOS) тусад нь илгээх шаардлагагүй. 500-аас олон token ирвэл
 * (жишээ: broadcast) FCM-ийн нэг дуудлагын дээд хязгаараар автоматаар хуваана.
 */
export async function sendPushToTokens(
  tokens: string[],
  payload: PushPayload,
): Promise<PushResult> {
  const messaging = getFirebaseMessaging();
  let pending = [...new Set(tokens)].filter(Boolean);
  if (!messaging || pending.length === 0) return { sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;
  const stale: string[] = [];

  for (let attempt = 1; attempt <= MAX_ATTEMPTS && pending.length > 0; attempt++) {
    if (attempt > 1) await sleep(RETRY_DELAY_MS);

    const retry: string[] = [];
    for (const batch of chunk(pending, FCM_MAX_TOKENS_PER_CALL)) {
      const res = await messaging.sendEachForMulticast({
        tokens: batch,
        notification: { title: payload.title, body: payload.body },
        ...(payload.data ? { data: payload.data } : {}),
        apns: {
          headers: { "apns-priority": "10" },
          payload: { aps: { sound: "default" } },
        },
      });

      res.responses.forEach((r, i) => {
        if (r.success) {
          sent++;
          return;
        }
        const code = r.error?.code ?? "";
        if (STALE_TOKEN_ERRORS.some((c) => code.includes(c))) {
          stale.push(batch[i]);
          failed++;
        } else if (attempt < MAX_ATTEMPTS && RETRYABLE_ERRORS.some((c) => code.includes(c))) {
          retry.push(batch[i]);
        } else {
          failed++;
        }
      });
    }
    pending = retry;
  }

  if (stale.length > 0) {
    await prisma.device.updateMany({
      where: { firebaseToken: { in: stale } },
      data: { firebaseToken: null },
    });
  }

  return { sent, failed };
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

/** Систем админы (SuperAdmin) бүх төхөөрөмж рүү push. */
export async function sendPushToSuperAdmin(
  superAdminId: string,
  payload: PushPayload,
): Promise<PushResult> {
  return sendPushToTokens(await getFirebaseTokensForSuperAdmin(superAdminId), payload);
}
