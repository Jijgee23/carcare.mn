"use client";

import { getToken, onMessage } from "firebase/messaging";
import { useEffect, useState } from "react";
import {
  registerAccountDevice,
  registerUserDevice,
} from "@/app/_actions/devices";
import {
  firebaseConfig,
  getClientMessaging,
  isFirebaseConfigured,
  vapidKey,
} from "@/lib/firebase-client";

type Status =
  | "idle"
  | "unsupported"
  | "working"
  | "granted"
  | "denied"
  | "error";

const DEVICE_ID_KEY = "carcare:webPushDeviceId";

function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

function osFromUA(ua: string): string {
  if (/Windows/.test(ua)) return "Windows";
  if (/Android/.test(ua)) return "Android";
  if (/iPhone|iPad|iPod/.test(ua)) return "iOS";
  if (/Mac OS X|Macintosh/.test(ua)) return "macOS";
  if (/Linux/.test(ua)) return "Linux";
  return "Web";
}

export function WebPushToggle({ target }: { target: "account" | "user" }) {
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    let cancelled = false;
    async function init() {
      if (!isFirebaseConfigured() || typeof Notification === "undefined") {
        if (!cancelled) setStatus("unsupported");
        return;
      }
      if (Notification.permission === "granted") {
        await enable(true); // зөвшөөрсөн бол token-оо чимээгүй шинэчилнэ
      } else if (Notification.permission === "denied") {
        if (!cancelled) setStatus("denied");
      }
    }
    void init();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function enable(silent = false) {
    setStatus("working");
    try {
      const messaging = await getClientMessaging();
      if (!messaging || !vapidKey) {
        setStatus("unsupported");
        return;
      }

      const perm = silent
        ? Notification.permission
        : await Notification.requestPermission();
      if (perm !== "granted") {
        setStatus(perm === "denied" ? "denied" : "idle");
        return;
      }

      // Өмнө буруу үндсэн (/) scope-д бүртгэгдсэн firebase SW байвал устгана —
      // тэр нь апп-ийн chunk ачаалалд саад болж "module factory" алдаа гаргадаг.
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const r of regs) {
          if (
            r.active?.scriptURL.includes("firebase-messaging-sw") &&
            new URL(r.scope).pathname === "/"
          ) {
            await r.unregister();
          }
        }
      } catch {
        // ignore
      }

      // SW-ийг НАРИЙН scope-д бүртгэнэ — бүх апп-ийн навигацийг "удирдаж",
      // chunk ачаалалд саад болохоос сэргийлнэ (FCM-ийн жишиг scope).
      const reg = await navigator.serviceWorker.register(
        `/firebase-messaging-sw.js?firebaseConfig=${encodeURIComponent(
          JSON.stringify(firebaseConfig),
        )}`,
        { scope: "/firebase-cloud-messaging-push-scope" },
      );

      const token = await getToken(messaging, {
        vapidKey,
        serviceWorkerRegistration: reg,
      });
      if (!token) {
        setStatus("error");
        return;
      }

      const ua = navigator.userAgent;
      const input = {
        deviceId: getDeviceId(),
        platform: "WEB",
        firebaseToken: token,
        name: ua.slice(0, 120),
        model: navigator.platform || null,
        os: osFromUA(ua),
      };
      const res =
        target === "account"
          ? await registerAccountDevice(input)
          : await registerUserDevice(input);
      if (!res.ok) {
        setStatus("error");
        return;
      }

      // Foreground мессеж — энгийн Notification болгож харуулна.
      onMessage(messaging, (payload) => {
        const n = payload.notification;
        if (n && Notification.permission === "granted") {
          new Notification(n.title ?? "Carcare", { body: n.body ?? "" });
        }
      });

      setStatus("granted");
    } catch (e) {
      console.error("[web-push]", e);
      setStatus("error");
    }
  }

  if (status === "unsupported") return null;

  if (status === "granted") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-300">
        <span className="w-2 h-2 rounded-full bg-emerald-400" />
        Мэдэгдэл идэвхтэй
      </span>
    );
  }

  if (status === "denied") {
    return (
      <span className="text-xs text-white/40">
        Мэдэгдэл блоклогдсон — хөтчийн тохиргооноос зөвшөөрнө үү.
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={status === "working"}
      onClick={() => enable(false)}
      className="text-sm border border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.08] disabled:opacity-60 px-4 py-2 rounded-lg transition-colors"
    >
      {status === "working"
        ? "Тохируулж байна..."
        : status === "error"
          ? "Дахин оролдох"
          : "🔔 Мэдэгдэл асаах"}
    </button>
  );
}
