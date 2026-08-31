import Link from "next/link";
import { redirect } from "next/navigation";
import { Btn, BtnLink } from "@/app/_components/landing-ops-ui";
import { requireUser } from "@/lib/auth";
import {
  ORDER_ASSIGNABLE_WHERE,
  branchScopeId,
  canCreate,
} from "@/lib/auth/roles";
import { type DiagnosticType } from "@/lib/diagnostics";
import { prisma } from "@/lib/prisma";
import { ORDER_FORM_ID, OrderForm } from "../order-form";

export const metadata = {
  title: "Шинэ захиалга",
};

export default async function NewOrderPage({
  searchParams,
}: {
  searchParams: Promise<{
    branchId?: string;
    customerId?: string;
    vehicleId?: string;
    scheduledAt?: string;
    note?: string;
    appointmentId?: string;
  }>;
}) {
  const user = await requireUser();
  if (!canCreate(user, "orders")) redirect("/dashboard/orders");
  const scopeBranchId = branchScopeId(user);

  const sp = await searchParams;
  // Цаг захиалгаас ирсэн prefill (customer/branch/цаг). Ямар нэг утга байвал
  // OrderForm-д initial дамжуулна — vehicle-ийг ажилтан сонгоно.
  const prefillScheduled = sp.scheduledAt ? new Date(sp.scheduledAt) : null;
  const initial =
    sp.customerId || sp.branchId || sp.scheduledAt || sp.note
      ? {
          branchId: sp.branchId ?? "",
          customerId: sp.customerId ?? "",
          vehicleId: sp.vehicleId ?? "",
          assignedToId: null,
          scheduledAt:
            prefillScheduled && Number.isFinite(prefillScheduled.getTime())
              ? prefillScheduled
              : null,
          notes: sp.note ?? null,
        }
      : undefined;

  const [branches, customers, vehicles, technicians, diagnosticTemplates] =
    await Promise.all([
    prisma.branch.findMany({
      where: {
        tenantId: user.tenantId,
        isActive: true,
        ...(scopeBranchId ? { id: scopeBranchId } : {}),
      },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    }),
    prisma.customer.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, phone: true },
    }),
    prisma.tenantVehicle
      .findMany({
        where: { tenantId: user.tenantId, isActive: true },
        orderBy: { createdAt: "desc" },
        select: {
          customerId: true,
          isPostpaid: true,
          vehicle: {
            select: { id: true, plate: true, make: true, model: true },
          },
        },
      })
      .then((rows) =>
        rows.map((r) => ({
          ...r.vehicle,
          customerId: r.customerId,
          isPostpaid: r.isPostpaid,
        })),
      ),
    prisma.user.findMany({
      where: {
        tenantId: user.tenantId,
        isActive: true,
        ...ORDER_ASSIGNABLE_WHERE,
      },
      orderBy: { firstName: "asc" },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        branchId: true,
        assignableBranchIds: true,
        isOwner: true,
        role: { select: { name: true } },
      },
    }),
    prisma.diagnosticTemplate.findMany({
      where: { tenantId: user.tenantId, isActive: true },
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: { id: true, name: true, type: true },
    }),
  ]);

  if (branches.length === 0) {
    return (
      <div className="p-4 sm:p-6 max-w-full flex-1 flex flex-col min-h-0 w-full">
        <nav className="flex items-center gap-1.5 text-[13px] text-[var(--oc-muted3)] mb-3">
          <Link href="/dashboard/orders" className="hover:text-[var(--oc-accent-hi)] transition-colors">
            Захиалгууд
          </Link>
          <span>/</span>
          <span className="text-[var(--oc-muted)]">Шинэ захиалга</span>
        </nav>
        <h1 className="text-2xl font-semibold text-[var(--oc-ink)] mb-6">Шинэ захиалга</h1>
        <div className="rounded-[10px] border border-[var(--oc-accent)]/30 bg-[var(--oc-panel)] p-5 text-sm text-[var(--oc-ink2)]">
          Захиалга үүсгэхийн тулд эхлээд{" "}
          <Link
            href="/dashboard/branches/new"
            className="text-[var(--oc-accent)] hover:text-[var(--oc-accent-hi)] underline"
          >
            салбараа бүртгэнэ үү
          </Link>
          .
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-full flex-1 flex flex-col min-h-0 w-full">
      <nav className="flex items-center gap-1.5 text-[13px] text-[var(--oc-muted3)] mb-3">
        <Link href="/dashboard/orders" className="hover:text-[var(--oc-accent-hi)] transition-colors">
          Захиалгууд
        </Link>
        <span>/</span>
        <span className="text-[var(--oc-muted)]">Шинэ захиалга</span>
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--oc-ink)]">Шинэ захиалга</h1>
          <p className="text-sm text-[var(--oc-muted3)] mt-1">
            Үйлчилгээний захиалгын үндсэн мэдээллийг оруулна уу. Ажил, сэлбэгийн мөрийг дараа нь нэмнэ.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <BtnLink href="/dashboard/orders" variant="ghost">
            ← Буцах
          </BtnLink>
          <Btn type="submit" form={ORDER_FORM_ID}>
            Захиалга үүсгэх
          </Btn>
        </div>
      </div>

      <div className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] p-4 sm:p-5">
        <OrderForm
          initial={initial}
          appointmentId={sp.appointmentId}
          branches={branches}
          customers={customers}
          vehicles={vehicles}
          technicians={technicians}
          diagnosticTemplates={diagnosticTemplates.map((t) => ({
            id: t.id,
            name: t.name,
            type: t.type as DiagnosticType,
          }))}
        />
      </div>
    </div>
  );
}
