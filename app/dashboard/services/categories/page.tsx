import { redirect } from "next/navigation";
import { PageHeader } from "@/app/_components/page-header";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CategoriesSection } from "../categories-section";

export const metadata = {
  title: "Ангилал",
};

export default async function CategoriesPage() {
  const user = await requireUser();
  // Ангиллыг зөвхөн админ удирдана (actions нь isOwner шаарддаг).
  if (!user.isOwner) redirect("/dashboard/services");

  const [categories, branches] = await Promise.all([
    prisma.category.findMany({
      where: { tenantId: user.tenantId },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
        _count: { select: { services: true } },
        branches: { select: { id: true } },
      },
    }),
    prisma.branch.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const rows = categories.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    isActive: c.isActive,
    servicesCount: c._count.services,
    branchIds: c.branches.map((b) => b.id),
  }));

  return (
    <div className="p-4 sm:p-6 max-w-full flex-1 flex flex-col min-h-0 w-full">
      <PageHeader
        title="Ангилал"
        description="Үйлчилгээ (Ажил, Оношилгоо, Сэлбэг)-г ангилах нэгдсэн ангилал. Салбар оноовол тухайн салбарт, хоосон бол бүх салбарт санал болгоно."
      />

      <div className="glass rounded-xl p-4 sm:p-5 border border-white/[0.08]">
        <CategoriesSection categories={rows} branches={branches} />
      </div>
    </div>
  );
}
