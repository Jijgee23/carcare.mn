import { redirect } from "next/navigation";
import { PageHeader } from "@/app/_components/page-header";
import { requireUser } from "@/lib/auth";
import { canCreate } from "@/lib/auth/roles";
import { CustomerForm } from "../customer-form";

export const metadata = {
  title: "Шинэ үйлчлүүлэгч",
};

export default async function NewCustomerPage({
  searchParams,
}: {
  searchParams: Promise<{ fullName?: string; phone?: string }>;
}) {
  const user = await requireUser();
  if (!canCreate(user, "customers")) redirect("/dashboard/customers");

  const { fullName, phone } = await searchParams;
  const hasPrefill = Boolean(fullName?.trim() || phone?.trim());

  return (
    <div className="p-6 sm:p-8 max-full flex-1 flex flex-col min-h-0 w-full">
      <PageHeader
        title="Шинэ үйлчлүүлэгч"
        description="Үйлчлүүлэгчийн харилцагч мэдээллийг оруулна уу."
      />
      <div className="glass rounded-xl p-4 sm:p-5 border border-white/[0.08]">
        <CustomerForm
          initial={
            hasPrefill
              ? {
                  fullName: fullName?.trim() ?? "",
                  phone: phone?.trim() ?? "",
                  email: null,
                  note: null,
                }
              : undefined
          }
        />
      </div>
    </div>
  );
}
