import Link from "next/link";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { TenantAuthShell } from "@/app/_components/tenant-auth-shell";
import { ForgotPasswordForm } from "./forgot-form";

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
  title: "Нууц үг сэргээх",
};

export default function ForgotPage() {
  return (
    <div className={`${plexSans.variable} ${plexMono.variable}`}>
      <TenantAuthShell
        title="Нууц үгээ сэргээх"
        subtitle="Бүртгэлтэй имэйлээ оруулна уу. Бид утсан дээр чинь 6 оронтой код илгээх болно."
        notice={
          <>
            Нэвтрэх юм уу?{" "}
            <Link
              href="/page/login"
              className="font-semibold text-[var(--oc-accent)] hover:text-[var(--oc-accent-hi)] transition-colors"
            >
              Буцах
            </Link>
          </>
        }
      >
        <ForgotPasswordForm />
      </TenantAuthShell>
    </div>
  );
}
