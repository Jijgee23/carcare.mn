import { redirect } from "next/navigation";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { TenantAuthShellWide } from "@/app/_components/tenant-auth-shell";
import { requireUser } from "@/lib/auth";
import { canChooseAllBranches } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import { ChooseBranchForm } from "./choose-branch-form";

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
  title: "Ажиллах салбар сонгох",
};

export const dynamic = "force-dynamic";

// Нэвтэрсний дараа (owner эсвэл тогтмол салбаргүй ажилтан) ажиллах салбараа
// сонгуулах хуудас. proxy.ts-ийн middleware workingBranchId байхгүй session-г
// эндрүү чиглүүлдэг; сонгосны дараа /dashboard-д харагдах "ажиллаж байна"
// баннер, жагсаалт/тайлангийн scope, шинэ захиалга/цагийн анхны салбар бүгд
// энд сонгосон утгаас хамаарна (харах: lib/auth/roles.ts workingBranchScopeId,
// app/_actions/auth.ts chooseBranchAction).
export default async function ChooseBranchPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await requireUser();
  // Аль хэдийн сонгосон бол дахин сонгуулахгүй — өөр салбар руу шилжихийн
  // тулд гарч дахин нэвтрэх ёстой (харах: chooseBranchAction-ийн тайлбар).
  if (user.workingBranchId) redirect("/dashboard");

  const { next: nextRaw } = await searchParams;
  const next = nextRaw && nextRaw.startsWith("/") ? nextRaw : "/dashboard";

  const branches = await prisma.branch.findMany({
    where: { tenantId: user.tenantId, isActive: true },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      city: true,
      district: true,
      address: true,
      openTime: true,
      closeTime: true,
    },
  });

  const allowAllBranches = canChooseAllBranches(user);

  return (
    <div className={`${plexSans.variable} ${plexMono.variable}`}>
      <TenantAuthShellWide
        title="Ажиллах салбараа сонгоно уу"
        subtitle="Өнөөдөр аль салбарт ажиллахаа сонгоно уу — захиалга, цаг захиалга, тайлан цаашид энэ салбараар харагдана. Өөр салбар руу шилжихийн тулд гарч дахин нэвтэрнэ үү."
      >
        {branches.length === 0 && !allowAllBranches ? (
          <div className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] p-6 text-center text-sm text-[var(--oc-muted3)]">
            Идэвхтэй салбар алга. Эхлээд салбараа бүртгүүлнэ үү.
          </div>
        ) : (
          <ChooseBranchForm
            branches={branches}
            allowAllBranches={allowAllBranches}
            next={next}
          />
        )}
      </TenantAuthShellWide>
    </div>
  );
}
