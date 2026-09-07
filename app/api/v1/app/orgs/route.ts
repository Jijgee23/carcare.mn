import { jsonOk } from "@/lib/api";
import {
  distanceKm,
  isBranchOpenAt,
  nowInZone,
} from "@/lib/branch-filters";
import { PLAN_LIMIT_CODES } from "@/lib/plan-limits";
import { plansWithFeature } from "@/lib/plan-limits-server";
import { prisma } from "@/lib/prisma";
import { setBypassContext } from "@/lib/tenant-context";

// Ойролцоо шүүлтийн радиусын дээд хязгаар (км).
const MAX_RADIUS_KM = 100;

// GET /api/v1/app/orgs — онлайн захиалга нээлттэй байгууллагуудын каталог (нийтэд).
// Нэмэлт шүүлтүүд (заавал биш):
//   ?lat=&lng=      — "ойролцоо": салбар БҮРД distanceKm онооно, хамгийн ойроор
//                     эрэмбэлнэ. Radius-гүй бол ЮУ Ч ХАСАХГҮЙ (зөвхөн тэмдэглэж
//                     эрэмбэлнэ — "бүх карт зайгаа харуулна" UX).
//   ?radius=<км>    — lat/lng-тэй хамт өгвөл нэмээд тухайн радиус дотор шүүнэ.
//   ?openNow=1      — "одоо нээлттэй": яг одоо ажиллаж буй салбартай байгууллага.
// Хэд хэдэн шүүлт зэрэг өгвөл салбар БҮГДийг нь хангасан байх ёстой.
//
// Ангиллын шүүлт ЭНД БАЙХГҮЙ — тухайн шийдвэр эргүүлэгдсэн: ангилал бол
// tenant-тусгай нэршилтэй тул (2 өөр байгууллага ижил үйлчилгээг өөр өөр нэрээр
// бүртгэсэн байж болно) нэг байгууллагаас гарахгүйгээр бүх байгууллагаар шүүх нь
// эндүүрэл үүсгэнэ. Оронд нь: ангиллаар шүүх/сонгох нь org (нэг tenant)-ийн
// хүрээнд, `orgs/[slug]` дотор л явагдана (BookingRequestScreen-ийн branch
// selector, C.f. CUSTOMER_BOOKING_REQUIREMENTS.md).
export async function GET(request: Request) {
  setBypassContext();
  const sp = new URL(request.url).searchParams;

  const latRaw = sp.get("lat");
  const lngRaw = sp.get("lng");
  const lat = latRaw != null ? Number(latRaw) : NaN;
  const lng = lngRaw != null ? Number(lngRaw) : NaN;
  const nearMe =
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180;
  // Radius нь ЗӨВХӨН тодорхой өгөгдсөн үед шүүнэ (default filter байхгүй).
  const radiusRaw = Number(sp.get("radius"));
  const hasRadius = Number.isFinite(radiusRaw) && radiusRaw > 0;
  const radius = hasRadius ? Math.min(radiusRaw, MAX_RADIUS_KM) : null;

  const openNow = sp.get("openNow") === "1" || sp.get("openNow") === "true";

  const allowedPlans = await plansWithFeature(PLAN_LIMIT_CODES.ONLINE_BOOKING);
  const orgs = await prisma.tenant.findMany({
    where: {
      acceptsOnlineBooking: true,
      suspended: false,
      plan: { in: allowedPlans },
    },
    orderBy: { name: "asc" },
    select: {
      slug: true,
      name: true,
      logoUrl: true,
      branches: {
        select: {
          id: true,
          name: true,
          city: true,
          district: true,
          latitude: true,
          longitude: true,
          // Шүүлтэд ашиглана — хариунд буцаахгүй (openNow-д).
          openTime: openNow,
          closeTime: openNow,
          schedules: openNow
            ? {
                select: {
                  weekday: true,
                  isOpen: true,
                  openTime: true,
                  closeTime: true,
                },
              }
            : false,
        },
      },
    },
  });

  // Шүүлтгүй бол хуучин зан төлөв яг хэвээр.
  if (!nearMe && !openNow) return jsonOk({ orgs });

  const now = openNow ? nowInZone() : null;

  type BranchOut = {
    id: string;
    name: string;
    city: string | null;
    district: string | null;
    latitude: number | null;
    longitude: number | null;
    distanceKm?: number;
  };

  const filtered: Array<{
    slug: string;
    name: string;
    logoUrl: string | null;
    branches: BranchOut[];
    _nearest: number;
  }> = [];

  for (const org of orgs) {
    const branches: BranchOut[] = [];
    let nearest = Number.POSITIVE_INFINITY;

    for (const b of org.branches) {
      // "Одоо нээлттэй" шүүлт.
      if (openNow && now) {
        const open = isBranchOpenAt(
          {
            openTime: b.openTime ?? null,
            closeTime: b.closeTime ?? null,
            schedules: b.schedules || [],
          },
          now.weekday,
          now.minutes,
        );
        if (!open) continue;
      }

      // "Ойролцоо": зай онооно; radius өгсөн тохиолдолд л шүүнэ.
      let dist: number | undefined;
      if (nearMe) {
        if (b.latitude == null || b.longitude == null) continue;
        dist = distanceKm(lat, lng, b.latitude, b.longitude);
        if (radius != null && dist > radius) continue;
        if (dist < nearest) nearest = dist;
      }

      branches.push({
        id: b.id,
        name: b.name,
        city: b.city,
        district: b.district,
        latitude: b.latitude,
        longitude: b.longitude,
        ...(dist != null ? { distanceKm: Math.round(dist * 10) / 10 } : {}),
      });
    }

    if (branches.length === 0) continue;
    // Ойролцоо салбарыг эхэнд харуулах.
    if (nearMe) branches.sort((x, y) => (x.distanceKm ?? 0) - (y.distanceKm ?? 0));
    filtered.push({
      slug: org.slug,
      name: org.name,
      logoUrl: org.logoUrl,
      branches,
      _nearest: nearest,
    });
  }

  // Near-me үед хамгийн ойр салбартай байгууллагыг эхэнд; эс бөгөөс нэрээр (өмнөх).
  if (nearMe) filtered.sort((a, b) => a._nearest - b._nearest);

  const result = filtered.map((o) => ({
    slug: o.slug,
    name: o.name,
    logoUrl: o.logoUrl,
    branches: o.branches,
  }));
  return jsonOk({ orgs: result });
}
