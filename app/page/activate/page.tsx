import Link from "next/link";
import { AuthShell } from "@/app/_components/auth-shell";
import { ActivateAccountForm } from "./activate-form";

export const metadata = {
  title: "Анх удаа нэвтрэх",
};

export default function ActivatePage() {
  return (
    <AuthShell
      title="Анх удаа нэвтрэх"
      subtitle="Танд бүртгэл үүсгэсэн бол имэйлээ оруулна уу. Бид утсан дээр чинь 6 оронтой код илгээж, та өөрийн нууц үгээ үүсгэнэ."
      footer={
        <>
          Нууц үгтэй болсон уу?{" "}
          <Link
            href="/page/login"
            className="font-medium text-violet-300 hover:text-violet-200"
          >
            Нэвтрэх
          </Link>
        </>
      }
    >
      <ActivateAccountForm />
    </AuthShell>
  );
}
