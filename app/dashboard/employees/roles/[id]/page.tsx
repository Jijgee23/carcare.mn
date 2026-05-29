import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/app/_components/page-header";
import { requireUser } from "@/lib/auth";
import {
  ACTIONS,
  RESOURCES,
  STANDALONE_PERMISSIONS,
} from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { RoleForm } from "../role-form";

export const metadata = {
  title: "Үүрэг засах",
};

export default async function EditRolePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requireUser();
  if (!me.isOwner) redirect("/dashboard/employees");

  const { id } = await params;
  const role = await prisma.role.findFirst({
    where: { id, tenantId: me.tenantId },
    include: { _count: { select: { users: true } } },
  });
  if (!role) notFound();

  return (
    <div className="p-6 sm:p-8 max-full flex-1 flex flex-col min-h-0 w-full">
      <PageHeader
        title="Үүрэг засах"
        description={`${role.name} · ${role._count.users} ажилтан`}
      />
      <div className="glass rounded-xl p-4 sm:p-5 border border-white/[0.08]">
        <RoleForm
          initial={{
            id: role.id,
            name: role.name,
            description: role.description,
            permissions: role.permissions,
            isActive: role.isActive,
          }}
          resources={[...RESOURCES]}
          actions={[...ACTIONS]}
          standalonePermissions={STANDALONE_PERMISSIONS.map((p) => ({
            code: p.code,
            label: p.label,
            description: p.description,
          }))}
        />
      </div>
    </div>
  );
}
