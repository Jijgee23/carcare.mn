import {
  type Weekday,
  branchStatusNow,
  formatAddress,
  worksEffectiveWeekends,
} from "@/lib/branches";
import { branchScheduleDisplaySelect } from "@/lib/branch-effective-schedule-server";
import { PLAN_LIMIT_CODES } from "@/lib/plan-limits";
import { plansWithFeature } from "@/lib/plan-limits-server";
import { prisma } from "@/lib/prisma";
import { setBypassContext } from "@/lib/tenant-context";
import { DiscoverClient, type DiscoverOrg } from "./discover-client";

export const metadata = {
  title: "Автосервисүүд — Цаг захиалга",
};

// Каталог нь нийтэд нээлттэй (нэвтрэхгүйгээр үзнэ).
export const dynamic = "force-dynamic";

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ serviceKey?: string }>;
}) {
  // `/book` дээр сонгосон системийн ажлын түлхүүр (mobile-ийн Захиалах таб →
  // Хайх таб шилжилттэй ижил) — байхгүй/танигдаагүй бол шүүлтгүй.
  const { serviceKey: requestedServiceKey } = await searchParams;
  // Олон tenant-ийн нийтэд нээлттэй каталог — цор ганц tenant гэж байхгүй.
  setBypassContext();
  // Багц нь онлайн захиалга дэмждэг tenant-уудыг л харуулна.
  const allowedPlans = await plansWithFeature(PLAN_LIMIT_CODES.ONLINE_BOOKING);
  const now = new Date();
  // Ямар ч ангилалд холбогдоогүй түлхүүрийг ШҮҮНЭ ГАРГАНА — сонговол баталгаатай
  // хоосон үр дүн буцаах (map/list бүхэлдээ "олдсонгүй" болж хоосорно) сонголтыг
  // цэсэнд огт харуулахгүй.
  const serviceKeys = await prisma.systemServiceKey.findMany({
    where: { isActive: true, categories: { some: { isActive: true } } },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const tenants = await prisma.tenant.findMany({
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
      phone1: true,
      branches: {
        where: { isActive: true },
        orderBy: { isPrimary: "desc" },
        select: {
          id: true,
          name: true,
          phone: true,
          city: true,
          district: true,
          khoroo: true,
          address: true,
          latitude: true,
          longitude: true,
          ...branchScheduleDisplaySelect(),
        },
      },
      // Идэвхтэй ангилал + аль салбарт хамаарах (хоосон бол бүх салбарт) —
      // "тухайн салбар ямар үйлчилгээ үзүүлдэг"-ийг харуулахад ашиглана
      // (org/[slug]/page.tsx-ийн booking category логиктой ижил зарчим).
      categories: {
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: {
          name: true,
          systemServiceKeyId: true,
          branches: { select: { id: true } },
        },
      },
    },
  });

  const orgs: DiscoverOrg[] = tenants.map((t) => ({
    slug: t.slug,
    name: t.name,
    logoUrl: t.logoUrl,
    phone: t.phone1,
    branches: t.branches.map((b) => {
      const status = branchStatusNow(
        {
          openTime: b.openTime,
          closeTime: b.closeTime,
          schedules: b.schedules.map((s) => ({
            weekday: s.weekday as Weekday,
            isOpen: s.isOpen,
            openTime: s.openTime,
            closeTime: s.closeTime,
          })),
          scheduleExceptions: b.scheduleExceptions,
          scheduleSeasons: b.scheduleSeasons,
        },
        now,
      );
      const weekend = worksEffectiveWeekends({
        openTime: b.openTime,
        closeTime: b.closeTime,
        schedules: b.schedules,
        scheduleExceptions: b.scheduleExceptions,
        scheduleSeasons: b.scheduleSeasons,
      },
        now,
      );
      // Энэ салбарт хамаарах ангилал: хамаарах салбаргүй (бүх салбарт) эсвэл
      // энэ салбарыг шууд сонгосон ангилал.
      const matchingCategories = t.categories.filter(
        (c) => c.branches.length === 0 || c.branches.some((x) => x.id === b.id),
      );
      const services = matchingCategories.map((c) => c.name);
      // Тэдгээр ангиллын холбогдсон системийн ажлын түлхүүрүүд (байгууллага
      // сонгохоос өмнөх "ямар ажил хийлгэх гэж байна?" хайлтад ашиглана).
      const serviceKeyIds = [
        ...new Set(
          matchingCategories
            .map((c) => c.systemServiceKeyId)
            .filter((id): id is string => Boolean(id)),
        ),
      ];
      return {
        id: b.id,
        name: b.name,
        phone: b.phone,
        address: formatAddress(b),
        city: b.city,
        district: b.district,
        lat: b.latitude,
        lng: b.longitude,
        open: status.open,
        hours: status.hours,
        weekend,
        services,
        serviceKeyIds,
      };
    }),
  }));

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold">Цаг захиалах</h1>
        <p className="text-white/40 text-sm mt-1">
          Авто үйлчилгээний газраа газрын зураг эсвэл жагсаалтаас сонгож,
          онлайнаар цаг захиална уу.
        </p>
      </div>

      <DiscoverClient
        orgs={orgs}
        serviceKeys={serviceKeys}
        initialServiceKey={
          serviceKeys.some((k) => k.id === requestedServiceKey)
            ? (requestedServiceKey as string)
            : ""
        }
        apiKey={process.env.GOOGLE_MAP_API_KEY ?? ""}
        mapId={process.env.GOOGLE_MAP_ID ?? ""}
      />
    </div>
  );
}
