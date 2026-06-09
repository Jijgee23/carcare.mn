import { redirect } from "next/navigation";
import { PageHeader } from "@/app/_components/page-header";
import { requireUser } from "@/lib/auth";
import { canCreate } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import {
  SERVICE_KIND_BY_SLUG,
  SERVICE_KIND_LABEL,
  type ServiceKind,
} from "@/lib/services";
import { ServiceForm } from "../service-form";

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

  const [laborCategories, units] = await Promise.all([
    prisma.laborCategory.findMany({
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

  return (
    <div className="p-4 sm:p-6 max-w-full flex-1 flex flex-col min-h-0 w-full">
      <PageHeader
        title={
          fixedType ? `Шинэ — ${SERVICE_KIND_LABEL[fixedType]}` : "Шинэ үйлчилгээ"
        }
      />
      <div className="glass rounded-xl p-4 sm:p-5 border border-white/[0.08]">
        <ServiceForm
          fixedType={fixedType}
          laborCategories={laborCategories}
          units={units}
        />
      </div>
    </div>
  );
}
