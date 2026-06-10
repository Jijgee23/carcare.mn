import Link from "next/link";
import { AuthShell } from "@/app/_components/auth-shell";
import { LoginForm } from "./login-form";

export const metadata = {
  title: "Нэвтрэх",
};

export default function LoginPage() {
  return (
    <AuthShell
      title="Нэвтрэх"
      subtitle="Бүртгэлтэй имэйлээ оруулна уу."
      footer={
        <>
          Шинэ байгууллага уу?{" "}
          <Link
            href="/page/signup"
            className="font-medium text-brand-700 underline-offset-4 hover:underline"
          >
            Бүртгүүлэх
          </Link>
        </>
      }
    >
      <LoginForm />
    </AuthShell>
  );
}
