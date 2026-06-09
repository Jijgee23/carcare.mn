import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/app/_components/page-header";
import { requireUser } from "@/lib/auth";
import { canEdit } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import { BranchForm } from "../branch-form";

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

  const openDays = branch.schedules
    .filter((s) => s.isOpen)
    .map((s) => s.weekday);

  return (
    <div className="p-4 sm:p-6 max-w-full flex-1 flex flex-col min-h-0 w-full">
      <PageHeader title="Салбар засах" description={branch.name} />
      <div className="glass rounded-xl p-4 sm:p-5 border border-white/[0.08]">
        <BranchForm
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
  );
}
