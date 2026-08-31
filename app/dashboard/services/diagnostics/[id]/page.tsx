import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Btn, BtnLink } from "@/app/_components/landing-ops-ui";
import { requireUser } from "@/lib/auth";
import { canEdit } from "@/lib/auth/roles";
import {
  type DiagnosticType,
  type TemplateSchema,
  emptySchema,
} from "@/lib/diagnostics";
import { prisma } from "@/lib/prisma";
import {
  TEMPLATE_EDITOR_FORM_ID,
  TemplateEditor,
} from "../../../diagnostics/templates/template-editor";

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
  const [template, categories] = await Promise.all([
    prisma.diagnosticTemplate.findFirst({
      where: { id, tenantId: user.tenantId },
    }),
    prisma.category.findMany({
      where: { tenantId: user.tenantId },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      select: { id: true, name: true, isActive: true },
    }),
  ]);
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
      <nav className="flex items-center gap-1.5 text-[13px] text-[var(--oc-muted3)] mb-3">
        <Link href="/dashboard/services/diagnostics" className="hover:text-[var(--oc-accent-hi)] transition-colors">
          Оношилгоо
        </Link>
        <span>/</span>
        <span className="text-[var(--oc-muted)]">{template.name}</span>
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--oc-ink)]">Оношилгоо засах</h1>
          <p className="text-sm text-[var(--oc-muted3)] mt-1">
            v{template.version} · {template.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <BtnLink href="/dashboard/services/diagnostics" variant="ghost">
            ← Буцах
          </BtnLink>
          <Btn type="submit" form={TEMPLATE_EDITOR_FORM_ID}>
            Хадгалах
          </Btn>
        </div>
      </div>

      <TemplateEditor
        categories={categories}
        initial={{
          id: template.id,
          name: template.name,
          description: template.description,
          type: template.type as DiagnosticType,
          isActive: template.isActive,
          schema,
          price: template.price?.toString() ?? null,
          durationMin: template.durationMin,
          categoryId: template.categoryId,
        }}
      />
    </div>
  );
}
