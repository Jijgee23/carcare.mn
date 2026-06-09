import { type FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import { type Messaging, getMessaging, isSupported } from "firebase/messaging";

// Browser (client) талын firebase config — бүгд PUBLIC (нууц биш) тул
// NEXT_PUBLIC_* env-ээр өгнө. Утгуудыг Firebase Console → Project settings →
// Your apps → Web app → SDK config-аас авна. VAPID key нь Cloud Messaging →
// Web Push certificates-аас.
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

export function isFirebaseConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.projectId &&
      firebaseConfig.appId &&
      firebaseConfig.messagingSenderId &&
      vapidKey,
  );
}

function getClientApp(): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

/** Дэмжигдсэн (browser + push support) бол Messaging, үгүй бол null. */
export async function getClientMessaging(): Promise<Messaging | null> {
  if (!isFirebaseConfigured() || typeof window === "undefined") return null;
  try {
    if (!(await isSupported())) return null;
    return getMessaging(getClientApp());
  } catch {
    return null;
  }
}
