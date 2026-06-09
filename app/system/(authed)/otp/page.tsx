import Link from "next/link";
import { PageHeader } from "@/app/_components/page-header";
import { requireSuperAdmin } from "@/lib/auth/system";
import { getDevOtps, type OtpType } from "@/lib/auth/otp";

export const metadata = {
  title: "OTP кодууд (dev)",
};

// Шинэ код бүрт хуудас сэргээгдэх ёстой тул кэшлэхгүй.
export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<OtpType, string> = {
  SIGNUP: "Бүртгэл",
  CHANGE_PASSWORD: "Нууц үг солих",
  RESET_PASSWORD: "Нууц үг сэргээх",
  CONSUMER_LOGIN: "Нэвтрэх (Account)",
};

export default async function SystemOtpPage() {
  await requireSuperAdmin();

  const isProd = process.env.NODE_ENV === "production";
  const otps = getDevOtps();
  const now = Date.now();

  return (
    <div className="p-6 sm:p-8 max-w-4xl">
      <PageHeader
        title="OTP кодууд"
        description="Хөгжүүлэлтэд SMS-гүйгээр нэвтрэхэд зориулсан. Зөвхөн санах ойд хадгалагдана (DB-д биш), сервер дахин ачаалахад арилна."
        actions={
          <Link
            href="/system/otp"
            className="text-sm bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] transition-colors px-4 py-2 rounded-lg font-medium"
          >
            ↻ Сэргээх
          </Link>
        }
      />

      {isProd ? (
        <div className="glass rounded-2xl p-8 border border-amber-500/20 text-center">
          <p className="text-amber-300 font-medium">
            Энэ хуудас зөвхөн хөгжүүлэлтэд (development) ажиллана.
          </p>
          <p className="text-sm text-white/40 mt-1">
            Production-д OTP кодуудыг хэзээ ч хадгалж / харуулдаггүй.
          </p>
        </div>
      ) : otps.length === 0 ? (
        <div className="glass rounded-2xl p-8 border border-white/[0.08] text-center text-sm text-white/40">
          OTP код алга. Бүртгэл / нууц үг сэргээх үйлдэл хийгээд энэ хуудсыг
          сэргээнэ үү.
        </div>
      ) : (
        <div className="glass rounded-2xl overflow-hidden border border-white/[0.08]">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {["Код", "Төрөл", "Имэйл / Утас", "Үүссэн", "Төлөв"].map((h) => (
                  <th
                    key={h}
                    className="text-left text-xs text-white/30 font-medium px-5 py-3"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {otps.map((o, i) => {
                const expired = o.expiresAt.getTime() <= now;
                return (
                  <tr
                    key={`${o.code}-${i}`}
                    className="border-b border-white/[0.04] last:border-0"
                  >
                    <td className="px-5 py-4">
                      <span
                        className={`font-mono text-lg font-bold tracking-widest tabular-nums ${
                          expired ? "text-white/30 line-through" : "text-emerald-300"
                        }`}
                      >
                        {o.code}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-white/70">
                      {TYPE_LABEL[o.type]}
                    </td>
                    <td className="px-5 py-4 text-sm text-white/70">
                      {o.email ?? o.phone}
                    </td>
                    <td className="px-5 py-4 text-xs text-white/40">
                      {o.createdAt.toLocaleTimeString("mn-MN")}
                    </td>
                    <td className="px-5 py-4">
                      {expired ? (
                        <span className="text-xs px-2.5 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                          Хугацаа дууссан
                        </span>
                      ) : (
                        <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                          Хүчинтэй
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
