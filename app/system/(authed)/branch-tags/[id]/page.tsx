import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmForm } from "@/app/_components/confirm-form";
import { requireSuperAdmin } from "@/lib/auth/system";
import { deleteBranchTagAction } from "@/app/_actions/system-branch-tags";
import { prisma } from "@/lib/prisma";
import { BranchTagForm } from "../branch-tag-form";

export const metadata = { title: "Шошго засах" };

export default async function EditBranchTagPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSuperAdmin();
  const { id } = await params;

  const tag = await prisma.branchTag.findUnique({
    where: { id },
    include: { _count: { select: { branches: true } } },
  });
  if (!tag) notFound();

  return (
    <div className="p-4 sm:p-6 flex-1 flex flex-col min-h-0 w-full max-w-xl">
      <nav className="flex items-center gap-1.5 text-[13px] text-[var(--oc-muted3)] mb-3">
        <Link href="/system/branch-tags" className="hover:text-[var(--oc-accent-hi)] transition-colors">
          Салбарын шошго
        </Link>
        <span>/</span>
        <span className="text-[var(--oc-muted)]">{tag.name}</span>
      </nav>

      <h1 className="text-2xl font-semibold text-[var(--oc-ink)] mb-1">
        Шошго засах
      </h1>
      <p className="text-sm text-[var(--oc-muted3)] mb-6">
        {tag._count.branches} салбар ашиглаж байна.
      </p>

      <div className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] p-5 sm:p-6 mb-6">
        <BranchTagForm
          initial={{
            id: tag.id,
            name: tag.name,
            description: tag.description,
            isActive: tag.isActive,
          }}
        />
      </div>

      <div className="rounded-[10px] border border-red-500/25 bg-[var(--oc-panel)] p-5 sm:p-6">
        <h2 className="font-semibold text-red-400 light:text-red-600 mb-2 text-sm">
          Аюултай бүс
        </h2>
        <p className="text-xs text-[var(--oc-muted3)] mb-4">
          {tag._count.branches > 0
            ? "Салбар ашиглаж байгаа тул идэвхгүй болгоно (устгагдахгүй)."
            : "Ашиглаагүй тул бүрмөсөн устгагдана."}
        </p>
        <ConfirmForm
          action={deleteBranchTagAction}
          message={
            tag._count.branches > 0
              ? `"${tag.name}" шошгыг идэвхгүй болгох уу?`
              : `"${tag.name}" шошгыг устгах уу?`
          }
        >
          <input type="hidden" name="id" value={tag.id} />
          <button
            type="submit"
            className="text-sm text-red-400 hover:text-red-300 light:text-red-600 light:hover:text-red-700 transition-colors px-3 py-2 rounded-lg hover:bg-red-500/10 border border-red-500/25"
          >
            {tag._count.branches > 0 ? "Идэвхгүй болгох" : "Устгах"}
          </button>
        </ConfirmForm>
      </div>
    </div>
  );
}
