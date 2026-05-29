import Link from "next/link";
import { AuthShell } from "@/app/_components/auth-shell";
import { SignUpForm } from "./signup-form";

export const metadata = {
  title: "Бүртгүүлэх",
};

export default function SignUpPage() {
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
      <SignUpForm />
    </AuthShell>
  );
}
