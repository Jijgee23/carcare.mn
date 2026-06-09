import { PageHeader } from "@/app/_components/page-header";
import { getPlatformSettings } from "@/lib/platform-settings";
import { SettingsForm } from "./settings-form";

export const metadata = {
  title: "Тохиргоо",
};

export const dynamic = "force-dynamic";

export default async function SystemSettingsPage() {
  const settings = await getPlatformSettings();

  return (
    <div className="p-4 sm:p-6 max-w-full flex-1 flex flex-col min-h-0 w-full">
      <PageHeader
        title="Тохиргоо"
        description="Платформын сошиал холбоос. Тохируулсан үед landing footer-т харагдана."
      />
      <div className="glass rounded-xl p-4 sm:p-5 border border-white/[0.08] max-w-xl">
        <SettingsForm initial={settings} />
      </div>
    </div>
  );
}
