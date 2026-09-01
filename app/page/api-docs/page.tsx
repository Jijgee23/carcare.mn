import Link from "next/link";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import type { ReactNode } from "react";
import { Brand } from "@/app/_components/brand";
import { Chip, TagChip } from "@/app/_components/landing-ops-ui";
import { Footer } from "@/app/_components/footer";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-sans",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
});

export const metadata = {
  title: "Мобайл API — Баримтжуулалт",
  robots: { index: false, follow: false },
};

export const revalidate = false;

type Method = "GET" | "POST" | "DELETE";
type Auth = "public" | "bearer";

const METHOD_TONE: Record<Method, "ok" | "accent" | "danger"> = {
  GET: "ok",
  POST: "accent",
  DELETE: "danger",
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold text-[var(--oc-ink)] mb-3">{title}</h2>
      <div className="flex flex-col gap-5">{children}</div>
    </section>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-carbon)] p-4 overflow-x-auto">
      <code className="font-plex-mono text-[12.5px] leading-relaxed text-[var(--oc-ink2)] whitespace-pre">
        {children}
      </code>
    </pre>
  );
}

function Endpoint({
  method,
  path,
  auth,
  title,
  children,
}: {
  method: Method;
  path: string;
  auth: Auth;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] p-5">
      <div className="flex items-center gap-2 flex-wrap">
        <Chip tone={METHOD_TONE[method]} bordered>
          {method}
        </Chip>
        <code className="font-plex-mono text-[13px] text-[var(--oc-ink)]">{path}</code>
        <TagChip>{auth === "bearer" ? "Bearer (Account)" : "Public"}</TagChip>
      </div>
      <p className="mt-2.5 text-sm text-[var(--oc-muted)]">{title}</p>
      <div className="mt-4 flex flex-col gap-3">{children}</div>
    </div>
  );
}

export default function ApiDocsPage() {
  return (
    <div className={`${plexSans.variable} ${plexMono.variable} landing-ops min-h-screen flex flex-col`}>
      <header className="border-b border-[var(--oc-line2)]">
        <div className="mx-auto max-w-5xl px-4 h-16 flex items-center justify-between">
          <Link href="/">
            <Brand />
          </Link>
          <Link
            href="/page/landing"
            className="text-sm text-[var(--oc-muted2)] hover:text-[var(--oc-accent-hi)] transition-colors"
          >
            ← Нүүр
          </Link>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-4xl px-4 py-12">
        <h1 className="text-3xl font-bold text-[var(--oc-ink)]">Мобайл API</h1>
        <p className="text-[var(--oc-muted)] text-sm mt-2 max-w-2xl leading-relaxed">
          Энэ хуудас нь эцсийн хэрэглэгчийн (машины эзэмшигч/жолооч) мобайл
          аппаас дуудах <strong className="text-[var(--oc-ink2)]">Account</strong>{" "}
          realm-ийн API-г баримтжуулна. Ажилтны (байгууллагын дотоод) мобайл
          API энд ОРООГҮЙ — тэдгээр нь өөр auth механизм (email+нууц үг,{" "}
          <code className="font-plex-mono text-[var(--oc-muted2)]">User</code>{" "}
          загвар) ашигладаг тусдаа realm.
        </p>

        <div className="mt-6 rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] p-5">
          <div className="grid gap-3 sm:grid-cols-2 text-sm">
            <div>
              <div className="font-plex-mono text-[10.5px] uppercase tracking-[0.1em] text-[var(--oc-muted3)] mb-1">
                Base URL
              </div>
              <div className="text-[var(--oc-ink2)]">
                Прод: <code className="font-plex-mono">https://carcare.mn</code>
                <br />
                Dev: <code className="font-plex-mono">http://&lt;LAN-IP&gt;:4000</code>
              </div>
            </div>
            <div>
              <div className="font-plex-mono text-[10.5px] uppercase tracking-[0.1em] text-[var(--oc-muted3)] mb-1">
                Content-Type
              </div>
              <div className="text-[var(--oc-ink2)]">
                Бүх POST/DELETE хүсэлт: <code className="font-plex-mono">application/json</code>
              </div>
            </div>
          </div>
        </div>

        {/* --- Алхам 1-3: Нэвтрэлт --- */}
        <Section title="1. Нэвтрэлт — утас + OTP">
          <p className="text-sm text-[var(--oc-muted)] -mt-2">
            Нууц үггүй, зөвхөн утасны дугаар + 6 оронтой SMS кодоор. Дараах 2
            алхмыг дараалан дуудна.
          </p>

          <Endpoint
            method="POST"
            path="/api/v1/app/auth/request-otp"
            auth="public"
            title="Алхам 1 — утсанд 6 оронтой код илгээх. Rate limit: 5/10 мин (IP-ээр)."
          >
            <Code>{`Req:  { "phone": "99112233" }
Res:  200 { "ok": true }`}</Code>
          </Endpoint>

          <Endpoint
            method="POST"
            path="/api/v1/app/auth/verify-otp"
            auth="public"
            title="Алхам 2 — кодыг баталгаажуулж accessToken авах. Account шинэ бол автоматаар үүснэ."
          >
            <Code>{`Req:  { "phone": "99112233", "code": "123456", "name": "Бат" }  // name заавал биш
Res:  200 {
  "accessToken": "<JWT>",
  "account": { "id": "...", "phone": "99112233", "name": "Бат" }
}`}</Code>
          </Endpoint>

          <div className="rounded-[10px] border border-[var(--oc-accent)]/25 bg-[var(--oc-accent)]/[0.06] p-4">
            <p className="text-sm text-[var(--oc-ink2)]">
              <strong>Алхам 3 — токен ашиглах.</strong> Цаашид бүх auth
              шаардсан хүсэлтэд header нэмнэ:
            </p>
            <Code>{`Authorization: Bearer <accessToken>`}</Code>
            <p className="text-xs text-[var(--oc-muted3)] mt-2">
              Токен <strong>хугацаагүй</strong> (`exp` claim байхгүй) — refresh
              endpoint шаардлагагүй, апп үүгээр дахин суулгах хүртэл ашиглана.
              Зөвхөн Account идэвхгүй (устгагдсан/блоклогдсон) болгосноор хүчингүй
              болно.
            </p>
          </div>
        </Section>

        {/* --- Каталог --- */}
        <Section title="2. Байгууллага, салбар (каталог)">
          <p className="text-sm text-[var(--oc-muted)] -mt-2">
            Нэвтрэхээс өмнө ч дуудаж болно — нийтэд нээлттэй, онлайн цаг
            захиалга хүлээн авдаг байгууллагуудын жагсаалт.
          </p>

          <Endpoint method="GET" path="/api/v1/app/orgs" auth="public" title="Бүх байгууллага + салбаруудын каталог.">
            <Code>{`Res: 200 {
  "orgs": [{
    "slug": "infosystems", "name": "Инфосистемс", "logoUrl": "...",
    "branches": [{
      "id": "...", "name": "Үндсэн салбар",
      "city": "Улаанбаатар", "district": "Баянзүрх",
      "latitude": 47.91, "longitude": 106.91
    }]
  }]
}`}</Code>
          </Endpoint>

          <Endpoint
            method="GET"
            path="/api/v1/app/orgs/[slug]"
            auth="public"
            title="Нэг байгууллагын дэлгэрэнгүй + ажлын цагтай салбарууд."
          >
            <Code>{`Res: 200 {
  "org": {
    "slug": "infosystems", "name": "Инфосистемс", "logoUrl": "...", "phone1": "70110000",
    "branches": [{
      "id": "...", "name": "Үндсэн салбар", "city": "...", "district": "...",
      "khoroo": "...", "address": "...", "latitude": 47.91, "longitude": 106.91,
      "openTime": "09:00", "closeTime": "18:00"
    }]
  }
}
404 { "error": "Байгууллага олдсонгүй." }`}</Code>
          </Endpoint>
        </Section>

        {/* --- Машин --- */}
        <Section title="3. Миний машинууд">
          <Endpoint method="GET" path="/api/v1/app/vehicles" auth="bearer" title="Өөрийн нэмсэн машинуудын жагсаалт.">
            <Code>{`Res: 200 { "vehicles": [{ "id": "...", "plate": "1234УБА", "make": "Toyota", "model": "Prius", "year": 2018, "vin": "..." }] }`}</Code>
          </Endpoint>

          <Endpoint method="POST" path="/api/v1/app/vehicles" auth="bearer" title="Шинэ машин нэмэх (plate/make/model заавал).">
            <Code>{`Req:  { "plate": "1234УБА", "make": "Toyota", "model": "Prius", "year": 2018,
        "vin": "...", "fuelType": "Бензин", "wheelPosition": "Зүүн" }  // сүүлийн 4 заавал биш
Res:  201 { "vehicle": { "id": "...", "plate": "1234УБА", "make": "Toyota", "model": "Prius", "year": 2018 } }
400  { "error": "plate, make, model шаардлагатай." }
409  { "error": "Энэ дугаар аль хэдийн бүртгэгдсэн." }`}</Code>
          </Endpoint>

          <Endpoint method="DELETE" path="/api/v1/app/vehicles/[id]" auth="bearer" title="Өөрийн нэмсэн машиныг устгах (id = холбоосын id, vehicles-ийн хариунаас).">
            <Code>{`Res: 200 { "ok": true }
404 { "error": "Машин олдсонгүй." }`}</Code>
          </Endpoint>

          <Endpoint
            method="GET"
            path="/api/v1/app/hur/lookup?plate=1234УБА"
            auth="bearer"
            title="Улсын дугаараар машин лавлах — эхлээд системд бүртгэлтэй эсэхийг шалгаад, үгүй бол HUR (улсын бүртгэл)-ээс татна. Rate limit: 20/мин (account-аар). Эзэмшигчийн PII буцахгүй."
          >
            <Code>{`Res: 200 {
  "vehicle": {
    "plate": "1234УБА", "make": "Toyota", "model": "Prius", "year": 2018, "vin": "...",
    "fuelType": "Бензин", "wheelPosition": "Зүүн", "colorName": "Цагаан",
    "capacity": 1496, "purpose": "Суудал"
  },
  "source": "global" | "hur"
}
400 { "error": "Улсын дугаар шаардлагатай." }
502 { "error": "HUR алдаа гарлаа." }`}</Code>
          </Endpoint>
        </Section>

        {/* --- Цаг захиалга --- */}
        <Section title="4. Цаг захиалга">
          <Endpoint method="GET" path="/api/v1/app/appointments" auth="bearer" title="Өөрийн бүх цагийн жагсаалт (бүх байгууллага дамнасан).">
            <Code>{`Res: 200 { "appointments": [{
  "id": "...", "status": "PENDING", "requestedAt": "2026-09-02T09:00:00.000Z", "note": "...",
  "tenant": { "name": "Инфосистемс", "slug": "infosystems" },
  "branch": { "name": "Үндсэн салбар" },
  "category": { "name": "Тоормос" } | null,
  "accountVehicle": { "plate": "1234УБА" } | null
}] }`}</Code>
          </Endpoint>

          <Endpoint
            method="POST"
            path="/api/v1/app/appointments"
            auth="bearer"
            title="Шинэ цаг захиалах. Слот дүүрсэн/өнгөрсөн цаг/байгууллага онлайн захиалга хүлээж авдаггүй бол алдаа."
          >
            <Code>{`Req:  { "branchId": "...", "requestedAt": "2026-09-02T09:00:00.000Z",
        "accountVehicleId": "...", "categoryId": "...", "note": "..." }  // сүүлийн 3 заавал биш
Res:  201 { "appointment": { "id": "...", "status": "PENDING", "requestedAt": "..." } }
400  { "error": "branchId шаардлагатай." } | { "error": "requestedAt буруу (ISO огноо шаардлагатай)." }
403  { "error": "Энэ байгууллага онлайн цаг захиалга хүлээн авахгүй." }
404  { "error": "Салбар олдсонгүй." }
409  { "error": "Энэ цаг дүүрсэн байна. Өөр цаг сонгоно уу." }`}</Code>
          </Endpoint>

          <Endpoint
            method="POST"
            path="/api/v1/app/appointments/[id]/cancel"
            auth="bearer"
            title="Өөрийн цагийг цуцлах (зөвхөн PENDING/CONFIRMED төлөвт байхад)."
          >
            <Code>{`Res: 200 { "ok": true }
404 { "error": "Цаг олдсонгүй." }
409 { "error": "Энэ цагийг цуцлах боломжгүй." }`}</Code>
          </Endpoint>
        </Section>

        {/* --- Push --- */}
        <Section title="5. Төхөөрөмж бүртгэл (push мэдэгдэл)">
          <p className="text-sm text-[var(--oc-muted)] -mt-2">
            Нэвтэрсний дараа (эсвэл FCM токен шинэчлэгдэх бүрт) дуудна.{" "}
            <code className="font-plex-mono text-[var(--oc-muted2)]">deviceId</code>{" "}
            тогтмол (upsert) тул дахин дуудахад давхардахгүй.
          </p>

          <Endpoint method="POST" path="/api/v1/app/devices" auth="bearer" title="Push токен бүртгэх/шинэчлэх.">
            <Code>{`Req:  {
  "deviceId":      "<тогтвортой install id, uuid>",   // ЗААВАЛ
  "platform":      "ANDROID",                          // ЗААВАЛ — ANDROID | IOS | WEB
  "firebaseToken": "<FCM registration token>",
  "name": "Bat's iPhone", "model": "iPhone 14 Pro", "os": "iOS 17.2"  // заавал биш
}
Res:  200 { "device": { "id": "...", "deviceId": "..." } }`}</Code>
          </Endpoint>

          <Endpoint method="DELETE" path="/api/v1/app/devices/[deviceId]" auth="bearer" title="Logout үед төхөөрөмжийг бүртгэлээс хасах.">
            <Code>{`Res: 200 { "ok": true }`}</Code>
          </Endpoint>
        </Section>

        {/* --- Алдааны формат --- */}
        <Section title="6. Алдааны формат">
          <div className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] p-5">
            <p className="text-sm text-[var(--oc-muted)] mb-3">
              Бүх алдаа ижил хэлбэртэй буцна:
            </p>
            <Code>{`{ "error": "Хүний-унших мессеж." }`}</Code>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 text-sm">
              {[
                ["400", "Буруу/дутуу параметр"],
                ["401", "Токен байхгүй/хүчингүй"],
                ["403", "Онлайн захиалга хаалттай байгууллага"],
                ["404", "Олдсонгүй"],
                ["409", "Зөрчил (слот дүүрсэн, дугаар давхцсан)"],
                ["429", "Rate limit хэтэрсэн"],
                ["502", "Гадаад үйлчилгээ (HUR) алдаа"],
              ].map(([code, label]) => (
                <div key={code} className="flex items-center gap-2">
                  <code className="font-plex-mono text-[var(--oc-accent)] w-10 shrink-0">{code}</code>
                  <span className="text-[var(--oc-muted2)]">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </Section>

        <p className="mt-10 text-xs text-[var(--oc-muted3)]">
          Push мэдэгдлийн бүтэц (FCM payload) болон жишээ код (React Native
          fetch)-ыг <code className="font-plex-mono">docs/mobile-device-push.md</code>{" "}
          файлаас үзнэ үү. Ажилтны (байгууллагын) мобайл API энэ хуудсанд
          ороогүй.
        </p>
      </main>

      <Footer />
    </div>
  );
}
