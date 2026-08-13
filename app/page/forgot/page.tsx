import Link from "next/link";
import { AuthShell } from "@/app/_components/auth-shell";
import { ForgotPasswordForm } from "./forgot-form";

export const metadata = {
  title: "Нууц үг сэргээх",
};

export default function ForgotPage() {
  return (
    <AuthShell
      title="Нууц үгээ сэргээх"
      subtitle="Бүртгэлтэй имэйлээ оруулна уу. Бид утсан дээр чинь 6 оронтой код илгээх болно."
      footer={
        <>
          Нэвтрэх юм уу?{" "}
          <Link
            href="/page/login"
            className="font-medium text-violet-300 hover:text-violet-200 light:text-violet-700 light:hover:text-violet-800"
          >
            Буцах
          </Link>
        </>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
