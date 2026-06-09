import { PageHeader } from "@/app/_components/page-header";
import { requireUser } from "@/lib/auth";
import { branchScopeId } from "@/lib/auth/roles";
import {
  type DiagnosticType,
  type TemplateSchema,
  emptySchema,
} from "@/lib/diagnostics";
import { prisma } from "@/lib/prisma";
import { StandaloneDiagnosticForm } from "./standalone-form";

export const metadata = {
  title: "Шинэ оношилгоо",
};

export default async function NewDiagnosticPage() {
  const user = await requireUser();
  const scopeBranchId = branchScopeId(user);

  const [branches, customers, vehicles, templates] = await Promise.all([
    prisma.branch.findMany({
      where: {
        tenantId: user.tenantId,
        ...(scopeBranchId ? { id: scopeBranchId } : {}),
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.customer.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, phone: true },
    }),
    prisma.vehicle.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { plate: "asc" },
      select: {
        id: true,
        plate: true,
        make: true,
        model: true,
        customerId: true,
      },
    }),
    prisma.diagnosticTemplate.findMany({
      where: { tenantId: user.tenantId, isActive: true },
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: { id: true, name: true, type: true, schema: true },
    }),
  ]);

  const templatesPrepared = templates.map((t) => {
    let schema: TemplateSchema;
    try {
      schema = t.schema as unknown as TemplateSchema;
      if (!schema.sections) schema = emptySchema();
    } catch {
      schema = emptySchema();
    }
    return {
      id: t.id,
      name: t.name,
      type: t.type as DiagnosticType,
      schema,
    };
  });

  return (
    <div className="p-4 sm:p-6 max-w-full flex-1 flex flex-col min-h-0 w-full">
      <PageHeader
        title="Шинэ оношилгоо"
        description="Машин, үйлчлүүлэгч, загвараа сонгож оношилгоо бөглөнө үү"
      />
      <StandaloneDiagnosticForm
        branches={branches}
        customers={customers}
        vehicles={vehicles}
        templates={templatesPrepared}
        defaultBranchId={user.branchId}
      />
    </div>
  );
}
