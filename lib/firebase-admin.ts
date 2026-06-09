import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  type App,
  type ServiceAccount,
  cert,
  getApps,
  initializeApp,
} from "firebase-admin/app";
import { type Messaging, getMessaging } from "firebase-admin/messaging";

// Dev-д project root дахь adminsdk файлыг автоматаар уншина (gitignore-д орсон).
const DEFAULT_DEV_FILE = "carcare-bf796-firebase-adminsdk-fbsvc-30c8f58253.json";

// HMR/lambda дахин ачааллахад дахин init хийхгүйн тулд globalThis-д хадгална.
const holder = globalThis as unknown as {
  __carcareFirebaseApp?: App | null;
};

function toServiceAccount(json: unknown): ServiceAccount | null {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  // Татаж авсан JSON нь snake_case (project_id...). camelCase-д буулгана.
  const projectId = (o.projectId ?? o.project_id) as string | undefined;
  const clientEmail = (o.clientEmail ?? o.client_email) as string | undefined;
  const privateKey = (o.privateKey ?? o.private_key) as string | undefined;
  if (!projectId || !clientEmail || !privateKey) return null;
  return { projectId, clientEmail, privateKey };
}

/**
 * Service account-ийг дараах дарааллаар уншина:
 *   1. FIREBASE_SERVICE_ACCOUNT_BASE64  (production — Vercel env-д base64 JSON)
 *   2. FIREBASE_SERVICE_ACCOUNT         (raw JSON string)
 *   3. FIREBASE_SERVICE_ACCOUNT_FILE / dev default файл (local хөгжүүлэлт)
 * Олдохгүй бол null — push идэвхгүй (апп унахгүй).
 */
function loadServiceAccount(): ServiceAccount | null {
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (b64) {
    try {
      return toServiceAccount(
        JSON.parse(Buffer.from(b64, "base64").toString("utf8")),
      );
    } catch {
      // дараагийнхыг оролдоно
    }
  }

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (raw) {
    try {
      return toServiceAccount(JSON.parse(raw));
    } catch {
      // дараагийнхыг оролдоно
    }
  }

  const file =
    process.env.FIREBASE_SERVICE_ACCOUNT_FILE ??
    (process.env.NODE_ENV !== "production" ? DEFAULT_DEV_FILE : undefined);
  if (file) {
    const abs = path.isAbsolute(file) ? file : path.join(process.cwd(), file);
    if (existsSync(abs)) {
      try {
        return toServiceAccount(JSON.parse(readFileSync(abs, "utf8")));
      } catch {
        // унших/parse алдаа
      }
    }
  }

  return null;
}

function getApp(): App | null {
  if (holder.__carcareFirebaseApp !== undefined) {
    return holder.__carcareFirebaseApp;
  }
  const existing = getApps();
  if (existing.length > 0) {
    holder.__carcareFirebaseApp = existing[0];
    return existing[0];
  }
  const sa = loadServiceAccount();
  if (!sa) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[firebase] Service account тохируулаагүй — push notification идэвхгүй.",
      );
    }
    holder.__carcareFirebaseApp = null;
    return null;
  }
  const app = initializeApp({ credential: cert(sa) });
  holder.__carcareFirebaseApp = app;
  return app;
}

/** Тохируулга байгаа бол Messaging, үгүй бол null. */
export function getFirebaseMessaging(): Messaging | null {
  const app = getApp();
  return app ? getMessaging(app) : null;
}

/** Push илгээх боломжтой эсэх (credential тохирсон уу). */
export function isPushConfigured(): boolean {
  return getApp() != null;
}
