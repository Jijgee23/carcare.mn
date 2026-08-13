import { requireUser } from "@/lib/auth";
import { canCreate } from "@/lib/auth/roles";
import { redirect } from "next/navigation";
import { BranchForm } from "../branch-form";
import { PageHeader } from "@/app/_components/page-header";
import { getAddressData } from "@/lib/address";

export const metadata = {
  title: "Шинэ салбар",
};

export default async function NewBranchPage() {
  const user = await requireUser();
  if (!canCreate(user, "branches")) redirect("/dashboard/branches");

  const addressData = await getAddressData();

  return (
    <div className="p-4 sm:p-6 max-w-full flex-1 flex flex-col min-h-0 w-full">
      <div className="w-full">
        <PageHeader
          title="Шинэ салбар"
          description="Шинэ салбарын мэдээллийг оруулна уу."
        />
        <div className="glass rounded-xl p-5 sm:p-6 border border-white/[0.08]">
          <BranchForm
            addressData={addressData}
            mapApiKey={process.env.GOOGLE_MAP_API_KEY ?? ""}
            mapId={process.env.GOOGLE_MAP_ID ?? ""}
          />
        </div>
      </div>
    </div>
  );
}
