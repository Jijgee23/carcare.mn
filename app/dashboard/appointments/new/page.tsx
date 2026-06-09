import { redirect } from "next/navigation";
import { PageHeader } from "@/app/_components/page-header";
import { requireUser } from "@/lib/auth";
import { branchScopeId, canCreate } from "@/lib/auth/roles";
import { openWeekdaysOf } from "@/lib/branches";
import { prisma } from "@/lib/prisma";
import { AppointmentForm } from "../appointment-form";

export const metadata = {
  title: "Цаг бүртгэх",
};

export default async function NewAppointmentPage() {
  const user = await requireUser();
  if (!canCreate(user, "appointments")) redirect("/dashboard/appointments");
  const scopeBranchId = branchScopeId(user);

  const [branches, customers] = await Promise.all([
    prisma.branch.findMany({
      where: {
        tenantId: user.tenantId,
        ...(scopeBranchId ? { id: scopeBranchId } : {}),
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        openTime: true,
        closeTime: true,
        schedules: { select: { weekday: true, isOpen: true } },
      },
    }),
    prisma.customer.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, phone: true },
    }),
  ]);

  return (
    <div className="p-4 sm:p-6 max-w-full flex-1 flex flex-col min-h-0 w-full">
      <PageHeader
        title="Цаг бүртгэх"
        description="Утсаар орж ирсэн цаг захиалгыг гараар бүртгэнэ. Үйлчлүүлэгчээ сонгоод товлох цагийг оруулна уу."
      />
      <div className="glass rounded-xl p-4 sm:p-5 border border-white/[0.08]">
        <AppointmentForm
          branches={branches.map((b) => ({
            id: b.id,
            name: b.name,
            openWeekdays: openWeekdaysOf(b),
          }))}
          customers={customers}
          defaultBranchId={scopeBranchId ?? undefined}
        />
      </div>
    </div>
  );
}
