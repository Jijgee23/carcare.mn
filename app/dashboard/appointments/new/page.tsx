import Link from "next/link";
import { redirect } from "next/navigation";
import { Btn, BtnLink } from "@/app/_components/landing-ops-ui";
import { requireUser } from "@/lib/auth";
import { branchScopeId, canCreate } from "@/lib/auth/roles";
import { openWeekdaysOf } from "@/lib/branches";
import { prisma } from "@/lib/prisma";
import { APPOINTMENT_FORM_ID, AppointmentForm } from "../appointment-form";

export const metadata = {
  title: "Цаг бүртгэх",
};

export default async function NewAppointmentPage() {
  const user = await requireUser();
  if (!canCreate(user, "appointments")) redirect("/dashboard/appointments");
  const scopeBranchId = branchScopeId(user);

  const [branches, customers, categories] = await Promise.all([
    prisma.branch.findMany({
      where: {
        tenantId: user.tenantId,
        isActive: true,
        ...(scopeBranchId ? { id: scopeBranchId } : {}),
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        openTime: true,
        closeTime: true,
        schedules: { select: { weekday: true, isOpen: true } },
      },
    }),
    prisma.customer.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, phone: true },
    }),
    prisma.category
      .findMany({
        where: { tenantId: user.tenantId, isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, branches: { select: { id: true } } },
      })
      .then((rows) =>
        rows.map((c) => ({
          id: c.id,
          name: c.name,
          branchIds: c.branches.map((b) => b.id),
        })),
      ),
  ]);

  return (
    <div className="p-4 sm:p-6 max-w-full flex-1 flex flex-col min-h-0 w-full">
      <nav className="flex items-center gap-1.5 text-[13px] text-[var(--oc-muted3)] mb-3">
        <Link href="/dashboard/appointments" className="hover:text-[var(--oc-accent-hi)] transition-colors">
          Цаг захиалга
        </Link>
        <span>/</span>
        <span className="text-[var(--oc-muted)]">Цаг бүртгэх</span>
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--oc-ink)]">Цаг бүртгэх</h1>
          <p className="text-sm text-[var(--oc-muted3)] mt-1">
            Утсаар орж ирсэн цаг захиалгыг гараар бүртгэнэ. Үйлчлүүлэгчээ сонгоод товлох цагийг оруулна уу.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <BtnLink href="/dashboard/appointments" variant="ghost">
            ← Буцах
          </BtnLink>
          <Btn type="submit" form={APPOINTMENT_FORM_ID}>
            Цаг бүртгэх
          </Btn>
        </div>
      </div>

      <div className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] p-4 sm:p-5">
        <AppointmentForm
          branches={branches.map((b) => ({
            id: b.id,
            name: b.name,
            openWeekdays: openWeekdaysOf(b),
          }))}
          customers={customers}
          categories={categories}
          defaultBranchId={scopeBranchId ?? undefined}
        />
      </div>
    </div>
  );
}
