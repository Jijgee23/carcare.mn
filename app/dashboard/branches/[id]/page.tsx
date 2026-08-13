import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/app/_components/page-header";
import { requireUser } from "@/lib/auth";
import { canEdit } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import { BranchForm } from "../branch-form";
import { getAddressData } from "@/lib/address";

export const metadata = {
  title: "Салбар засах",
};

export default async function EditBranchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  if (!canEdit(user, "branches")) redirect("/dashboard/branches");

  const { id } = await params;
  const branch = await prisma.branch.findFirst({
    where: { id, tenantId: user.tenantId },
    include: {
      schedules: { select: { weekday: true, isOpen: true } },
    },
  });
  if (!branch) notFound();

  const addressData = await getAddressData();

  const openDays = branch.schedules
    .filter((s) => s.isOpen)
    .map((s) => s.weekday);

  // Хаяг байгаа хэсгүүдийг нэг мөр болгож header-ийн тайлбарт үзүүлнэ.
  const addressLine = [branch.district, branch.khoroo, branch.address]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="p-4 sm:p-6 max-w-full flex-1 flex flex-col min-h-0 w-full">
      <div className="w-full">
        <PageHeader
          title={branch.name}
          description={addressLine || "Салбар засах"}
          leading={
            <div className="w-12 h-12 shrink-0 rounded-full bg-gradient-to-br from-violet-500/40 to-blue-500/40 border border-white/10 flex items-center justify-center font-bold text-white/90">
              {branch.name.slice(0, 1).toUpperCase()}
            </div>
          }
          actions={
            <div className="flex items-center gap-2">
              {branch.isPrimary ? (
                <span className="text-xs px-3 py-1.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/30 light:text-violet-700">
                  Үндсэн салбар
                </span>
              ) : null}
              {branch.openTime && branch.closeTime ? (
                <span className="text-xs px-3 py-1.5 rounded-full bg-white/[0.04] text-white/60 border border-white/[0.08] tabular-nums">
                  {branch.openTime}–{branch.closeTime}
                </span>
              ) : null}
            </div>
          }
        />
        <div className="glass rounded-xl p-5 sm:p-6 border border-white/[0.08]">
          <BranchForm
            addressData={addressData}
            mapApiKey={process.env.GOOGLE_MAP_API_KEY ?? ""}
            mapId={process.env.GOOGLE_MAP_ID ?? ""}
            initial={{
              id: branch.id,
              name: branch.name,
              phone: branch.phone,
              city: branch.city,
              district: branch.district,
              khoroo: branch.khoroo,
              address: branch.address,
              latitude: branch.latitude,
              longitude: branch.longitude,
              openTime: branch.openTime,
              closeTime: branch.closeTime,
              slotMinutes: branch.slotMinutes,
              slotCapacity: branch.slotCapacity,
              openDays,
              isPrimary: branch.isPrimary,
            }}
          />
        </div>
      </div>
    </div>
  );
}
