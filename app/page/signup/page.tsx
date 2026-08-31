import Link from "next/link";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { TenantAuthShellWide } from "@/app/_components/tenant-auth-shell";
import { getAddressData } from "@/lib/address";
import { setBypassContext } from "@/lib/tenant-context";
import { SignUpForm } from "./signup-form";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-sans",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
});

export const metadata = {
  title: "Бүртгүүлэх",
};

export default async function SignUpPage() {
  // Нэвтрээгүй, public хуудас — session/tenant байхгүй.
  setBypassContext();
  const addressData = await getAddressData();

  return (
    <div className={`${plexSans.variable} ${plexMono.variable}`}>
      <TenantAuthShellWide
        title="Байгууллагаа бүртгүүлэх"
        subtitle="2 минутын дотор carcare дээр салбараа үүсгээрэй."
        footer={
          <>
            Бүртгэлтэй юу?{" "}
            <Link
              href="/page/login"
              className="font-semibold text-[var(--oc-accent)] hover:text-[var(--oc-accent-hi)] transition-colors"
            >
              Нэвтрэх
            </Link>
          </>
        }
      >
        <SignUpForm
          addressData={addressData}
          mapApiKey={process.env.GOOGLE_MAP_API_KEY ?? ""}
          mapId={process.env.GOOGLE_MAP_ID ?? ""}
        />
      </TenantAuthShellWide>
    </div>
  );
}
