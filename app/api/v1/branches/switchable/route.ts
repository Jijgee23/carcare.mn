import { jsonOk, requireApiUser } from "@/lib/api";
import { canChooseAllBranches, eligibleBranchIds } from "@/lib/auth/roles";
import { resolveTodayLockedBranch } from "@/lib/employee-branch-lock";
import { prisma } from "@/lib/prisma";

/**
 * Мобайл/API клиентийн "ажиллах салбар" сэлгэгчид зориулсан жагсаалт —
 * `app/dashboard/layout.tsx`-ийн web дахь адил тооцооллын API хувилбар
 * (харах: тэнд `switchableBranches`/`allowAllBranches`/`lockedBranch`).
 * Нэвтэрсэн эсэхээс өөр эрх шаардахгүй — ажиллах салбартай хэн бүхэнд
 * сэлгэгчийг харуулна.
 */
export async function GET(req: Request) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;
  const user = auth.user;

  const allowAll = canChooseAllBranches(user);

  // `ApiUser` (lib/auth/api-token.ts) нь одоо `assignableBranchIds`-г шууд
  // дагуулж ирдэг тул тусад нь Prisma-аар татах шаардлагагүй (харах:
  // lib/auth/api-branch.ts-д ижил засвар хийгдсэн).
  const assignable = user.isOwner ? [] : user.assignableBranchIds;
  const eligible = eligibleBranchIds({ branchId: user.branchId, assignableBranchIds: assignable });
  const restrictToEligible = !user.isOwner && eligible.length > 0;

  const [branches, locked] = await Promise.all([
    prisma.branch.findMany({
      where: {
        tenantId: user.tenantId,
        isActive: true,
        ...(restrictToEligible ? { id: { in: eligible } } : {}),
      },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      // district/address/openTime/closeTime — web /page/choose-branch-ийн
      // картад харуулдагтай адил мобайл сонголтын дэлгэцэд (additive).
      select: {
        id: true,
        name: true,
        isPrimary: true,
        district: true,
        address: true,
        openTime: true,
        closeTime: true,
      },
    }),
    resolveTodayLockedBranch(user),
  ]);

  return jsonOk({
    branches,
    allowAll,
    lockedBranchId: locked?.branchId ?? null,
  });
}
