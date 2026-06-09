import { redirect } from "next/navigation";
import { PageHeader } from "@/app/_components/page-header";
import { requireUser } from "@/lib/auth";
import {
  ACTIONS,
  RESOURCES,
  STANDALONE_PERMISSIONS,
} from "@/lib/auth/permissions";
import { RoleForm } from "../role-form";

export const metadata = {
  title: "Шинэ үүрэг",
};

export default async function NewRolePage() {
  const me = await requireUser();
  if (!me.isOwner) redirect("/dashboard/employees");

  return (
    <div className="p-4 sm:p-6 max-w-full flex-1 flex flex-col min-h-0 w-full">
      <PageHeader
        title="Шинэ үүрэг"
        description="Үүрэгт нэр өгч, нөөц бүрд харах/үүсгэх/засах/устгах эрхийг сонгоно уу."
      />
      <div className="glass rounded-xl p-4 sm:p-5 border border-white/[0.08]">
        <RoleForm
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
