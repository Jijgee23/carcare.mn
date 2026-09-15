import Link from "next/link";
import {
  type Weekday,
  branchStatusNow,
  formatAddress,
} from "@/lib/branches";
import { branchScheduleDisplaySelect } from "@/lib/branch-effective-schedule-server";
import { PLAN_LIMIT_CODES } from "@/lib/plan-limits";
import { plansWithFeature } from "@/lib/plan-limits-server";
import { prisma } from "@/lib/prisma";
import { setBypassContext } from "@/lib/tenant-context";
import { ServiceKeyPicker } from "./service-key-picker";

export const metadata = {
  title: "Цаг захиалах — ямар ажил хийлгэх вэ?",
};

// Нийтэд нээлттэй (нэвтрэхгүйгээр үзнэ), олон tenant дээгүүрх систем каталог.
export const dynamic = "force-dynamic";

/**
 * Захиалгын эхлэл — mobile аппын "Захиалах" таб (`ServiceKeyPickerScreen`)-тай
 * ижил зорилготой боловч энд ХЭДЭН Ч ажлын түлхүүр зэрэг сонгож болно (mobile
 * одоогоор нэг л түлхүүр дэмждэг). Урсгал:
 *
 *   1. Энд (`?keys` алга) — SystemServiceKey-үүдийг олоор сонгоно
 *      (`ServiceKeyPicker`).
 *   2. Ижил хуудас, `?keys=id1,id2,...`-тэй бол — сонгосон БҮХ түлхүүрийг
 *      (АНД) санал болгодог салбаруудыг жагсаана (`/discover`-ийг дайрахгүй).
 *   3. Тэндээс салбар сонгоход шууд `/book/branch/[branchId]` дээрх
 *      огноо/цагийн сонголт руу шилжинэ — ангилал дахин сонгуулахгүй, учир нь
 *      аль хэдийн энд сонгосон. Цаашдын хэсэг (машин, тэмдэглэл, огноо/цаг,
 *      илгээх) хуучин `/org/[slug]` дээрх `BookingForm`-той яг адил.
 *
 * Шинэ endpoint шаардлагагүй: бүгд server component дотор шууд Prisma-аар.
 */
export default async function BookStartPage({
  searchParams,
}: {
  searchParams: Promise<{ keys?: string }>;
}) {
  setBypassContext();
  const { keys: keysParam } = await searchParams;
  const serviceKeys = await prisma.systemServiceKey.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const validIds = new Set(serviceKeys.map((k) => k.id));
  const selectedIds = (keysParam ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((id) => validIds.has(id));

  if (selectedIds.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <div>
          <h1 className="text-2xl font-bold">Ямар ажил хийлгэх гэж байна?</h1>
          <p className="text-[var(--oc-muted3)] text-sm mt-1">
            Нэг буюу хэд хэдэн ажлын төрлөө сонгоход тэдгээрийг БҮГДийг нь
            гүйцэтгэдэг салбарууд л дараагийн алхамд харагдана. Алгасаад бүх
            автосервисийг үзэж ч болно.
          </p>
        </div>

        {serviceKeys.length === 0 ? (
          <div className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] p-10 text-center text-sm text-[var(--oc-muted3)]">
            Ажлын төрөл алга байна. Бүх автосервисийг{" "}
            <Link
              href="/discover"
              className="text-[var(--oc-accent)] hover:text-[var(--oc-accent-hi)]"
            >
              каталогоос
            </Link>{" "}
            үзнэ үү.
          </div>
        ) : (
          <ServiceKeyPicker serviceKeys={serviceKeys} />
        )}

        <div>
          <Link
            href="/discover"
            className="text-sm text-[var(--oc-accent)] hover:text-[var(--oc-accent-hi)] transition-colors"
          >
            Алгасах — бүх автосервисийг харах →
          </Link>
        </div>
      </div>
    );
  }

  const selectedNames = serviceKeys
    .filter((k) => selectedIds.includes(k.id))
    .map((k) => k.name);

  const allowedPlans = await plansWithFeature(PLAN_LIMIT_CODES.ONLINE_BOOKING);
  const now = new Date();
  const tenants = await prisma.tenant.findMany({
    where: {
      acceptsOnlineBooking: true,
      suspended: false,
      plan: { in: allowedPlans },
    },
    orderBy: { name: "asc" },
    select: {
      name: true,
      logoUrl: true,
      branches: {
        where: { isActive: true },
        orderBy: { isPrimary: "desc" },
        select: {
          id: true,
          name: true,
          city: true,
          district: true,
          khoroo: true,
          address: true,
          ...branchScheduleDisplaySelect(),
        },
      },
      // `/discover`-тэй ижил зарчим: идэвхтэй ангилал + аль салбарт хамаарах
      // (хоосон бол бүх салбарт).
      categories: {
        where: { isActive: true },
        select: {
          systemServiceKeyId: true,
          branches: { select: { id: true } },
        },
      },
    },
  });

  const results: {
    id: string;
    name: string;
    tenantName: string;
    logoUrl: string | null;
    address: string;
    open: boolean;
    hours: string | null;
  }[] = [];
  for (const t of tenants) {
    for (const b of t.branches) {
      const branchServiceKeyIds = new Set(
        t.categories
          .filter((c) => c.branches.length === 0 || c.branches.some((x) => x.id === b.id))
          .map((c) => c.systemServiceKeyId),
      );
      const coversAll = selectedIds.every((id) => branchServiceKeyIds.has(id));
      if (!coversAll) continue;
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
      results.push({
        id: b.id,
        name: b.name,
        tenantName: t.name,
        logoUrl: t.logoUrl,
        address: formatAddress(b),
        open: status.open,
        hours: status.hours,
      });
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link
          href="/book"
          className="text-sm text-[var(--oc-muted3)] hover:text-[var(--oc-ink)] transition-colors"
        >
          ← Ажлын төрлөө дахин сонгох
        </Link>
        <h1 className="text-2xl font-bold mt-2">
          {selectedNames.join(", ")}
        </h1>
        <p className="text-[var(--oc-muted3)] text-sm mt-1">
          Эдгээр ажлыг БҮГДийг нь гүйцэтгэдэг {results.length} салбар олдлоо.
        </p>
      </div>

      {results.length === 0 ? (
        <div className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] p-10 text-center text-sm text-[var(--oc-muted3)]">
          Сонгосон ажлуудыг зэрэг гүйцэтгэдэг салбар олдсонгүй. Ажлын
          төрлөөсөө хасаад дахин үзнэ үү, эсвэл{" "}
          <Link
            href="/discover"
            className="text-[var(--oc-accent)] hover:text-[var(--oc-accent-hi)]"
          >
            бүх каталогоос
          </Link>{" "}
          өөрөө хайж үзнэ үү.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((r) => (
            <Link
              key={r.id}
              href={`/book/branch/${r.id}?keys=${selectedIds.map(encodeURIComponent).join(",")}`}
              className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] p-4 flex flex-col gap-2 hover:bg-[var(--oc-panel2)] transition-colors"
            >
              <div className="flex items-center gap-3">
                {r.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={r.logoUrl}
                    alt=""
                    className="w-10 h-10 rounded-lg object-contain bg-[var(--oc-panel2)] border border-[var(--oc-line)] shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-[var(--oc-accent)]/12 border border-[var(--oc-accent)]/30 shrink-0 flex items-center justify-center text-sm font-bold text-[var(--oc-accent)]">
                    {r.tenantName.slice(0, 1)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-[var(--oc-ink)] truncate">
                    {r.name}
                  </div>
                  <div className="text-xs text-[var(--oc-muted3)] truncate">
                    {r.tenantName}
                  </div>
                </div>
              </div>
              <div className="text-xs text-[var(--oc-muted3)] truncate">
                {r.address}
              </div>
              <div className={`text-xs font-medium ${r.open ? "text-emerald-500" : "text-[var(--oc-muted3)]"}`}>
                {r.open ? "Нээлттэй" : "Хаалттай"} · {r.hours}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
