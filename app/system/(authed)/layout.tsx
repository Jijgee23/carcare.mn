import {
  SystemMobileTopbar,
  SystemSidebar,
} from "@/app/_components/system-sidebar";
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
    <div className="min-h-screen bg-[var(--shell-bg-primary)] flex">
      <SystemSidebar
        adminName={adminName}
        adminEmail={admin.email}
        initials={initials}
      />
      <div className="app-content-offset flex-1 min-w-0 min-h-screen flex flex-col relative isolate">
        <div aria-hidden className="shell-content-bg" />
        <SystemMobileTopbar adminName={adminName} initials={initials} />
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
