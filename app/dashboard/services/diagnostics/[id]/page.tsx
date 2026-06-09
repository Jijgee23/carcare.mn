import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/app/_components/page-header";
import { requireUser } from "@/lib/auth";
import { canEdit } from "@/lib/auth/roles";
import {
  type DiagnosticType,
  type TemplateSchema,
  emptySchema,
} from "@/lib/diagnostics";
import { prisma } from "@/lib/prisma";
import { TemplateEditor } from "../../../diagnostics/templates/template-editor";

export const metadata = {
  title: "Оношилгоо засах",
};

export default async function EditDiagnosticTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  if (!canEdit(user, "diagnostics")) redirect("/dashboard/services/diagnostics");

  const { id } = await params;
  const template = await prisma.diagnosticTemplate.findFirst({
    where: { id, tenantId: user.tenantId },
  });
  if (!template) notFound();

  let schema: TemplateSchema;
  try {
    schema = template.schema as unknown as TemplateSchema;
    if (!schema.sections) schema = emptySchema();
  } catch {
    schema = emptySchema();
  }

  return (
    <div className="p-4 sm:p-6 max-w-full flex-1 flex flex-col min-h-0 w-full">
      <PageHeader
        title="Оношилгоо засах"
        description={`v${template.version} · ${template.name}`}
      />
      <TemplateEditor
        initial={{
          id: template.id,
          name: template.name,
          description: template.description,
          type: template.type as DiagnosticType,
          isActive: template.isActive,
          schema,
          price: template.price?.toString() ?? null,
          durationMin: template.durationMin,
        }}
      />
    </div>
  );
}
