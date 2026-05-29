import { PageHeader } from "@/app/_components/page-header";
import { requireSuperAdmin } from "@/lib/auth/system";
import { prisma } from "@/lib/prisma";
import { QPaySettingsForm } from "./qpay-form";

export const metadata = {
  title: "QPay тохиргоо",
};

export default async function SystemQPayPage() {
  await requireSuperAdmin();
  const settings = await prisma.qPaySettings.findUnique({ where: { id: 1 } });

  return (
    <div className="p-6 sm:p-8 max-w-3xl">
      <PageHeader
        title="QPay merchant тохиргоо"
        description="Платформын нэгдсэн QPay merchant дансны мэдээлэл. Бүх тенант энэ дансаар төлбөр төлнө."
      />
      <div className="glass rounded-2xl p-6 sm:p-8 border border-white/[0.08]">
        <QPaySettingsForm
          initial={{
            username: settings?.username ?? "",
            password: settings?.password ?? "",
            invoiceCode: settings?.invoiceCode ?? "",
            callbackUrl: settings?.callbackUrl ?? "",
            tokenExpiresAt: settings?.tokenExpiresAt?.toISOString() ?? null,
          }}
        />
      </div>
    </div>
  );
}
