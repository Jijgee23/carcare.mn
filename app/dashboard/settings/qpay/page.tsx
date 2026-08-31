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
    <div className="p-4 sm:p-6 max-w-full flex-1 flex flex-col min-h-0 w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[var(--oc-ink)]">QPay тохиргоо</h1>
        <p className="text-sm text-[var(--oc-muted3)] mt-1">
          Захиалгын төлбөрийг QPay-ээр авах merchant credentials.
        </p>
      </div>

      <div className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] p-5 sm:p-6 max-w-3xl">
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
