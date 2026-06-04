import Link from "next/link";
import { redirect } from "next/navigation";
import {
  EmptyState,
  PageHeader,
} from "@/app/_components/page-header";
import { requireUser } from "@/lib/auth";
import {
  ORDER_ASSIGNABLE_WHERE,
  branchScopeId,
  canCreate,
} from "@/lib/auth/roles";
import { type DiagnosticType } from "@/lib/diagnostics";
import { prisma } from "@/lib/prisma";
import { OrderForm } from "../order-form";

export const metadata = {
  title: "Шинэ захиалга",
};

export default async function NewOrderPage() {
  const user = await requireUser();
  if (!canCreate(user, "orders")) redirect("/dashboard/orders");
  const scopeBranchId = branchScopeId(user);

  const [branches, customers, vehicles, technicians, diagnosticTemplates] =
    await Promise.all([
    prisma.branch.findMany({
      where: {
        tenantId: user.tenantId,
        ...(scopeBranchId ? { id: scopeBranchId } : {}),
      },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    }),
    prisma.customer.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, phone: true },
    }),
    prisma.vehicle.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        plate: true,
        make: true,
        model: true,
        customerId: true,
      },
    }),
    prisma.user.findMany({
      where: {
        tenantId: user.tenantId,
        isActive: true,
        ...ORDER_ASSIGNABLE_WHERE,
      },
      orderBy: { firstName: "asc" },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        isOwner: true,
        role: { select: { name: true } },
      },
    }),
    prisma.diagnosticTemplate.findMany({
      where: { tenantId: user.tenantId, isActive: true },
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: { id: true, name: true, type: true },
    }),
  ]);

  if (branches.length === 0) {
    return (
      <div className="p-6 sm:p-8 max-full flex-1 flex flex-col min-h-0 w-full">
        <PageHeader
          title="Шинэ захиалга"
          description="Эхлээд салбар үүсгэх шаардлагатай."
        />
        <EmptyState
          title="Салбар бүртгэгдээгүй"
          description="Захиалга үүсгэхийн тулд эхлээд салбараа бүртгэнэ үү."
          cta={
            <Link
              href="/dashboard/branches/new"
              className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 transition-colors px-4 py-2.5 rounded-xl text-sm font-medium"
            >
              Салбар нэмэх
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8 max-full flex-1 flex flex-col min-h-0 w-full">
      <PageHeader
        title="Шинэ захиалга"
        description="Үйлчилгээний захиалгын үндсэн мэдээллийг оруулна уу. Ажил, сэлбэгийн мөрийг дараа нь нэмнэ."
      />
      <div className="glass rounded-xl p-4 sm:p-5 border border-white/[0.08]">
        <OrderForm
          branches={branches}
          customers={customers}
          vehicles={vehicles}
          technicians={technicians}
          diagnosticTemplates={diagnosticTemplates.map((t) => ({
            id: t.id,
            name: t.name,
            type: t.type as DiagnosticType,
          }))}
        />
      </div>
    </div>
  );
}
