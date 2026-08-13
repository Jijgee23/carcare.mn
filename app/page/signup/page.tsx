import Link from "next/link";
import { AuthShell } from "@/app/_components/auth-shell";
import { getAddressData } from "@/lib/address";
import { setBypassContext } from "@/lib/tenant-context";
import { SignUpForm } from "./signup-form";

export const metadata = {
  title: "Бүртгүүлэх",
};

export default async function SignUpPage() {
  // Нэвтрээгүй, public хуудас — session/tenant байхгүй.
  setBypassContext();
  const addressData = await getAddressData();

  return (
    <AuthShell
      title="Байгууллагаа бүртгүүлэх"
      subtitle="2 минутын дотор carcare дээр салбараа үүсгээрэй."
      wide
      footer={
        <>
          Бүртгэлтэй юу?{" "}
          <Link
            href="/page/login"
            className="font-medium text-brand-700 underline-offset-4 hover:underline"
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
    </AuthShell>
  );
}
