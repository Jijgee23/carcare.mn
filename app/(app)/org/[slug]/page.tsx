import Link from "next/link";
import { notFound } from "next/navigation";
import { getAccount } from "@/lib/auth/account";
import { openWeekdaysOf } from "@/lib/branches";
import { prisma } from "@/lib/prisma";
import { setBypassContext } from "@/lib/tenant-context";
import { BookingForm } from "./booking-form";

export const dynamic = "force-dynamic";

/**
 * Хэрэглэгчийн машины нэгдсэн жагсаалт: өөрийн нэмсэн (AccountVehicle) +
 * сервисээс бүртгэгдэж холбогдсон (TenantVehicle, account эсвэл утсаар).
 * Global vehicleId-аар давхардлыг арилгана.
 */
async function loadAccountVehicles(accountId: string, phone: string) {
  const VEH_SELECT = { plate: true, make: true, model: true } as const;
  const [avLinks, ownedTV] = await Promise.all([
    prisma.accountVehicle.findMany({
      where: { accountId },
      orderBy: { createdAt: "desc" },
      select: { vehicleId: true, vehicle: { select: VEH_SELECT } },
    }),
    prisma.tenantVehicle.findMany({
      where: {
        OR: [
          { customer: { accountId } },
          { customer: { phone: { endsWith: phone } } },
        ],
      },
      select: { vehicleId: true, vehicle: { select: VEH_SELECT } },
      distinct: ["vehicleId"],
    }),
  ]);
  const map = new Map<
    string,
    { id: string; plate: string; make: string; model: string }
  >();
  for (const r of [...avLinks, ...ownedTV]) {
    if (!map.has(r.vehicleId)) map.set(r.vehicleId, { id: r.vehicleId, ...r.vehicle });
  }
  return [...map.values()];
}

async function loadOrg(slug: string) {
  return prisma.tenant.findFirst({
    where: { slug, acceptsOnlineBooking: true, suspended: false },
    select: {
      id: true,
      name: true,
      logoUrl: true,
      phone1: true,
      branches: {
        where: { isActive: true },
        orderBy: { isPrimary: "desc" },
        select: {
          id: true,
          name: true,
          openTime: true,
          closeTime: true,
          schedules: { select: { weekday: true, isOpen: true } },
        },
      },
    },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const org = await loadOrg(slug);
  return { title: org ? `${org.name} — Цаг захиалах` : "Олдсонгүй" };
}

export default async function OrgPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ branch?: string }>;
}) {
  const { slug } = await params;
  const { branch: branchParam } = await searchParams;
  // Нэвтрээгүй зочид ч үзэх нийтэд нээлттэй хуудас — slug-аар олох Tenant
  // хараахан тодорхойгүй, доор Account-ийн машины жагсаалт бас cross-tenant
  // (өөр tenant-д бүртгэгдсэн машиныг ч харуулна) тул bypass ашиглана.
  setBypassContext();
  const org = await loadOrg(slug);
  if (!org) notFound();

  // Discover картаас ирсэн салбарыг урьдчилан сонгоно (org-д хамаарвал).
  const initialBranchId =
    branchParam && org.branches.some((b) => b.id === branchParam)
      ? branchParam
      : "";

  const account = await getAccount();
  const [vehicles, categories] = await Promise.all([
    // Хэрэглэгчийн бүх машин — өөрөө нэмсэн (AccountVehicle) дээр нэмээд
    // сервисүүдэд бүртгэлтэй, энэ хэрэглэгчид холбогдсон машинууд
    // (/account/vehicles хуудастай ижил логик). Утга нь global Vehicle id.
    account ? loadAccountVehicles(account.id, account.phone) : Promise.resolve([]),
    // Идэвхтэй ангилал + аль салбарт хамаарах (хоосон бол бүх салбарт).
    prisma.category
      .findMany({
        where: { tenantId: org.id, isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, branches: { select: { id: true } } },
      })
      .then((rows) =>
        rows.map((c) => ({
          id: c.id,
          name: c.name,
          branchIds: c.branches.map((b) => b.id),
        })),
      ),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/discover"
        className="text-sm text-white/40 hover:text-white/70 transition-colors"
      >
        ← Бүх газар
      </Link>

      <div className="flex items-center gap-4">
        {org.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={org.logoUrl}
            alt=""
            className="w-16 h-16 rounded-2xl object-contain bg-white/[0.04] border border-white/[0.06] shrink-0"
          />
        ) : (
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/30 to-blue-500/30 border border-white/[0.06] shrink-0 flex items-center justify-center text-xl font-bold text-white/70">
            {org.name.slice(0, 1)}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold">{org.name}</h1>
          <p className="text-white/40 text-sm mt-0.5">{org.phone1}</p>
        </div>
      </div>

      {/* Захиалга */}
      <div className="w-full">
        <div className="glass rounded-2xl p-5 border border-white/[0.08]">
          <h2 className="font-semibold mb-4">Цаг захиалах</h2>
          {org.branches.length === 0 ? (
            <p className="text-sm text-white/40">
              Энэ газар идэвхтэй салбаргүй байна.
            </p>
          ) : account ? (
            <BookingForm
              branches={org.branches.map((b) => ({
                id: b.id,
                name: b.name,
                openWeekdays: openWeekdaysOf(b),
              }))}
              vehicles={vehicles}
              categories={categories}
              initialBranchId={initialBranchId}
            />
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-white/50">
                Цаг захиалахын тулд эхлээд нэвтэрнэ үү.
              </p>
              <Link
                href="/login"
                className="self-start bg-violet-600 hover:bg-violet-500 transition-colors px-5 py-2.5 rounded-xl font-medium text-sm"
              >
                Нэвтрэх / Бүртгүүлэх →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
