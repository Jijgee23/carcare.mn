import { requireUser } from "@/lib/auth";
import { canCreate } from "@/lib/auth/roles";
import { redirect } from "next/navigation";
import { BranchForm } from "../branch-form";
import { PageHeader } from "@/app/_components/page-header";

export const metadata = {
  title: "Шинэ салбар",
};

export default async function NewBranchPage() {
  const user = await requireUser();
  if (!canCreate(user, "branches")) redirect("/dashboard/branches");

  return (
    <div className="p-4 sm:p-6 max-w-full flex-1 flex flex-col min-h-0 w-full">
      <PageHeader
        title="Шинэ салбар"
        description="Шинэ салбарын мэдээллийг оруулна уу."
      />
      <div className="glass rounded-xl p-4 sm:p-5 border border-white/[0.08]">
        <BranchForm />
      </div>
    </div>
  );
}
