import { PageHeader } from "@/app/_components/page-header";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TenantQPayForm } from "./qpay-form";

export const metadata = {
  title: "QPay тохиргоо",
};

export default async function TenantQPayPage() {
  const user = await requireUser();
  const settings = await prisma.tenantQPaySettings.findUnique({
    where: { tenantId: user.tenantId },
  });

  return (
    <div className="p-6 sm:p-8 max-full flex-1 flex flex-col min-h-0 w-full">
      <PageHeader
        title="QPay тохиргоо"
        description="Захиалгын төлбөрийг QPay-ээр авах merchant credentials."
      />

      <div className="glass rounded-xl p-4 sm:p-5 border border-white/[0.08] max-w-3xl">
        <TenantQPayForm
          initial={
            settings
              ? {
                  username: settings.username,
                  invoiceCode: settings.invoiceCode,
                  callbackUrl: settings.callbackUrl,
                  enabled: settings.enabled,
                  hasPassword: Boolean(settings.password),
                }
              : null
          }
        />
      </div>
    </div>
  );
}
