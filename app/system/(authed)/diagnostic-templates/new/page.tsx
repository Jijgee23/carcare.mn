import Link from "next/link";
import { Btn, BtnLink } from "@/app/_components/landing-ops-ui";
import { requireSuperAdmin } from "@/lib/auth/system";
import {
  createSystemTemplateAction,
  updateSystemTemplateAction,
} from "@/app/_actions/system-diagnostic-templates";
import {
  TEMPLATE_EDITOR_FORM_ID,
  TemplateEditor,
} from "@/app/dashboard/diagnostics/templates/template-editor";

export const metadata = {
  title: "Шинэ систем оношилгоо",
};

export default async function NewSystemDiagnosticTemplatePage() {
  await requireSuperAdmin();

  return (
    <div className="p-4 sm:p-6 max-w-full flex-1 flex flex-col min-h-0 w-full">
      <nav className="flex items-center gap-1.5 text-[13px] text-[var(--oc-muted3)] mb-3">
        <Link href="/system/diagnostic-templates" className="hover:text-[var(--oc-accent-hi)] transition-colors">
          Оношилгооны загвар
        </Link>
        <span>/</span>
        <span className="text-[var(--oc-muted)]">Шинэ загвар</span>
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--oc-ink)]">Шинэ систем оношилгоо</h1>
          <p className="text-sm text-[var(--oc-muted3)] mt-1">
            Энэ загварыг үүсгэсний дараа аль байгууллагад ашиглуулахаа
            дэлгэрэнгүй хуудаснаас тохируулна.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <BtnLink href="/system/diagnostic-templates" variant="ghost">
            ← Буцах
          </BtnLink>
          <Btn type="submit" form={TEMPLATE_EDITOR_FORM_ID}>
            Үүсгэх
          </Btn>
        </div>
      </div>

      <TemplateEditor
        showCategoryField={false}
        createAction={createSystemTemplateAction}
        updateAction={updateSystemTemplateAction}
      />
    </div>
  );
}
