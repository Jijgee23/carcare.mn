import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/app/_components/page-header";
import { requireUser } from "@/lib/auth";
import { canEdit } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import { VehicleForm } from "../vehicle-form";

export const metadata = {
  title: "Машин засах",
};

export default async function EditVehiclePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  if (!canEdit(user, "vehicles")) redirect("/dashboard/vehicles");

  const { id } = await params;

  const [vehicle, customers] = await Promise.all([
    prisma.vehicle.findFirst({
      where: { id, tenantId: user.tenantId },
    }),
    prisma.customer.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, phone: true },
    }),
  ]);

  if (!vehicle) notFound();

  return (
    <div className="p-6 sm:p-8 max-full flex-1 flex flex-col min-h-0 w-full">
      <PageHeader
        title={`${vehicle.make} ${vehicle.model}`}
        description={vehicle.plate}
      />
      <div className="glass rounded-xl p-4 sm:p-5 border border-white/[0.08]">
        <VehicleForm
          initial={{
            id: vehicle.id,
            plate: vehicle.plate,
            vin: vehicle.vin,
            make: vehicle.make,
            model: vehicle.model,
            year: vehicle.year,
            mileage: vehicle.mileage,
            fuelType: vehicle.fuelType,
            wheelPosition: vehicle.wheelPosition,
            customerId: vehicle.customerId,
          }}
          customers={customers}
        />
      </div>
    </div>
  );
}
