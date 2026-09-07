import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { branchScopeId, hasPermission } from "@/lib/auth/roles";
import { resolveCategoryDurationMinutes } from "@/lib/category-duration";
import { prisma } from "@/lib/prisma";
import { BranchDurationsSection } from "../branch-durations-section";

export const metadata = {
  title: "Ангиллын хугацаа",
};

export default async function BranchDurationsPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string }>;
}) {
  const user = await requireUser();
  // `services.duration` эрх (эсвэл owner) шаардана — booking v2 branch-мастер.
  if (!hasPermission(user, "services.duration")) redirect("/dashboard/services");

  const sp = await searchParams;
  // Хатуу хамрах хүрээ: owner → null (бүх салбарыг сонгож/засаж болно), салбар-
  // мастер (non-owner) → өөрийн салбар. Нэвтрэхдээ сонгосон "ажиллах салбар"
  // (workingBranchId) нь ЗӨВХӨН харагдацын шүүлт тул editor-ыг хязгаарлахгүй.
  const forcedBranchId = branchScopeId(user); // null = owner/tenant-wide

  const branches = await prisma.branch.findMany({
    where: { tenantId: user.tenantId, isActive: true },
    orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
    select: { id: true, name: true },
  });

  // Зорих салбар: forced (салбар-мастер) > query (?branch=) > нэвтрэлтийн working
  // branch (owner-ийн эвтэйхэн default) > эхний салбар.
  const queryBranch =
    sp.branch && branches.some((b) => b.id === sp.branch) ? sp.branch : null;
  const workingDefault =
    user.workingBranchId && branches.some((b) => b.id === user.workingBranchId)
      ? user.workingBranchId
      : null;
  const targetBranchId =
    forcedBranchId ?? queryBranch ?? workingDefault ?? branches[0]?.id ?? null;
  const targetBranch = branches.find((b) => b.id === targetBranchId) ?? null;

  const [categories, overrides] = targetBranchId
    ? await Promise.all([
        prisma.category.findMany({
          where: { tenantId: user.tenantId, isActive: true },
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            durationMinutes: true,
            branches: { select: { id: true } },
          },
        }),
        prisma.branchCategoryDuration.findMany({
          where: { branchId: targetBranchId },
          select: { categoryId: true, durationMinutes: true },
        }),
      ])
    : [[], []];

  const overrideBy = new Map(overrides.map((o) => [o.categoryId, o.durationMinutes]));

  // Тухайн салбарт санал болгож буй ангилалууд (branches хоосон = бүх салбар).
  const rows = categories
    .filter(
      (c) =>
        c.branches.length === 0 ||
        c.branches.some((b) => b.id === targetBranchId),
    )
    .map((c) => {
      const override = overrideBy.get(c.id) ?? null;
      return {
        id: c.id,
        name: c.name,
        defaultMinutes: c.durationMinutes,
        overrideMinutes: override,
        effectiveMinutes: resolveCategoryDurationMinutes({
          branchOverride: override,
          categoryDefault: c.durationMinutes,
        }),
      };
    });

  return (
    <div className="p-4 sm:p-6 max-w-full flex-1 flex flex-col min-h-0 w-full">
      <nav className="flex items-center gap-1.5 text-[13px] text-[var(--oc-muted3)] mb-3">
        <Link href="/dashboard/services" className="hover:text-[var(--oc-accent-hi)] transition-colors">
          Үйлчилгээ
        </Link>
        <span>/</span>
        <span className="text-[var(--oc-muted)]">Ангиллын хугацаа</span>
      </nav>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[var(--oc-ink)]">
          Ангиллын захиалгын хугацаа
        </h1>
        <p className="text-sm text-[var(--oc-muted3)] mt-1">
          Онлайн захиалгын ангилал бүрийн үргэлжлэх хугацааг тухайн салбарт
          тааруулна. Хоосон орхивол ангиллын нийтлэг (default) хугацаа, түүнгүй бол
          30 мин хэрэглэгдэнэ.
        </p>
      </div>

      <div className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] p-4 sm:p-5">
        {targetBranchId ? (
          <BranchDurationsSection
            rows={rows}
            branches={branches}
            currentBranchId={targetBranchId}
            currentBranchName={targetBranch?.name ?? "—"}
            // Owner/tenant-wide бол салбар сонгуулна + form-д branchId явуулна.
            // Салбар-мастер бол form branchId шаардлагагүй (сервер шахна).
            canSwitchBranch={forcedBranchId == null}
            formBranchId={forcedBranchId == null ? targetBranchId : null}
          />
        ) : (
          <p className="text-xs text-[var(--oc-muted3)]">
            Идэвхтэй салбар бүртгэгдээгүй байна.
          </p>
        )}
      </div>
    </div>
  );
}
