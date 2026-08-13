import { redirect } from "next/navigation";
import { PageHeader } from "@/app/_components/page-header";
import { requireUser } from "@/lib/auth";
import { canCreate } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import { TemplateEditor } from "../../../diagnostics/templates/template-editor";

export const metadata = {
  title: "Шинэ оношилгоо",
};

export default async function NewDiagnosticTemplatePage() {
  const user = await requireUser();
  if (!canCreate(user, "diagnostics")) redirect("/dashboard/services/diagnostics");

  const categories = await prisma.category.findMany({
    where: { tenantId: user.tenantId },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: { id: true, name: true, isActive: true },
  });

  return (
    <div className="p-4 sm:p-6 max-w-full flex-1 flex flex-col min-h-0 w-full">
      <PageHeader
        title="Шинэ оношилгоо"
        description="Үнэ, хугацаа, асуултуудаа тохируулж оношилгооны үйлчилгээгээ үүсгэнэ үү"
      />
      <TemplateEditor categories={categories} />
    </div>
  );
}
