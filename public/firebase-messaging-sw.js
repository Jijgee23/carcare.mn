/* Firebase Cloud Messaging — фон (background) мессежийн service worker.
 * Config-ыг ЭНД шууд бичнэ (query string-ээр дамжуулахаас татгалзсан — тэр
 * арга нь register()-ийн URL уртасгаж, encode/parse алдаа гарах эрсдэлтэй,
 * мөн ажилладаг лавлагаа төслүүд (жишээ: online_shop) бүгд шууд шигтгэдэг
 * загварыг ашигладаг). Эдгээр утга бүгд PUBLIC (NEXT_PUBLIC_FIREBASE_*-тай
 * ижил, аль хэдийн клиент bundle-д ил байгаа) — нууц биш. */
importScripts(
  "https://www.gstatic.com/firebasejs/12.14.0/firebase-app-compat.js",
);
importScripts(
  "https://www.gstatic.com/firebasejs/12.14.0/firebase-messaging-compat.js",
);

firebase.initializeApp({
  apiKey: "AIzaSyCbw7gsHS6Th_ph8c8e6CpC-ZYTkpqZthc",
  authDomain: "carcare-bf796.firebaseapp.com",
  projectId: "carcare-bf796",
  messagingSenderId: "17267525827",
  appId: "1:17267525827:web:f1241072cd24cb96fffa76",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const n = (payload && payload.notification) || {};
  self.registration.showNotification(n.title || "Carcare", {
    body: n.body || "",
    data: (payload && payload.data) || {},
  });
});

// Мэдэгдэл дээр дарахад апп нээх.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow("/account"));
});
