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

  const employee = await prisma.user.findFirst({
    where: { id, tenantId: me.tenantId },
  });
  if (!employee) notFound();

  // Идэвхтэй салбарууд + энэ ажилтны одоогийн харьяалал/сонголтод байгаа
  // (боловч хожим идэвхгүй болсон байж болзошгүй) салбаруудыг хамт харуулна.
  const currentBranchIds = [
    ...(employee.branchId ? [employee.branchId] : []),
    ...employee.assignableBranchIds,
  ];

  const [branches, roles] = await Promise.all([
    prisma.branch.findMany({
      where: {
        tenantId: me.tenantId,
        OR: [{ isActive: true }, { id: { in: currentBranchIds } }],
      },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    }),
    prisma.role.findMany({
      where: { tenantId: me.tenantId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const avatar = (
    <div className="w-12 h-12 shrink-0 rounded-full bg-gradient-to-br from-violet-500/40 to-blue-500/40 border border-white/10 flex items-center justify-center font-bold text-white/90">
      {`${employee.lastName.slice(0, 1)}${employee.firstName.slice(0, 1)}`.toUpperCase()}
    </div>
  );

  // Тенант админы үүргийг засах боломжгүй (зөвхөн профайлаар нэр/нууц үг солино).
  if (employee.isOwner) {
    return (
      <div className="p-4 sm:p-6 max-w-full flex-1 flex flex-col min-h-0 w-full">
        <div className="w-full">
          <PageHeader
            title="Ажилтан засах"
            description={`${employee.lastName} ${employee.firstName} · Админ`}
            leading={avatar}
          />
          <div className="glass rounded-xl p-5 border border-violet-500/20 text-sm text-white/70">
            Тенант админы үүрэг, мэдээллийг засах боломжгүй. Тус админ өөрөө{" "}
            <a href="/dashboard/profile" className="underline hover:text-white">
              профайлаасаа
            </a>{" "}
            өөрчилнө.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-full flex-1 flex flex-col min-h-0 w-full">
      <div className="w-full">
        <PageHeader
          title="Ажилтан засах"
          description={`${employee.lastName} ${employee.firstName}`}
          leading={avatar}
        />
        <div className="glass rounded-xl p-5 sm:p-6 border border-white/[0.08]">
          <EmployeeForm
            initial={{
              id: employee.id,
              firstName: employee.firstName,
              lastName: employee.lastName,
              email: employee.email,
              phone: employee.phone,
              roleId: employee.roleId,
              branchId: employee.branchId,
              assignableBranchIds: employee.assignableBranchIds,
              isActive: employee.isActive,
              activeUntil: employee.activeUntil,
            }}
            branches={branches}
            roles={roles}
          />
        </div>
      </div>
    </div>
  );
}
