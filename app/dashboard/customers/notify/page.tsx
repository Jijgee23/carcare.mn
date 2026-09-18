import { redirect } from "next/navigation";
import { BtnLink } from "@/app/_components/landing-ops-ui";
import { PageHeader } from "@/app/_components/page-header";
import { requireUser } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import { CustomerNotifyForm } from "../notify-form";

export const metadata = {
  title: "Үйлчлүүлэгчид зар илгээх",
};

export default async function CustomerNotifyPage() {
  const user = await requireUser();
  if (!hasPermission(user, "customers.notify")) redirect("/dashboard/customers");

  const notifiableCount = await prisma.customer.count({
    where: { tenantId: user.tenantId, accountId: { not: null } },
  });

  return (
    <div className="p-4 sm:p-6 max-w-full flex-1 flex flex-col min-h-0 w-full">
      <PageHeader
        title="Үйлчлүүлэгчид зар илгээх"
        description="Хямдрал, урамшуулал гэх мэт мэдэгдлийг онлайн бүртгэлтэй бүх үйлчлүүлэгчиддээ push-аар илгээнэ."
        actions={
          <BtnLink href="/dashboard/customers" variant="ghost">
            ← Үйлчлүүлэгчид
          </BtnLink>
        }
      />

      <div className="max-w-lg rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] p-4 sm:p-5">
        <p className="text-sm text-[var(--oc-muted3)] mb-4">
          Одоогоор <strong className="text-[var(--oc-ink2)] font-plex-mono">{notifiableCount.toLocaleString("mn-MN")}</strong> үйлчлүүлэгч
          онлайн бүртгэлтэй (апп/веб холбогдсон) тул мэдэгдэл хүлээн авах боломжтой.
          Утсаар л бүртгэлтэй (Account холбогдоогүй) үйлчлүүлэгчид хүрэхгүй.
        </p>
        <CustomerNotifyForm />
      </div>
    </div>
  );
}
