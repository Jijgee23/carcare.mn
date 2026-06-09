import { redirect } from "next/navigation";
import { PageHeader } from "@/app/_components/page-header";
import { requireUser } from "@/lib/auth";
import { canCreate } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import { EmployeeForm } from "../employee-form";

export const metadata = {
  title: "Шинэ ажилтан",
};

export default async function NewEmployeePage() {
  const me = await requireUser();
  if (!canCreate(me, "employees")) redirect("/dashboard/employees");

  const [branches, roles] = await Promise.all([
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

  return (
    <div className="p-4 sm:p-6 max-w-full flex-1 flex flex-col min-h-0 w-full">
      <PageHeader
        title="Шинэ ажилтан"
        description="Ажилтны үндсэн мэдээллийг оруулна уу. Тэр энэ имэйл, нууц үгээр нэвтрэх болно."
      />
      {roles.length === 0 ? (
        <div className="glass rounded-xl p-5 border border-amber-500/30 text-sm text-amber-200">
          Эхлээд{" "}
          <a
            href="/dashboard/employees/roles/new"
            className="underline hover:text-amber-100"
          >
            хэрэглэгчийн үүрэг үүсгэнэ үү
          </a>
          . Ажилтны үүргийг үүсгэсэн үүргүүдээс сонгох болно.
        </div>
      ) : (
        <div className="glass rounded-xl p-4 sm:p-5 border border-white/[0.08]">
          <EmployeeForm branches={branches} roles={roles} />
        </div>
      )}
    </div>
  );
}
