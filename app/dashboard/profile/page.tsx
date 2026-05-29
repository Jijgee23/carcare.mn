import { PageHeader } from "@/app/_components/page-header";
import { requireUser } from "@/lib/auth";
import { userRoleLabel } from "@/lib/auth/roles";
import { PasswordForm } from "./password-form";
import { ProfileForm } from "./profile-form";

export const metadata = {
  title: "Профайл",
};

export default async function ProfilePage() {
  const user = await requireUser();
  const initials =
    ((user.firstName[0] ?? "") + (user.lastName[0] ?? "")).toUpperCase();

  return (
    <div className="p-6 sm:p-8 max-full flex-1 flex flex-col min-h-0 w-full">
      <PageHeader
        title="Профайл"
        description="Өөрийн мэдээлэл, нууц үгээ удирдах"
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <aside className="lg:col-span-1">
          <div className="glass rounded-xl p-4 sm:p-5 text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center text-xl font-bold">
              {initials}
            </div>
            <h2 className="mt-3 font-semibold text-sm">
              {user.lastName} {user.firstName}
            </h2>
            <p className="text-xs text-white/40 mt-0.5">{user.email}</p>
            <span
              className={`mt-2 inline-block text-xs px-2.5 py-1 rounded-full ${
                user.isOwner
                  ? "bg-violet-500/15 text-violet-300 border border-violet-500/30"
                  : "bg-white/10 text-white/60 border border-white/15"
              }`}
            >
              {userRoleLabel(user)}
            </span>
            <dl className="mt-4 space-y-2 text-left text-sm">
              <Row label="Байгууллага" value={user.tenant.name} />
              <Row
                label="Бүртгүүлсэн"
                value={user.createdAt.toLocaleDateString("mn-MN")}
              />
            </dl>
          </div>
        </aside>

        <div className="lg:col-span-2 flex flex-col gap-4">
          <section className="glass rounded-xl p-4 sm:p-5 border border-white/[0.08]">
            <h2 className="font-semibold text-sm mb-0.5">Үндсэн мэдээлэл</h2>
            <p className="text-xs text-white/40 mb-4">
              Нэр, имэйл, утас.
            </p>
            <ProfileForm
              initial={{
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                phone: user.phone,
              }}
            />
          </section>

          <section className="glass rounded-xl p-4 sm:p-5 border border-white/[0.08]">
            <h2 className="font-semibold text-sm mb-0.5">Нууц үг солих</h2>
            <p className="text-xs text-white/40 mb-4">
              Аюулгүй байдлын үүднээс одоогийн нууц үгээ оруулна уу.
            </p>
            <PasswordForm />
          </section>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-white/40">{label}</dt>
      <dd className="text-white/80 truncate">{value}</dd>
    </div>
  );
}
