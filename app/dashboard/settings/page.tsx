import { redirect } from "next/navigation";
import { PageHeader } from "@/app/_components/page-header";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LogoForm } from "./logo-form";
import { TenantForm } from "./tenant-form";

export const metadata = {
  title: "Байгууллагын тохиргоо",
};

export default async function SettingsPage() {
  const user = await requireUser();

  const tenant = await prisma.tenant.findUnique({
    where: { id: user.tenantId },
  });
  if (!tenant) redirect("/dashboard");

  return (
    <div className="p-4 sm:p-6 max-w-full flex-1 flex flex-col min-h-0 w-full">
      <PageHeader
        title="Байгууллагын тохиргоо"
        description="Лого, нэр, регистр зэрэг тенант-ын мэдээлэл."
      />

      <div className="grid gap-4">
        <section className="glass rounded-xl p-4 sm:p-5 border border-white/[0.08]">
          <h2 className="font-semibold text-sm mb-0.5">Лого</h2>
          <p className="text-xs text-white/40 mb-4">
            Платформ дотор болон нэхэмжлэхэд харагдана.
          </p>
          <LogoForm currentLogoUrl={tenant.logoUrl} />
        </section>

        <section className="glass rounded-xl p-4 sm:p-5 border border-white/[0.08]">
          <h2 className="font-semibold text-sm mb-0.5">Үндсэн мэдээлэл</h2>
          <p className="text-xs text-white/40 mb-4">
            Нэр, регистр, харилцагч мэдээлэл.
          </p>
          <TenantForm
            initial={{
              name: tenant.name,
              registerNumber: tenant.registerNumber,
              email: tenant.email,
              phone1: tenant.phone1,
              phone2: tenant.phone2,
              acceptsOnlineBooking: tenant.acceptsOnlineBooking,
            }}
          />
        </section>

        <section className="glass rounded-xl p-4 sm:p-5 border border-white/[0.08]">
          <h2 className="font-semibold text-sm mb-3">Бусад</h2>
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <Row label="Slug">
              <span className="font-mono text-white/80">{tenant.slug}</span>
            </Row>
            <Row label="Багц">
              <span className="text-white/80">{tenant.plan}</span>
            </Row>
            <Row label="Бүртгүүлсэн">
              <span className="text-white/80">
                {tenant.createdAt.toLocaleDateString("mn-MN")}
              </span>
            </Row>
          </dl>
        </section>
      </div>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs text-white/40">{label}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}
