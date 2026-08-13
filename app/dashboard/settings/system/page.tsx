import { PageHeader } from "@/app/_components/page-header";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UnitsSection } from "../units-section";

export const metadata = {
  title: "Системийн тохиргоо",
};

export default async function SystemSettingsPage() {
  const user = await requireUser();

  const units = await prisma.unit.findMany({
    where: { tenantId: user.tenantId },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: { id: true, name: true, code: true, isActive: true },
  });

  return (
    <div className="p-4 sm:p-6 max-w-full flex-1 flex flex-col min-h-0 w-full">
      <PageHeader
        title="Системийн тохиргоо"
        description="Үйлчилгээ, бараа бүртгэхэд ашиглах лавлах өгөгдөл."
      />

      <div className="grid gap-4">
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
