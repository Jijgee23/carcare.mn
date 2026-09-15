import Link from "next/link";
import { redirect } from "next/navigation";
import { Btn, BtnLink } from "@/app/_components/landing-ops-ui";
import { DEFAULT_SLOT_CAPACITY } from "@/lib/appointment-slots";
import { requireUser } from "@/lib/auth";
import { canCreate, workingBranchScopeId } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import {
  SERVICE_KIND_BY_SLUG,
  SERVICE_KIND_LABEL,
  SERVICE_KIND_SLUG,
  type ServiceKind,
} from "@/lib/services";
import { ServiceForm, SERVICE_FORM_ID } from "../service-form";

export const metadata = { title: "Шинэ үйлчилгээ" };

export default async function NewServicePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const user = await requireUser();
  if (!canCreate(user, "services")) redirect("/dashboard/services");

  const { type: typeSlug } = await searchParams;
  const fixedType: ServiceKind | undefined =
    typeSlug && typeSlug in SERVICE_KIND_BY_SLUG
      ? SERVICE_KIND_BY_SLUG[typeSlug]
      : undefined;

  const [categories, units] = await Promise.all([
    prisma.category.findMany({
      where: { tenantId: user.tenantId },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      select: { id: true, name: true, isActive: true },
    }),
    prisma.unit.findMany({
      where: { tenantId: user.tenantId },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      select: { id: true, name: true, code: true, isActive: true },
    }),
  ]);

  // "Багтаамж"-ийн санал болгох анхны утга: ажилтны одоогийн ажиллах салбар
  // (тодорхойгүй бол tenant-ийн үндсэн салбар)-ын slotCapacity тохиргоо.
  const scopeBranchId = workingBranchScopeId(user);
  const branchForDefault = await prisma.branch.findFirst({
    where: scopeBranchId
      ? { id: scopeBranchId, tenantId: user.tenantId }
      : { tenantId: user.tenantId, isActive: true },
    orderBy: scopeBranchId ? undefined : [{ isPrimary: "desc" }, { name: "asc" }],
    select: { slotCapacity: true },
  });
  const defaultConcurrentCapacity =
    branchForDefault?.slotCapacity ?? DEFAULT_SLOT_CAPACITY;

  const backHref = fixedType
    ? `/dashboard/services/${SERVICE_KIND_SLUG[fixedType]}`
    : "/dashboard/services";

  return (
    <div className="p-4 sm:p-6 max-w-4xl">
      <nav className="flex items-center gap-1.5 text-[13px] text-[var(--oc-muted3)] mb-3">
        <Link href={backHref} className="hover:text-[var(--oc-accent-hi)] transition-colors">
          {fixedType ? SERVICE_KIND_LABEL[fixedType] : "Үйлчилгээ"}
        </Link>
        <span>/</span>
        <span className="text-[var(--oc-muted)]">Шинэ</span>
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--oc-ink)]">
            {fixedType ? `Шинэ — ${SERVICE_KIND_LABEL[fixedType]}` : "Шинэ үйлчилгээ"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <BtnLink href={backHref} variant="ghost">
            ← Буцах
          </BtnLink>
          <Btn type="submit" form={SERVICE_FORM_ID}>
            Үүсгэх
          </Btn>
        </div>
      </div>

      <div className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] p-4 sm:p-5">
        <ServiceForm
          fixedType={fixedType}
          categories={categories}
          units={units}
          defaultConcurrentCapacity={defaultConcurrentCapacity}
        />
      </div>
    </div>
  );
}
