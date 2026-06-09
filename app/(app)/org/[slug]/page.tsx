import Link from "next/link";
import { notFound } from "next/navigation";
import { getAccount } from "@/lib/auth/account";
import { openWeekdaysOf } from "@/lib/branches";
import { prisma } from "@/lib/prisma";
import { BookingForm } from "./booking-form";

export const dynamic = "force-dynamic";

async function loadOrg(slug: string) {
  return prisma.tenant.findFirst({
    where: { slug, acceptsOnlineBooking: true, suspended: false },
    select: {
      id: true,
      name: true,
      logoUrl: true,
      phone1: true,
      branches: {
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
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const org = await loadOrg(slug);
  if (!org) notFound();

  const account = await getAccount();
  const vehicles = account
    ? await prisma.accountVehicle.findMany({
        where: { accountId: account.id },
        orderBy: { createdAt: "desc" },
        select: { id: true, plate: true, make: true, model: true },
      })
    : [];

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
