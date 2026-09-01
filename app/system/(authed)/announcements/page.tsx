import { PageHeader } from "@/app/_components/page-header";
import { requireSuperAdmin } from "@/lib/auth/system";
import { AnnouncementForm } from "./announcement-form";

export const metadata = {
  title: "Мэдэгдэл илгээх",
};

export default async function AnnouncementsPage() {
  await requireSuperAdmin();

  return (
    <div className="p-4 sm:p-6 max-w-full flex-1 flex flex-col min-h-0 w-full">
      <PageHeader
        title="Мэдэгдэл илгээх"
        description="Платформын бүх ажилтан болон/эсвэл хэрэглэгчид push + апп доторх мэдэгдэл илгээх."
      />
      <div className="glass rounded-xl p-4 sm:p-5 border border-white/[0.08] max-w-xl">
        <AnnouncementForm />
      </div>
    </div>
  );
}
