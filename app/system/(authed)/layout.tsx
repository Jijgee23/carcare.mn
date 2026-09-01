import {
  SystemMobileTopbar,
  SystemSidebar,
} from "@/app/_components/system-sidebar";
import { ToastProvider } from "@/app/_components/toast";
import { WebPushToggle } from "@/app/_components/web-push";
import { requireSuperAdmin } from "@/lib/auth/system";

export default async function SystemAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireSuperAdmin();
  const initials =
    ((admin.firstName[0] ?? "") + (admin.lastName[0] ?? "")).toUpperCase();
  const adminName = `${admin.lastName} ${admin.firstName}`.trim();

  return (
    <ToastProvider>
      <div className="min-h-screen bg-[var(--shell-bg-primary)] flex">
        <SystemSidebar
          adminName={adminName}
          adminEmail={admin.email}
          initials={initials}
        />
        <div className="app-content-offset flex-1 min-w-0 min-h-screen flex flex-col relative isolate">
          <div aria-hidden className="shell-content-bg" />
          <SystemMobileTopbar adminName={adminName} initials={initials} />
          <div className="px-6 sm:px-8 pt-6">
            <section className="glass rounded-2xl p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium text-white/90">Push мэдэгдэл</div>
                <div className="text-xs text-white/40">
                  Шинэ байгууллага бүртгүүлэх зэрэг мэдэгдлийг энэ төхөөрөмж дээр авах.
                </div>
              </div>
              <WebPushToggle target="system-admin" />
            </section>
          </div>
          <main className="flex-1 min-w-0">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
