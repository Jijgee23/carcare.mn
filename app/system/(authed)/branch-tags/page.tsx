import { Chip } from "@/app/_components/landing-ops-ui";
import { ClickableRow } from "@/app/_components/clickable-row";
import { PageHeader } from "@/app/_components/page-header";
import { requireSuperAdmin } from "@/lib/auth/system";
import { prisma } from "@/lib/prisma";
import { CreateBranchTagButton } from "./create-branch-tag-modal";

export const metadata = { title: "Салбарын шошго" };

export const dynamic = "force-dynamic";

export default async function BranchTagsPage() {
  await requireSuperAdmin();

  const tags = await prisma.branchTag.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: { _count: { select: { branches: true } } },
  });

  return (
    <div className="p-4 sm:p-6 max-w-full flex-1 flex flex-col min-h-0 w-full">
      <PageHeader
        title="Салбарын шошго"
        description="Discover дээр байгууллага/салбарыг бизнесийн төрлөөр (жишээ: Угаалгын газар, Дугуй засвар) шүүхэд ашиглах платформ даяарх нэгдсэн шошгын жагсаалт."
        actions={<CreateBranchTagButton />}
      />

      {tags.length === 0 ? (
        <div className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] p-10 text-center text-sm text-[var(--oc-muted3)]">
          Одоогоор шошго алга байна.
        </div>
      ) : (
        <div className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] overflow-hidden flex-1 min-h-0 flex flex-col">
          <div className="overflow-auto flex-1 min-h-0">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-[var(--oc-line)]">
                  {["Нэр", "Ашигласан салбар", "Төлөв"].map((h) => (
                    <th
                      key={h}
                      className="text-left font-plex-mono text-[10.5px] uppercase tracking-[0.08em] text-[var(--oc-muted3)] font-medium px-5 py-3"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--oc-line)]">
                {tags.map((t) => (
                  <ClickableRow key={t.id} href={`/system/branch-tags/${t.id}`}>
                    <td className="px-5 py-4">
                      <div className="text-sm font-medium text-[var(--oc-ink)]">
                        {t.name}
                      </div>
                      {t.description ? (
                        <div className="text-xs text-[var(--oc-muted3)] mt-0.5 line-clamp-1">
                          {t.description}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-5 py-4 font-plex-mono text-sm text-[var(--oc-muted2)]">
                      {t._count.branches}
                    </td>
                    <td className="px-5 py-4">
                      <Chip tone={t.isActive ? "ok" : "neutral"}>
                        {t.isActive ? "Идэвхтэй" : "Идэвхгүй"}
                      </Chip>
                    </td>
                  </ClickableRow>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
