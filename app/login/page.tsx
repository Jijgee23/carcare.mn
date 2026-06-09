import { redirect } from "next/navigation";
import { AuthShell } from "@/app/_components/auth-shell";
import { getAccount } from "@/lib/auth/account";
import { AccountLoginForm } from "./login-form";

export const metadata = {
  title: "Нэвтрэх",
};

export default async function AccountLoginPage() {
  // Нэвтэрсэн бол шууд миний цаг руу.
  const account = await getAccount();
  if (account) redirect("/account");

  return (
    <AuthShell
      title="Нэвтрэх / Бүртгүүлэх"
      subtitle="Утасны дугаараа оруулаад, ирэх 6 оронтой кодоор нэвтэрнэ."
    >
      <AccountLoginForm />
    </AuthShell>
  );
}
