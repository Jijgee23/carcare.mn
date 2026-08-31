import Link from "next/link";
import { redirect } from "next/navigation";
import { Btn, BtnLink } from "@/app/_components/landing-ops-ui";
import { requireUser } from "@/lib/auth";
import { canCreate } from "@/lib/auth/roles";
import { CUSTOMER_FORM_ID, CustomerForm } from "../customer-form";

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
    <div className="p-4 sm:p-6 max-w-4xl">
      <nav className="flex items-center gap-1.5 text-[13px] text-[var(--oc-muted3)] mb-3">
        <Link href="/dashboard/customers" className="hover:text-[var(--oc-accent-hi)] transition-colors">
          Үйлчлүүлэгчид
        </Link>
        <span>/</span>
        <span className="text-[var(--oc-muted)]">Шинэ үйлчлүүлэгч</span>
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--oc-ink)]">Шинэ үйлчлүүлэгч</h1>
          <p className="text-sm text-[var(--oc-muted3)] mt-1">
            Үйлчлүүлэгчийн харилцагч мэдээллийг оруулна уу.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <BtnLink href="/dashboard/customers" variant="ghost">
            ← Буцах
          </BtnLink>
          <Btn type="submit" form={CUSTOMER_FORM_ID}>
            Үүсгэх
          </Btn>
        </div>
      </div>

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
  );
}
