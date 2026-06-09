import { PageHeader } from "@/app/_components/page-header";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LaborCategoriesSection } from "../labor-categories-section";
import { UnitsSection } from "../units-section";

export const metadata = {
  title: "Системийн тохиргоо",
};

export default async function SystemSettingsPage() {
  const user = await requireUser();

  const [units, laborCategories] = await Promise.all([
    prisma.unit.findMany({
      where: { tenantId: user.tenantId },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      select: { id: true, name: true, code: true, isActive: true },
    }),
    prisma.laborCategory.findMany({
      where: { tenantId: user.tenantId },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
        _count: { select: { services: true } },
      },
    }),
  ]);

  const laborCategoryRows = laborCategories.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    isActive: c.isActive,
    servicesCount: c._count.services,
  }));

  return (
    <div className="p-4 sm:p-6 max-w-full flex-1 flex flex-col min-h-0 w-full">
      <PageHeader
        title="Системийн тохиргоо"
        description="Үйлчилгээ, бараа бүртгэхэд ашиглах лавлах өгөгдөл."
      />

      <div className="grid gap-4">
        <section className="glass rounded-xl p-4 sm:p-5 border border-white/[0.08]">
          <h2 className="font-semibold text-sm mb-0.5">Ажлын ангилал</h2>
          <p className="text-xs text-white/40 mb-4">
            &quot;Ажил&quot; төрлийн үйлчилгээ үүсгэхэд заавал сонгох ангилал (жишээ:
            Хөдөлгүүр, Тоормос, Цахилгаан).
          </p>
          <LaborCategoriesSection categories={laborCategoryRows} />
        </section>

        <section className="glass rounded-xl p-4 sm:p-5 border border-white/[0.08]">
          <h2 className="font-semibold text-sm mb-0.5">Хэмжих нэгжүүд</h2>
          <p className="text-xs text-white/40 mb-4">
            Үйлчилгээ, бараа, сэлбэг бүртгэхэд ашиглах нэгжүүд (ширхэг, цаг,
            литр, кг, м г.м.).
          </p>
          <UnitsSection units={units} />
        </section>
      </div>
    </div>
  );
}
