import { redirect } from "next/navigation";
import { PageHeader } from "@/app/_components/page-header";
import { requireUser } from "@/lib/auth";
import { canCreate } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import { VehicleForm } from "../vehicle-form";

export const metadata = {
  title: "Шинэ машин",
};

export default async function NewVehiclePage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>;
}) {
  const user = await requireUser();
  if (!canCreate(user, "vehicles")) redirect("/dashboard/vehicles");

  const { customerId } = await searchParams;

  const customers = await prisma.customer.findMany({
    where: { tenantId: user.tenantId },
    orderBy: { fullName: "asc" },
    select: { id: true, fullName: true, phone: true },
  });

  const backHref = customerId
    ? `/dashboard/customers/${customerId}`
    : "/dashboard/vehicles";

  return (
    <div className="p-4 sm:p-6 max-w-full flex-1 flex flex-col min-h-0 w-full">
      <PageHeader
        title="Шинэ машин"
        description="Машины үндсэн мэдээлэл, эзэмшигчийг сонгоно уу."
      />
      <div className="glass rounded-xl p-4 sm:p-5 border border-white/[0.08]">
        <VehicleForm
          customers={customers}
          defaultCustomerId={customerId}
          backHref={backHref}
        />
      </div>
    </div>
  );
}


