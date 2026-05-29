import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/app/_components/page-header";
import { requireUser } from "@/lib/auth";
import { canEdit } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import { EmployeeForm } from "../employee-form";

export const metadata = {
  title: "Ажилтан засах",
};

export default async function EditEmployeePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requireUser();
  if (!canEdit(me, "employees")) redirect("/dashboard/employees");

  const { id } = await params;

  const [employee, branches, roles] = await Promise.all([
    prisma.user.findFirst({
      where: { id, tenantId: me.tenantId },
    }),
    prisma.branch.findMany({
      where: { tenantId: me.tenantId },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    }),
    prisma.role.findMany({
      where: { tenantId: me.tenantId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (!employee) notFound();

  // Тенант админы үүргийг засах боломжгүй (зөвхөн профайлаар нэр/нууц үг солино).
  if (employee.isOwner) {
    return (
      <div className="p-6 sm:p-8 max-full flex-1 flex flex-col min-h-0 w-full">
        <PageHeader
          title="Ажилтан засах"
          description={`${employee.lastName} ${employee.firstName} · Админ`}
        />
        <div className="glass rounded-xl p-5 border border-violet-500/20 text-sm text-white/70">
          Тенант админы үүрэг, мэдээллийг засах боломжгүй. Тус админ өөрөө{" "}
          <a href="/dashboard/profile" className="underline hover:text-white">
            профайлаасаа
          </a>{" "}
          өөрчилнө.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8 max-full flex-1 flex flex-col min-h-0 w-full">
      <PageHeader
        title="Ажилтан засах"
        description={`${employee.lastName} ${employee.firstName}`}
      />
      <div className="glass rounded-xl p-4 sm:p-5 border border-white/[0.08]">
        <EmployeeForm
          initial={{
            id: employee.id,
            firstName: employee.firstName,
            lastName: employee.lastName,
            email: employee.email,
            phone: employee.phone,
            roleId: employee.roleId,
            branchId: employee.branchId,
            isActive: employee.isActive,
            activeUntil: employee.activeUntil,
          }}
          branches={branches}
          roles={roles}
        />
      </div>
    </div>
  );
}
