import { Code, Endpoint, Section } from "./_shared";

const BEARER = "Bearer (Ажилтан)";

export function TenantDocs() {
  return (
    <>
      {/* --- Нэвтрэлт --- */}
      <Section title="1. Нэвтрэлт — имэйл + нууц үг">
        <p className="text-sm text-[var(--oc-muted)] -mt-2">
          Ажилтан (байгууллагын дотоод хэрэглэгч, <code className="font-plex-mono text-[var(--oc-muted2)]">User</code> загвар)
          имэйл + нууц үгээр нэвтэрнэ. Эхлээд{" "}
          <code className="font-plex-mono text-[var(--oc-muted2)]">check-email</code>-ээр
          имэйлийн төлөвийг шалгаад, дараа нь эсвэл <code className="font-plex-mono text-[var(--oc-muted2)]">login</code>{" "}
          (идэвхжсэн бол) эсвэл <code className="font-plex-mono text-[var(--oc-muted2)]">activate/*</code>{" "}
          урсгал (анхны идэвхжүүлэлт) руу орно.
        </p>

        <Endpoint
          method="POST"
          path="/api/v1/auth/check-email"
          auth="public"
          tags={["Rate limit: 15/60с (IP)"]}
          title="Имэйлийн төлөв шалгах — дараагийн алхмыг шийднэ (password / activate / not_registered)."
        >
          <Code>{`Req:  { "email": "manager@example.com" }
Res:  200 { "status": "not_registered", "email": "...", "message": "..." }
   | 200 { "status": "password", "email": "..." }
   | 200 { "status": "activate", "email": "...", "maskedPhone": "99***33", "otpSent": true, "message": "..." }
400 { "error": "Имэйл хаяг буруу." }
429 { "error": "Хэт олон хүсэлт илгээлээ..." }`}</Code>
        </Endpoint>

        <Endpoint
          method="POST"
          path="/api/v1/auth/login"
          auth="public"
          tags={["Rate limit: 10/60с (IP)"]}
          title="Идэвхжсэн хэрэглэгчийн нэвтрэлт (status=password үед)."
        >
          <Code>{`Req:  { "email": "manager@example.com", "password": "..." }
Res:  200 {
  "accessToken": "<JWT>", "accessTokenExpiresInSeconds": 86400,
  "refreshToken": "<token>", "refreshTokenExpiresInSeconds": ..., "refreshTokenExpiresAt": "2026-...",
  "user": {
    "id": "...", "email": "...", "firstName": "...", "lastName": "...", "phone": "...",
    "isOwner": true, "role": { "id": "...", "name": "Менежер", "permissions": [...] } | null,
    "branchId": "..." | null, "tenant": { "id": "...", "name": "Инфосистемс" }
  }
}
401 { "error": "Имэйл эсвэл нууц үг буруу." }
423 { "error": "Хэт олон удаа буруу оролдсон тул аккаунт түгжигдсэн. Нууц үгээ сэргээнэ үү." }
403 { "error": "Энэ аккаунт идэвхжээгүй байна. Веб дээр анхны нэвтрэлт хийж нууц үгээ үүсгэнэ үү." }
403 { "error": "Таны байгууллага түр хугацаагаар зогссон байна." }`}</Code>
        </Endpoint>

        <Endpoint
          method="POST"
          path="/api/v1/auth/activate/request-otp"
          auth="public"
          tags={["Rate limit: 5/60с (IP)"]}
          title="Анхны идэвхжүүлэлт — бүртгэлтэй утас руу 6 оронтой код илгээх (status=activate үед)."
        >
          <Code>{`Req:  { "email": "manager@example.com" }
Res:  200 { "sent": true, "maskedPhone": "99***33", "message": "..." }
429 { "error": "<throttle мессеж>" }`}</Code>
        </Endpoint>

        <Endpoint
          method="POST"
          path="/api/v1/auth/activate"
          auth="public"
          tags={["Rate limit: 10/60с (IP)"]}
          title="OTP код баталгаажуулж, шинэ нууц үг тохируулан идэвхжүүлэх."
        >
          <Code>{`Req:  { "email": "manager@example.com", "code": "123456", "password": "минимум 8 тэмдэгт" }
Res:  200 { same shape as /auth/login }
400  { "error": "6 оронтой код шаардлагатай." } | { "error": "Нууц үг хамгийн багадаа 8 тэмдэгт байх ёстой." }
401  { "error": "Кодны хугацаа дууссан. Шинээр код илгээнэ үү." }
401  { "error": "Хэт олон удаа буруу оролдсон. Шинээр код илгээнэ үү." }
401  { "error": "Код буруу байна." }
404  { "error": "Хэрэглэгч олдсонгүй." }
409  { "error": "Аккаунт аль хэдийн идэвхжсэн байна. Нууц үгээрээ нэвтэрнэ үү." }`}</Code>
        </Endpoint>

        <Endpoint
          method="POST"
          path="/api/v1/auth/refresh"
          auth="public"
          tags={["Rate limit: 30/60с (IP)"]}
          title="24 цагийн дараа хугацаа дуусах accessToken-ийг refreshToken-оор шинэчлэх (rotate)."
        >
          <Code>{`Req:  { "refreshToken": "<token>" }
Res:  200 { "accessToken": "...", "accessTokenExpiresInSeconds": 86400,
            "refreshToken": "...", "refreshTokenExpiresInSeconds": ..., "refreshTokenExpiresAt": "..." }
401 { "error": "Refresh token-ийн хугацаа дууссан.", "reason": "expired" }
401 { "error": "Refresh token аль хэдийн ашиглагдсан. Дахин нэвтэрнэ үү.", "reason": "reused" }
401 { "error": "Refresh token хүчингүй.", "reason": "invalid" }`}</Code>
        </Endpoint>

        <Endpoint method="POST" path="/api/v1/auth/logout" auth="public" title="Тухайн төхөөрөмжийн refreshToken-ийг цуцлах.">
          <Code>{`Req:  { "refreshToken": "<token>" }
Res:  200 { "ok": true }`}</Code>
        </Endpoint>

        <div className="rounded-[10px] border border-[var(--oc-accent)]/25 bg-[var(--oc-accent)]/[0.06] p-4">
          <p className="text-sm text-[var(--oc-ink2)]">
            <strong>Токены амьдрал.</strong> Account realm-ээс ялгаатай нь энд{" "}
            <code className="font-plex-mono">accessToken</code> 24 цагийн дараа
            дуусна (<code className="font-plex-mono">exp</code> claim-тай) — тиймээс
            апп нь <code className="font-plex-mono">refreshToken</code>-ийг
            найдвартай хадгалж, 401 (<code className="font-plex-mono">reason: &quot;expired&quot;</code>)
            авахад автоматаар <code className="font-plex-mono">/auth/refresh</code> дуудах ёстой.
          </p>
        </div>
      </Section>

      {/* --- Профайл --- */}
      <Section title="2. Профайл">
        <Endpoint method="GET" path="/api/v1/me" auth="bearer" bearerLabel={BEARER} title="Өөрийн болон харьяалагдах байгууллагын мэдээлэл.">
          <Code>{`Res: 200 {
  "id": "...", "email": "...", "firstName": "...", "lastName": "...", "phone": "...",
  "isOwner": true, "role": { "id": "...", "name": "...", "permissions": [...] } | null,
  "tenant": { "id": "...", "name": "...", "slug": "...", "logoUrl": "..." } | null,
  "branch": { "id": "...", "name": "..." } | null
}`}</Code>
        </Endpoint>
      </Section>

      {/* --- Push --- */}
      <Section title="3. Төхөөрөмж бүртгэл (push мэдэгдэл)">
        <Endpoint method="POST" path="/api/v1/devices" auth="bearer" bearerLabel={BEARER} title="Push токен бүртгэх/шинэчлэх (deviceId-аар upsert).">
          <Code>{`Req:  { "deviceId": "<uuid>", "platform": "ANDROID", "firebaseToken": "...", "name": "...", "model": "...", "os": "..." }
Res:  200 { "device": { "id": "...", "deviceId": "..." } }
400  { "error": "deviceId шаардлагатай." } | { "error": "platform нь WEB/ANDROID/IOS байх ёстой." }`}</Code>
        </Endpoint>

        <Endpoint method="DELETE" path="/api/v1/devices/[deviceId]" auth="bearer" bearerLabel={BEARER} title="Logout үед төхөөрөмжийг бүртгэлээс хасах.">
          <Code>{`Res: 200 { "ok": true }`}</Code>
        </Endpoint>
      </Section>

      {/* --- Салбар / Үйлчлүүлэгч / Машин --- */}
      <Section title="4. Салбар, үйлчлүүлэгч, машин">
        <Endpoint method="GET" path="/api/v1/branches" auth="bearer" bearerLabel={BEARER} tags={["branch-scoped"]} title="Байгууллагын салбарууд (branch-с гадуурх ажилтан зөвхөн өөрийн салбарыг харна).">
          <Code>{`Query: ?page=&pageSize=
Res: 200 { "branches": [{ "id": "...", "name": "...", "address": "...", "phone": "..." }], "pagination": {...} }`}</Code>
        </Endpoint>

        <Endpoint method="GET" path="/api/v1/customers" auth="bearer" bearerLabel={BEARER} title="Үйлчлүүлэгчдийн жагсаалт (нэр/утас/имэйлээр хайлт).">
          <Code>{`Query: ?q=&page=&pageSize=
Res: 200 { "customers": [{ "id": "...", "fullName": "...", "phone": "...", "email": "...", "note": "...", "createdAt": "..." }], "pagination": {...} }`}</Code>
        </Endpoint>

        <Endpoint method="POST" path="/api/v1/customers" auth="bearer" bearerLabel={BEARER} tags={["Эрх: customers.create", "Багц идэвхтэй байх шаардлагатай"]} title="Шинэ үйлчлүүлэгч нэмэх (утас 8 оронтой, давхцахгүй байх ёстой).">
          <Code>{`Req:  { "phone": "99112233", "fullName": "...", "email": "...", "note": "..." }  // phone заавал
Res:  201 { "customer": { "id": "...", "fullName": "...", "phone": "...", "email": "...", "note": "...", "createdAt": "..." } }
403  { "error": "Танд энэ үйлдэл хийх эрх байхгүй." }
403  { "error": "...", "code": "SUBSCRIPTION_EXPIRED" }
422  { "error": "Хүсэлт буруу.", "fieldErrors": { "phone": "Утас шаардлагатай." } }
409  { "error": "Энэ утасны дугаартай харилцагч аль хэдийн бүртгэлтэй байна." }`}</Code>
        </Endpoint>

        <Endpoint method="GET" path="/api/v1/vehicles" auth="bearer" bearerLabel={BEARER} title="Машинуудын жагсаалт (дугаар/загвар/vin-ээр хайлт, харилцагчаар шүүлт).">
          <Code>{`Query: ?q=&customerId=&page=&pageSize=
Res: 200 { "vehicles": [{ "id": "...", "plate": "...", "vin": "...", "make": "...", "model": "...",
  "year": 2018, "mileage": 45000, "customerId": "...", "customer": { "id": "...", "fullName": "...", "phone": "..." } | null }],
  "pagination": {...} }`}</Code>
        </Endpoint>

        <Endpoint method="POST" path="/api/v1/vehicles" auth="bearer" bearerLabel={BEARER} tags={["Эрх: vehicles.create", "Багц идэвхтэй байх шаардлагатай"]} title="Шинэ машин нэмэх (plate/make/model заавал).">
          <Code>{`Req:  { "plate": "1234УБА", "make": "Toyota", "model": "Prius", "vin": "...", "year": 2018, "mileage": 45000, "customerId": "..." }
Res:  201 { "vehicle": { "id": "...", "plate": "...", "vin": "...", "make": "...", "model": "...", "year": 2018, "mileage": 45000, "customerId": "..." } }
422  { "error": "Хүсэлт буруу.", "fieldErrors": { "plate": "Улсын дугаар шаардлагатай." } }
422  { "error": "Хүсэлт буруу.", "fieldErrors": { "customerId": "Үйлчлүүлэгч олдсонгүй." } }`}</Code>
        </Endpoint>
      </Section>

      {/* --- Захиалга --- */}
      <Section title="5. Захиалга">
        <Endpoint method="GET" path="/api/v1/orders" auth="bearer" bearerLabel={BEARER} tags={["branch-scoped"]} title="Захиалгын жагсаалт (статус/салбар/машин/харилцагчаар шүүлт).">
          <Code>{`Query: ?status=&branchId=&vehicleId=&customerId=&page=&pageSize=
Res: 200 { "orders": [{ "id": "...", "number": "...", "status": "...", "paymentStatus": "...",
  "scheduledAt": "...", "startedAt": "...", "completedAt": "...", "totalAmount": 0, "paidAmount": 0,
  "notes": "...", "createdAt": "...", "customer": {...}, "vehicle": {...}, "branch": {...}, "assignedTo": {...} }],
  "pagination": {...} }`}</Code>
        </Endpoint>

        <Endpoint method="POST" path="/api/v1/orders" auth="bearer" bearerLabel={BEARER} tags={["Эрх: orders.create", "Багц идэвхтэй байх шаардлагатай"]} title="Шинэ захиалга үүсгэх.">
          <Code>{`Req:  { "branchId": "...", "customerId": "...", "vehicleId": "...", "assignedToId": "...", "scheduledAt": "...", "notes": "..." }
Res:  201 { "order": {...} }
422  { "error": "Хүсэлт буруу.", "fieldErrors": { "branchId": "...", "customerId": "...", "vehicleId": "..." } }
422  { "error": "Хүсэлт буруу.", "fieldErrors": { "branchId": "Зөвхөн өөрийн салбарт захиалга үүсгэх боломжтой." } }
500  { "error": "Захиалгын дугаар үүсгэж чадсангүй. Дахин оролдоно уу." }`}</Code>
        </Endpoint>

        <Endpoint method="GET" path="/api/v1/orders/[id]" auth="bearer" bearerLabel={BEARER} tags={["branch-scoped"]} title="Захиалгын дэлгэрэнгүй (мөрүүд + оношилгооны тайлан хамт).">
          <Code>{`Res: 200 { "order": { ...list-ийн талбарууд, "paidAt", "updatedAt",
  "items": [{ "id": "...", "kind": "...", "description": "...", "quantity": 1, "unitPrice": 0, "total": 0, "serviceId": "..." }],
  "reports": [{ "id": "...", "createdAt": "...", "template": { "id": "...", "name": "...", "type": "..." } }] } }
404 { "error": "Захиалга олдсонгүй." }`}</Code>
        </Endpoint>

        <Endpoint method="PATCH" path="/api/v1/orders/[id]" auth="bearer" bearerLabel={BEARER} tags={["Эрх: orders.edit", "Багц идэвхтэй байх шаардлагатай"]} title="Захиалгын статус/тэмдэглэл/хариуцагч засах — зөвшөөрөгдсөн шилжилтээр л статус солигдоно.">
          <Code>{`Req:  { "status": "IN_PROGRESS", "notes": "...", "assignedToId": "..." }  // бүгд заавал биш
Res:  200 { "order": {...} }
404  { "error": "Захиалга олдсонгүй." }
422  { "error": "Дууссан / цуцлагдсан захиалгын мэдээллийг засах боломжгүй." }
422  { "error": "\\"PENDING\\" статусаас \\"COMPLETED\\" руу шилжих боломжгүй." }`}</Code>
        </Endpoint>

        <Endpoint method="POST" path="/api/v1/orders/[id]/items" auth="bearer" bearerLabel={BEARER} tags={["Эрх: orders.edit", "Багц идэвхтэй байх шаардлагатай"]} title="Захиалгад ажил/сэлбэг/оношилгооны мөр нэмэх (каталогоос үнэ/нэр автоматаар татагдана).">
          <Code>{`Req:  { "serviceId": "..." | "diagnosticTemplateId": "...", "kind": "LABOR|DIAGNOSTIC|PART|FEE", "description": "...", "quantity": 1, "unitPrice": 0 }
Res:  201 { "item": { "id": "...", "kind": "...", "description": "...", "quantity": 1, "unitPrice": 0, "total": 0, "serviceId": "..." } }
404  { "error": "Захиалга олдсонгүй." }
422  { "error": "Дууссан эсвэл цуцлагдсан захиалганд мөр нэмэх боломжгүй." }
422  { "error": "Хүсэлт буруу.", "fieldErrors": { "quantity": "Үлдэгдэл хүрэхгүй байна." } }`}</Code>
        </Endpoint>

        <Endpoint method="PATCH" path="/api/v1/orders/[id]/items/[itemId]" auth="bearer" bearerLabel={BEARER} tags={["Эрх: orders.edit", "Багц идэвхтэй байх шаардлагатай"]} title="Захиалгын мөр засах.">
          <Code>{`Req:  { "kind": "...", "description": "...", "quantity": 1, "unitPrice": 0 }  // бүгд заавал биш
Res:  200 { "item": {...} }
404  { "error": "Захиалга олдсонгүй." } | { "error": "Мөр олдсонгүй." }
422  { "error": "Дууссан эсвэл цуцлагдсан захиалгын мөрийг засах боломжгүй." }`}</Code>
        </Endpoint>

        <Endpoint method="DELETE" path="/api/v1/orders/[id]/items/[itemId]" auth="bearer" bearerLabel={BEARER} tags={["Эрх: orders.edit", "Багц идэвхтэй байх шаардлагатай"]} title="Захиалгын мөр устгах (сэлбэгийн үлдэгдэл сэргэнэ, нийт дүн дахин тооцогдоно).">
          <Code>{`Res: 200 { "ok": true }
404 { "error": "Захиалга олдсонгүй." } | { "error": "Мөр олдсонгүй." }
422 { "error": "Дууссан эсвэл цуцлагдсан захиалганаас мөр устгах боломжгүй." }`}</Code>
        </Endpoint>

        <Endpoint method="PATCH" path="/api/v1/orders/[id]/payment" auth="bearer" bearerLabel={BEARER} tags={["Эрх: payments.edit", "Багц идэвхтэй байх шаардлагатай"]} title="Захиалгын төлбөрийн төлөв шинэчлэх (бэлнээр төлсөн гэх мэт).">
          <Code>{`Req:  { "paymentStatus": "UNPAID" | "PARTIAL" | "PAID", "paidAmount": 0 }  // PARTIAL үед paidAmount заавал
Res:  200 { "order": {...} }
404  { "error": "Захиалга олдсонгүй." }
422  { "error": "Төлбөрийн төлөв буруу." }
422  { "error": "Хагас төлбөрийн дүнг зөв оруулна уу." }
422  { "error": "Төлсөн дүн нийт дүнгээс их байж болохгүй." }`}</Code>
        </Endpoint>

        <Endpoint method="GET" path="/api/v1/orders/[id]/qpay" auth="bearer" bearerLabel={BEARER} title="Захиалгын идэвхтэй QPay нэхэмжлэхийг харах.">
          <Code>{`Res: 200 { "qpayEnabled": true, "pending": { "id": "...", "qrImage": "...", "qrText": "...", "amount": "0", "urls": [...] } | null }
404 { "error": "Захиалга олдсонгүй." }`}</Code>
        </Endpoint>

        <Endpoint method="POST" path="/api/v1/orders/[id]/qpay" auth="bearer" bearerLabel={BEARER} tags={["Эрх: payments.create"]} title="Захиалгад QPay нэхэмжлэх үүсгэх (үлдэгдэл дүнгээр).">
          <Code>{`Res: 200 { "payment": { "id": "...", "qrImage": "...", "qrText": "...", "amount": "0", "urls": [...] } }
404 { "error": "Захиалга олдсонгүй." }
422 { "error": "Захиалга бүрэн төлөгдсөн." } | { "error": "Үлдэгдэл байхгүй." }
502 { "error": "<qpay провайдерын алдаа>" }`}</Code>
        </Endpoint>

        <Endpoint method="DELETE" path="/api/v1/orders/[id]/qpay" auth="bearer" bearerLabel={BEARER} tags={["Эрх: payments.delete"]} title="Хүлээгдэж буй QPay нэхэмжлэхийг цуцлах.">
          <Code>{`Req:  { "paymentId": "..." }
Res:  200 { "ok": true }
400 { "error": "paymentId шаардлагатай." }`}</Code>
        </Endpoint>

        <Endpoint method="POST" path="/api/v1/orders/[id]/qpay/check" auth="bearer" bearerLabel={BEARER} tags={["Эрх: payments.edit"]} title="QPay нэхэмжлэхийн төлбөр орсон эсэхийг шалгах.">
          <Code>{`Req:  { "paymentId": "..." }
Res:  200 { "paid": true } | { "paid": false, "message": "Төлбөр төлөгдөөгүй байна." }
404 { "error": "Төлбөр олдсонгүй." }
422 { "error": "QPay invoice байхгүй." }
502 { "error": "<qpay провайдерын алдаа>" }`}</Code>
        </Endpoint>
      </Section>

      {/* --- Цаг захиалга --- */}
      <Section title="6. Цаг захиалга">
        <Endpoint method="GET" path="/api/v1/appointments" auth="bearer" bearerLabel={BEARER} tags={["Эрх: appointments.view", "branch-scoped"]} title="Цагийн жагсаалт. month= параметрээр өдөр тус бүрийн тоог авах боломжтой.">
          <Code>{`Query: ?status=&date=YYYY-MM-DD&month=YYYY-MM&branchId=&page=&pageSize=
Res (month горим): 200 { "dates": ["2026-09-02", "2026-09-05", ...] }
Res (энгийн):      200 { "appointments": [{ "id": "...", "status": "PENDING", "requestedAt": "...", "note": "...",
  "branch": {...}, "category": {...} | null, "account": { "name": "...", "phone": "..." } | null,
  "customer": {...} | null, "accountVehicle": {...} | null, "vehicle": {...} | null,
  "serviceOrder": { "id": "...", "number": "..." } | null }], "pagination": {...} }`}</Code>
        </Endpoint>

        <Endpoint method="PATCH" path="/api/v1/appointments/[id]" auth="bearer" bearerLabel={BEARER} tags={["Эрх: appointments.edit", "branch-scoped"]} title="Цагийн статус солих (зөвшөөрөгдсөн шилжилтээр л).">
          <Code>{`Req:  { "status": "CONFIRMED" }
Res:  200 { "appointment": {...} }
400  { "error": "status шаардлагатай." } | { "error": "Онлайн бус захиалгыг энэ замаар баталгаажуулах боломжгүй." }
403  { "error": "Зөвхөн өөрийн салбарын цаг захиалгыг удирдана." }
404  { "error": "Цаг захиалга олдсонгүй." }
409  { "error": "PENDING → COMPLETED шилжилт боломжгүй." }`}</Code>
        </Endpoint>
      </Section>

      {/* --- Каталог --- */}
      <Section title="7. Үйлчилгээний каталог">
        <Endpoint method="GET" path="/api/v1/services" auth="bearer" bearerLabel={BEARER} title="Ажил/сэлбэг/оношилгооны каталог.">
          <Code>{`Query: ?type=LABOR|GOODS|DIAGNOSTIC&q=&isActive=&page=&pageSize=
Res: 200 { "services": [{ "id": "...", "type": "...", "name": "...", "code": "...", "price": 0, "costPrice": 0,
  "stock": 0, "description": "...", "isActive": true, "unit": {...}, "category": {...}, "createdAt": "..." }], "pagination": {...} }`}</Code>
        </Endpoint>

        <Endpoint method="POST" path="/api/v1/services" auth="bearer" bearerLabel={BEARER} tags={["Багц идэвхтэй байх шаардлагатай"]} title="Шинэ ажил/сэлбэг/оношилгоо үүсгэх.">
          <Code>{`Req:  { "type": "GOODS", "name": "...", "price": 0, "code": "...", "costPrice": 0, "stock": 0, "unitId": "...", "categoryId": "..." }
Res:  200 { "service": {...} }
400  { "error": "Төрөл буруу байна (LABOR | GOODS | DIAGNOSTIC)" } | { "error": "Нэр заавал шаардлагатай" } | { "error": "Үнэ буруу байна" }`}</Code>
        </Endpoint>

        <Endpoint method="GET" path="/api/v1/services/[id]" auth="bearer" bearerLabel={BEARER} title="Ганц үйлчилгээний дэлгэрэнгүй.">
          <Code>{`Res: 200 { "service": { ...list-ийн талбарууд, "updatedAt", "_count": { "items": 0 } } }
404 { "error": "Үйлчилгээ олдсонгүй." }`}</Code>
        </Endpoint>

        <Endpoint method="GET" path="/api/v1/labor-categories" auth="bearer" bearerLabel={BEARER} title="Ажлын ангиллын жагсаалт.">
          <Code>{`Query: ?all=true (идэвхгүй ч оруулах)
Res: 200 { "categories": [{ "id": "...", "name": "...", "description": "...", "isActive": true, "createdAt": "..." }] }`}</Code>
        </Endpoint>

        <Endpoint method="POST" path="/api/v1/labor-categories" auth="bearer" bearerLabel={BEARER} title="Шинэ ажлын ангилал үүсгэх (нэр давхцахгүй).">
          <Code>{`Req:  { "name": "...", "description": "...", "isActive": true }
Res:  200 { "category": {...} }
400  { "error": "Тийм нэртэй ангилал аль хэдийн байна" }`}</Code>
        </Endpoint>

        <Endpoint method="PATCH" path="/api/v1/labor-categories/[id]" auth="bearer" bearerLabel={BEARER} title="Ажлын ангилал засах.">
          <Code>{`Req:  { "name": "...", "description": "...", "isActive": true }  // бүгд заавал биш
Res:  200 { "category": {...} }
404  { "error": "Ангилал олдсонгүй" }`}</Code>
        </Endpoint>

        <Endpoint method="DELETE" path="/api/v1/labor-categories/[id]" auth="bearer" bearerLabel={BEARER} title="Ажлын ангилал устгах (ашиглагдаж байгаа бол боломжгүй).">
          <Code>{`Res: 200 { "ok": true }
404 { "error": "Ангилал олдсонгүй" }
400 { "error": "3 үйлчилгээнд ашиглагдаж байгаа тул устгах боломжгүй" }`}</Code>
        </Endpoint>

        <Endpoint method="GET" path="/api/v1/units" auth="bearer" bearerLabel={BEARER} title="Хэмжих нэгжийн жагсаалт.">
          <Code>{`Query: ?all=true
Res: 200 { "units": [{ "id": "...", "name": "...", "code": "...", "isActive": true, "createdAt": "..." }] }`}</Code>
        </Endpoint>

        <Endpoint method="POST" path="/api/v1/units" auth="bearer" bearerLabel={BEARER} title="Шинэ нэгж үүсгэх (нэр давхцахгүй).">
          <Code>{`Req:  { "name": "...", "code": "...", "isActive": true }
Res:  200 { "unit": {...} }
400  { "error": "Тийм нэртэй нэгж аль хэдийн байна" }`}</Code>
        </Endpoint>

        <Endpoint method="PATCH" path="/api/v1/units/[id]" auth="bearer" bearerLabel={BEARER} title="Нэгж засах.">
          <Code>{`Req:  { "name": "...", "code": "...", "isActive": true }  // бүгд заавал биш
Res:  200 { "unit": {...} }
404  { "error": "Нэгж олдсонгүй" }`}</Code>
        </Endpoint>

        <Endpoint method="DELETE" path="/api/v1/units/[id]" auth="bearer" bearerLabel={BEARER} title="Нэгж устгах (ашиглагдаж байгаа бол боломжгүй).">
          <Code>{`Res: 200 { "ok": true }
404 { "error": "Нэгж олдсонгүй" }
400 { "error": "5 үйлчилгээнд ашиглагдаж байгаа тул устгах боломжгүй" }`}</Code>
        </Endpoint>
      </Section>

      {/* --- Оношилгоо --- */}
      <Section title="8. Оношилгоо">
        <Endpoint method="GET" path="/api/v1/diagnostics/reports" auth="bearer" bearerLabel={BEARER} tags={["branch-scoped"]} title="Бөглөсөн оношилгооны тайлангийн жагсаалт.">
          <Code>{`Query: ?vehicleId=&customerId=&orderId=&filledByMe=true&page=&pageSize=
Res: 200 { "reports": [{ "id": "...", "createdAt": "...", "templateVersion": 1, "mileageAtReport": 45000, "orderId": "...",
  "template": { "id": "...", "name": "...", "type": "..." }, "customer": {...}, "vehicle": {...}, "branch": {...},
  "filledBy": { "id": "...", "firstName": "...", "lastName": "..." } }], "pagination": {...} }`}</Code>
        </Endpoint>

        <Endpoint method="POST" path="/api/v1/diagnostics/reports" auth="bearer" bearerLabel={BEARER} tags={["multipart/form-data"]} title="Оношилгооны тайлан бөглөх (зураг/гарын үсэг хавсаргах боломжтой) — orderId эсвэл customerId+vehicleId+branchId илгээнэ.">
          <Code>{`Req (form-data): templateId, orderId | (customerId + vehicleId + branchId), mileageAtReport, notes,
                 + загварын dynamic талбарууд/файлууд
Res:  201 { "report": { "id": "...", "createdAt": "...", "templateVersion": 1, "orderId": "...", "customerId": "...", "vehicleId": "...", "branchId": "..." } }
400  { "error": "Multipart form-data илгээнэ үү (зураг хавсаргах боломжтой)." }
403  { "error": "Зөвхөн өөрийн салбарт оношилгоо бүртгэх боломжтой." }
404  { "error": "Загвар олдсонгүй." } | { "error": "Захиалга олдсонгүй." }
422  { "error": "customerId, vehicleId, branchId шаардлагатай (эсвэл orderId илгээнэ үү)." }`}</Code>
        </Endpoint>

        <Endpoint method="GET" path="/api/v1/diagnostics/reports/[id]" auth="bearer" bearerLabel={BEARER} tags={["branch-scoped"]} title="Тайлангийн дэлгэрэнгүй (загварын бүтэц/схем хамт).">
          <Code>{`Res: 200 { "report": { ...list-ийн талбарууд, "template": { ..., "schema": {...} }, "order": { "id": "...", "number": "..." } | null } }
404 { "error": "Тайлан олдсонгүй." }`}</Code>
        </Endpoint>

        <Endpoint method="DELETE" path="/api/v1/diagnostics/reports/[id]" auth="bearer" bearerLabel={BEARER} tags={["Эрх: diagnostics.delete, эсвэл өөрийн бөглөсөн тайлан"]} title="Тайлан устгах — устгах эрхтэй эсвэл өөрөө бөглөсөн тайлан бол зөвшөөрнө.">
          <Code>{`Res: 200 { "ok": true }
404 { "error": "Тайлан олдсонгүй." }
403 { "error": "Танд устгах эрх байхгүй." }`}</Code>
        </Endpoint>

        <Endpoint method="GET" path="/api/v1/diagnostics/templates" auth="bearer" bearerLabel={BEARER} title="Оношилгооны загваруудын жагсаалт (унших зөвхөн — засах вэб дашбоардаас).">
          <Code>{`Query: ?type=&q=&includeInactive=true&page=&pageSize=
Res: 200 { "templates": [{ "id": "...", "name": "...", "description": "...", "type": "...", "version": 1,
  "isActive": true, "price": 0, "durationMin": 0, "updatedAt": "..." }], "pagination": {...} }`}</Code>
        </Endpoint>

        <Endpoint method="GET" path="/api/v1/diagnostics/templates/[id]" auth="bearer" bearerLabel={BEARER} title="Загварын дэлгэрэнгүй (schema хамт).">
          <Code>{`Res: 200 { "template": { ...list-ийн талбарууд, "schema": {...}, "updatedAt": "..." } }
404 { "error": "Загвар олдсонгүй." }`}</Code>
        </Endpoint>
      </Section>

      {/* --- Мэдэгдэл --- */}
      <Section title="9. Мэдэгдэл">
        <Endpoint method="GET" path="/api/v1/notifications" auth="bearer" bearerLabel={BEARER} title="Мэдэгдлийн жагсаалт + уншаагүй тоо.">
          <Code>{`Query: ?page=&pageSize= (default 20, max 50)
Res: 200 { "notifications": [{ "id": "...", "type": "...", "title": "...", "body": "...", "data": {...}, "readAt": "..." | null, "createdAt": "..." }],
  "pagination": {...}, "unreadCount": 3 }`}</Code>
        </Endpoint>

        <Endpoint method="PATCH" path="/api/v1/notifications/[id]/read" auth="bearer" bearerLabel={BEARER} title="Нэг мэдэгдлийг уншсан гэж тэмдэглэх (идэмпотент).">
          <Code>{`Res: 200 { "ok": true }
404 { "error": "Мэдэгдэл олдсонгүй." }`}</Code>
        </Endpoint>

        <Endpoint method="POST" path="/api/v1/notifications/read-all" auth="bearer" bearerLabel={BEARER} title="Бүх мэдэгдлийг уншсан гэж тэмдэглэх.">
          <Code>{`Res: 200 { "ok": true, "count": 12 }`}</Code>
        </Endpoint>
      </Section>

      {/* --- Багц --- */}
      <Section title="10. Багц">
        <Endpoint method="GET" path="/api/v1/subscription" auth="bearer" bearerLabel={BEARER} title="Байгууллагын багцын төлөв (олон бичих endpoint эндээс SUBSCRIPTION_EXPIRED алдаа буцаах эсэхийг тодорхойлно).">
          <Code>{`Res: 200 { "plan": "...", "status": "...", "locked": false, "isTrial": false, "daysLeft": 12 | null,
  "expiresAt": "...", "expiringSoon": false, "warnDays": 7, "hasPendingPayment": false }`}</Code>
        </Endpoint>
      </Section>

      {/* --- Файл --- */}
      <Section title="11. Файл байршуулах">
        <Endpoint method="POST" path="/api/v1/uploads" auth="bearer" bearerLabel={BEARER} tags={["multipart/form-data"]} title="Оношилгооны зураг/гарын үсэг байршуулах.">
          <Code>{`Req (form-data): file (заавал), kind: "diagnostics" | "signatures" (заавал биш, анхдагч "diagnostics")
Res:  201 { "url": "...", "size": 123456, "mime": "image/jpeg" }
400  { "error": "Multipart form-data илгээнэ үү." } | { "error": "\`file\` талбарт зураг хавсаргана уу." }`}</Code>
        </Endpoint>
      </Section>

      {/* --- HUR --- */}
      <Section title="12. Улсын дугаараар лавлах (HUR)">
        <Endpoint method="GET" path="/api/v1/hur/vehicle" auth="bearer" bearerLabel={BEARER} tags={["Rate limit: 20/60с (хэрэглэгчээр)"]} title="Улсын дугаараар машин лавлах — систем дотор байвал тэндээс, үгүй бол улсын бүртгэлийн (HUR) системээс. Account realm-ийн /api/v1/app/hur/lookup-аас тусдаа endpoint.">
          <Code>{`Query: ?plate=1234УБА
Res: 200 { "vehicle": {...}, "owner": null, "source": "global" }
   | 200 { "vehicle": {...}, "source": "hur" }
400 { "error": "Улсын дугаар шаардлагатай." }
502 { "error": "HUR алдаа гарлаа." }`}</Code>
        </Endpoint>
      </Section>

      {/* --- Алдааны формат --- */}
      <Section title="13. Алдааны формат">
        <div className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] p-5">
          <p className="text-sm text-[var(--oc-muted)] mb-3">
            Ихэнх алдаа <code className="font-plex-mono">{`{ "error": "..." }`}</code> хэлбэртэй,
            валидацийн алдаа нэмэлт <code className="font-plex-mono">fieldErrors</code>{" "}
            обьекттой, багц дууссан алдаа нэмэлт <code className="font-plex-mono">code</code>{" "}
            талбартай:
          </p>
          <Code>{`{ "error": "Хүний-унших мессеж." }
{ "error": "Хүсэлт буруу.", "fieldErrors": { "phone": "Утас шаардлагатай." } }
{ "error": "...", "code": "SUBSCRIPTION_EXPIRED" }`}</Code>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 text-sm">
            {[
              ["400", "Буруу/дутуу параметр"],
              ["401", "Токен байхгүй/хүчингүй/дууссан"],
              ["403", "Эрхгүй / багц дууссан / салбар зөрсөн"],
              ["404", "Олдсонгүй"],
              ["409", "Зөрчил (статус шилжилт боломжгүй, дугаар давхцсан)"],
              ["422", "Валидацийн алдаа (fieldErrors-тэй)"],
              ["423", "Хэт олон буруу оролдлогоор түгжигдсэн"],
              ["429", "Rate limit хэтэрсэн"],
              ["500", "Дотоод алдаа (ж: захиалгын дугаар үүсгэлт)"],
              ["502", "Гадаад үйлчилгээ (HUR/QPay) алдаа"],
            ].map(([code, label]) => (
              <div key={code} className="flex items-center gap-2">
                <code className="font-plex-mono text-[var(--oc-accent)] w-10 shrink-0">{code}</code>
                <span className="text-[var(--oc-muted2)]">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </Section>
    </>
  );
}
