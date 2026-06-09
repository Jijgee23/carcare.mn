# Мобайл client — төхөөрөмж бүртгэх (FCM push)

Мобайл апп нь тусдаа төсөл. Сервер тал (энэ repo) дараах endpoint-уудыг
бэлэн болгосон. Апп нэвтрэх бүрт / FCM token шинэчлэгдэх бүрт төхөөрөмжөө
бүртгэнэ, logout үед хасна.

Бүх `Base URL`: production-д `https://carcare.mn`, dev-д `http://<LAN-IP>:4000`.

---

## 1. Нэвтрэх (Account — утас + OTP)

### Код хүсэх
```
POST /api/v1/app/auth/request-otp
Content-Type: application/json

{ "phone": "99112233" }
→ 200 { "ok": true }
```

### Код баталгаажуулах → accessToken
```
POST /api/v1/app/auth/verify-otp
Content-Type: application/json

{ "phone": "99112233", "code": "123456", "name": "Бат" }   // name заавал биш
→ 200 {
  "accessToken": "<JWT>",
  "expiresInSeconds": 2592000,           // 30 хоног
  "account": { "id": "...", "phone": "99112233", "name": "Бат" }
}
```
`accessToken`-ийг хадгалж, цаашид бүх хүсэлтэд `Authorization: Bearer <accessToken>`
гэж явуулна.

---

## 2. Төхөөрөмж бүртгэх (push token хадгалах)

Нэвтэрсний дараа (эсвэл FCM token шинэчлэгдэхэд) дуудна.

```
POST /api/v1/app/devices
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "deviceId":      "<тогтвортой install id>",   // ЗААВАЛ — uuid, апп дотор хадгална
  "platform":      "ANDROID",                   // ЗААВАЛ — "ANDROID" | "IOS" | "WEB"
  "firebaseToken": "<FCM registration token>",  // push авах token
  "name":          "Bat's iPhone",              // заавал биш
  "model":         "iPhone 14 Pro",             // заавал биш
  "os":            "iOS 17.2"                    // заавал биш
}
→ 200 { "device": { "id": "...", "deviceId": "..." } }
```

Дараах зүйлийг анхаар:
- **`deviceId`** — апп суулгахад нэг удаа үүсгэж (uuid), төхөөрөмж дээр байнга
  хадгална. Сервер үүгээр **upsert** хийдэг тул дахин дуудахад давхардахгүй,
  зүгээр л шинэчилнэ.
- Нэг install дээр өөр хэрэглэгч нэвтэрвэл тухайн `deviceId`-ийн эзэн автоматаар
  шинэ хэрэглэгч рүү шилжинэ.
- `firebaseToken` өөрчлөгдөх бүрт (FCM `onTokenRefresh`) дахин энэ endpoint-ийг
  дуудаж шинэчил.

### Logout үед хасах
```
DELETE /api/v1/app/devices/<deviceId>
Authorization: Bearer <accessToken>
→ 200 { "ok": true }
```

---

## 3. Жишээ (TypeScript / React Native fetch)

```ts
const BASE = "https://carcare.mn";

async function registerDevice(accessToken: string, fcmToken: string) {
  const deviceId = await getOrCreateDeviceId(); // uuid-г AsyncStorage-д хадгал
  await fetch(`${BASE}/api/v1/app/devices`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      deviceId,
      platform: Platform.OS === "ios" ? "IOS" : "ANDROID",
      firebaseToken: fcmToken,
      name: Device.deviceName,        // expo-device
      model: Device.modelName,
      os: `${Platform.OS} ${Platform.Version}`,
    }),
  });
}

// FCM token шинэчлэгдэхэд (firebase messaging onTokenRefresh) дахин register хий.
```

---

## 4. Push мессежийн бүтэц (серверээс ирэх)

Сервер дараах хэлбэрээр илгээнэ (FCM `notification` + `data`):
```jsonc
{
  "notification": { "title": "Цаг баталгаажлаа", "body": "Таны захиалсан цаг баталгаажлаа." },
  "data": { "type": "appointment_confirmed", "appointmentId": "<id>" }
}
```
`data.type` утгууд: `appointment_confirmed`, `appointment_reminder`. Эдгээрээр апп
дотор навигаци хийж болно (ж: цаг захиалгын дэлгэц рүү).

---

## 5. Ажилтны апп (User — заавал биш)

Ажилтны мобайл апп бол email/нууц үгээр нэвтэрч (`POST /api/v1/auth/login` →
`accessToken`), төхөөрөмжөө **тусдаа endpoint**-аар бүртгэнэ:
```
POST   /api/v1/devices            (Bearer <user accessToken>)  — мөн адил body
DELETE /api/v1/devices/<deviceId>
```

---

## Серверийн тал (аль хэдийн хийгдсэн)
- Хадгалах: `Device` model (`deviceId @unique`, `platform`, `firebaseToken`, `name`,
  `model`, `os`, эзэн `userId`/`accountId`).
- Push илгээх: `lib/push.ts` (`sendPushToAccount` / `sendPushToUser`). Цаг
  баталгаажуулах (`confirmAppointment`) ба сануулгын cron-д холбогдсон.
- Хүчингүй болсон FCM token-ийг автоматаар цэвэрлэдэг.
