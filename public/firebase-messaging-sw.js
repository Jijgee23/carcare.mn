/* Firebase Cloud Messaging — фон (background) мессежийн service worker.
 * Config-ийг бүртгэх үед query-аар дамжуулна (?firebaseConfig=...), тул
 * энд нууц/тогтмол утга шигтгэхгүй. compat SDK-г gstatic-аас ачаална. */
importScripts(
  "https://www.gstatic.com/firebasejs/12.14.0/firebase-app-compat.js",
);
importScripts(
  "https://www.gstatic.com/firebasejs/12.14.0/firebase-messaging-compat.js",
);

let cfg = {};
try {
  cfg = JSON.parse(
    new URL(self.location).searchParams.get("firebaseConfig") || "{}",
  );
} catch (e) {
  console.error("Failed to parse firebaseConfig:", e);
  cfg = {};
}

if (cfg && cfg.apiKey) {
  firebase.initializeApp(cfg);
  const messaging = firebase.messaging();
  messaging.onBackgroundMessage((payload) => {
    const n = (payload && payload.notification) || {};
    self.registration.showNotification(n.title || "Carcare", {
      body: n.body || "",
      data: (payload && payload.data) || {},
    });
  });
}

// Мэдэгдэл дээр дарахад апп нээх.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow("/account"));
});
