import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmForm } from "@/app/_components/confirm-form";
import { Btn, BtnLink } from "@/app/_components/landing-ops-ui";
import { requireSuperAdmin } from "@/lib/auth/system";
import {
  deleteSystemTemplateAction,
  updateSystemTemplateAction,
  createSystemTemplateAction,
} from "@/app/_actions/system-diagnostic-templates";
import {
  type DiagnosticType,
  type TemplateSchema,
  emptySchema,
} from "@/lib/diagnostics";
import { prisma } from "@/lib/prisma";
import {
  TEMPLATE_EDITOR_FORM_ID,
  TemplateEditor,
} from "@/app/dashboard/diagnostics/templates/template-editor";
import { ReportAnswers } from "@/app/dashboard/diagnostics/reports/[id]/report-answers";
import { GrantTenantsForm } from "../grant-tenants-form";
import { PrintButton } from "./print-button";

export const metadata = {
  title: "Систем оношилгоо засах",
};

export default async function EditSystemDiagnosticTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSuperAdmin();
  const { id } = await params;

  const [template, tenants] = await Promise.all([
    prisma.diagnosticTemplate.findFirst({
      where: { id, tenantId: null },
      include: {
        _count: { select: { reports: true } },
        grants: { select: { tenantId: true } },
      },
    }),
    prisma.tenant.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
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
    <div id="print-root" className="p-4 sm:p-6 max-w-full flex-1 flex flex-col min-h-0 w-full">
      <nav className="no-print flex items-center gap-1.5 text-[13px] text-[var(--oc-muted3)] mb-3">
        <Link href="/system/diagnostic-templates" className="hover:text-[var(--oc-accent-hi)] transition-colors">
          Оношилгооны загвар
        </Link>
        <span>/</span>
        <span className="text-[var(--oc-muted)]">{template.name}</span>
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--oc-ink)]">Систем оношилгоо засах</h1>
          <p className="text-sm text-[var(--oc-muted3)] mt-1">
            v{template.version} · {template.name}
          </p>
        </div>
        <div className="no-print flex items-center gap-2">
          <BtnLink href="/system/diagnostic-templates" variant="ghost">
            ← Буцах
          </BtnLink>
          <PrintButton />
          <Btn type="submit" form={TEMPLATE_EDITOR_FORM_ID}>
            Хадгалах
          </Btn>
        </div>
      </div>

      {/* Хэвлэх урьдчилан харах — зөвхөн хэвлэхэд харагдана, дэлгэц дээр
          доорх засварын форм харагдана (харах: .print-only, globals.css).
          Тенант дээр бөглөгдсөн тайлан харахтай яг адил бүрэлдэхүүн
          (ReportAnswers) ашиглана, зөвхөн хариулт хоосон (бланк хуудас). */}
      <div className="print-only">
        <h2 className="text-lg font-semibold mb-4">{template.name}</h2>
        <ReportAnswers schema={schema} data={{}} />
      </div>

      <div className="no-print grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TemplateEditor
            showCategoryField={false}
            createAction={createSystemTemplateAction}
            updateAction={updateSystemTemplateAction}
            initial={{
              id: template.id,
              name: template.name,
              description: template.description,
              type: template.type as DiagnosticType,
              isActive: template.isActive,
              schema,
              price: template.price?.toString() ?? null,
              durationMin: template.durationMin,
              categoryId: null,
            }}
          />
        </div>

        <div className="flex flex-col gap-6">
          <div className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] p-5 sm:p-6">
            <h2 className="font-semibold text-[var(--oc-ink)] mb-1">Байгууллагууд</h2>
            <p className="text-xs text-[var(--oc-muted3)] mb-4">
              Энэ загварыг ашиглах боломжтой байгууллагуудыг сонгоно.
            </p>
            <GrantTenantsForm
              templateId={template.id}
              tenants={tenants}
              grantedTenantIds={template.grants.map((g) => g.tenantId)}
            />
          </div>

          <div className="rounded-[10px] border border-red-500/25 bg-[var(--oc-panel)] p-5 sm:p-6">
            <h2 className="font-semibold text-red-400 light:text-red-600 mb-2 text-sm">
              Аюултай бүс
            </h2>
            <p className="text-xs text-[var(--oc-muted3)] mb-4">
              {template._count.reports > 0
                ? "Бөглөгдсөн тайлантай тул архивлагдана (устгагдахгүй)."
                : "Ашиглаагүй тул бүрмөсөн устгагдана."}
            </p>
            <ConfirmForm
              action={deleteSystemTemplateAction}
              message={
                template._count.reports > 0
                  ? `"${template.name}" загварыг архивлах уу?`
                  : `"${template.name}" загварыг устгах уу?`
              }
            >
              <input type="hidden" name="id" value={template.id} />
              <button
                type="submit"
                className="text-sm text-red-400 hover:text-red-300 light:text-red-600 light:hover:text-red-700 transition-colors px-3 py-2 rounded-lg hover:bg-red-500/10 border border-red-500/25"
              >
                {template._count.reports > 0 ? "Архивлах" : "Устгах"}
              </button>
            </ConfirmForm>
          </div>
        </div>
      </div>
    </div>
  );
}
