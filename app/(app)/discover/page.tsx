import Link from "next/link";
import { PLAN_LIMIT_CODES } from "@/lib/plan-limits";
import { plansWithFeature } from "@/lib/plan-limits-server";
import { prisma } from "@/lib/prisma";
import { DiscoverMap, type MapMarker } from "./discover-map";

export const metadata = {
  title: "Газрууд — Цаг захиалга",
};

// Каталог нь нийтэд нээлттэй (нэвтрэхгүйгээр үзнэ).
export const dynamic = "force-dynamic";

function branchAreas(
  branches: { city: string | null; district: string | null }[],
): string {
  const areas = Array.from(
    new Set(
      branches
        .map((b) => [b.city, b.district].filter(Boolean).join(", "))
        .filter(Boolean),
    ),
  );
  return areas.join(" · ");
}

export default async function DiscoverPage() {
  // Багц нь онлайн захиалга дэмждэг tenant-уудыг л харуулна (toggle асаалттай ч
  // багцаа downgrade хийсэн бол каталогт гарахгүй).
  const allowedPlans = await plansWithFeature(PLAN_LIMIT_CODES.ONLINE_BOOKING);
  const tenants = await prisma.tenant.findMany({
    where: {
      acceptsOnlineBooking: true,
      suspended: false,
      plan: { in: allowedPlans },
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
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
        },
      },
    },
  });

  const markers: MapMarker[] = tenants.flatMap((t) =>
    t.branches
      .filter((b) => b.latitude != null && b.longitude != null)
      .map((b) => ({
        lat: b.latitude as number,
        lng: b.longitude as number,
        orgName: t.name,
        branchName: b.name,
        slug: t.slug,
      })),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Цаг захиалах</h1>
        <p className="text-white/40 text-sm mt-1">
          Авто үйлчилгээний газраа сонгож, онлайнаар цаг захиална уу.
        </p>
      </div>

      {markers.length > 0 ? <DiscoverMap markers={markers} /> : null}

      {tenants.length === 0 ? (
        <div className="glass rounded-2xl p-10 border border-white/[0.08] text-center text-sm text-white/40">
          Одоогоор онлайн цаг захиалга нээсэн газар алга.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {tenants.map((t) => (
            <Link
              key={t.id}
              href={`/org/${t.slug}`}
              className="glass rounded-2xl p-4 border border-white/[0.08] hover:border-violet-500/30 hover:bg-white/[0.03] transition-all flex items-center gap-4"
            >
              {t.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={t.logoUrl}
                  alt=""
                  className="w-12 h-12 rounded-xl object-contain bg-white/[0.04] border border-white/[0.06] shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500/30 to-blue-500/30 border border-white/[0.06] shrink-0 flex items-center justify-center font-bold text-white/70">
                  {t.name.slice(0, 1)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-white/90 truncate">
                  {t.name}
                </div>
                <div className="text-xs text-white/40 mt-0.5 truncate">
                  {t.branches.length} салбар
                  {branchAreas(t.branches) ? ` · ${branchAreas(t.branches)}` : ""}
                </div>
              </div>
              <span className="text-violet-300 text-sm shrink-0">→</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
