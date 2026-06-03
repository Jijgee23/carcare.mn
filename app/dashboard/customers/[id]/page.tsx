import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/app/_components/page-header";
import { requireUser } from "@/lib/auth";
import { canEdit } from "@/lib/auth/roles";
import { customerLabel } from "@/lib/customers";
import { prisma } from "@/lib/prisma";
import { CustomerForm } from "../customer-form";

export const metadata = {
  title: "Үйлчлүүлэгч засах",
};

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  if (!canEdit(user, "customers")) redirect("/dashboard/customers");

  const { id } = await params;
  const customer = await prisma.customer.findFirst({
    where: { id, tenantId: user.tenantId },
    include: {
      vehicles: { orderBy: { createdAt: "desc" } },
      _count: { select: { serviceOrders: true } },
    },
  });
  if (!customer) notFound();

  return (
    <div className="p-6 sm:p-8 max-full flex-1 flex flex-col min-h-0 w-full">
      <PageHeader
        title={customerLabel(customer)}
        description={`${customer.phone} · ${customer._count.serviceOrders} захиалга`}
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3 glass rounded-xl p-4 sm:p-5 border border-white/[0.08]">
          <h2 className="font-semibold mb-4">Мэдээлэл</h2>
          <CustomerForm
            initial={{
              id: customer.id,
              fullName: customer.fullName,
              phone: customer.phone,
              email: customer.email,
              note: customer.note,
            }}
          />
        </div>

        <div className="lg:col-span-2">
          <div className="glass rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <h2 className="font-semibold">Машинууд</h2>
              <Link
                href={`/dashboard/vehicles/new?customerId=${customer.id}`}
                className="text-xs bg-violet-600 hover:bg-violet-500 transition-colors px-3 py-1.5 rounded-lg font-medium"
              >
                + Машин
              </Link>
            </div>

            {customer.vehicles.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-white/40">
                Энэ үйлчлүүлэгчид машин бүртгээгүй байна.
              </div>
            ) : (
              <ul className="divide-y divide-white/[0.04]">
                {customer.vehicles.map((v) => (
                  <li key={v.id}>
                    <Link
                      href={`/dashboard/vehicles/${v.id}`}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500/20 to-blue-500/20 flex items-center justify-center text-xs font-mono font-semibold text-violet-300 shrink-0">
                        {v.plate.slice(0, 3).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-white/90 truncate">
                          {v.make} {v.model}
                          {v.year ? (
                            <span className="text-white/40"> · {v.year}</span>
                          ) : null}
                        </div>
                        <div className="text-xs text-white/40">{v.plate}</div>
                      </div>
                      <span className="text-white/30 text-sm">→</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
