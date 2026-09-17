import { Chip } from "@/app/_components/landing-ops-ui";
import { ClickableRow } from "@/app/_components/clickable-row";
import { EmptyState } from "@/app/_components/empty-state";
import { PageHeader } from "@/app/_components/page-header";
import { requireSuperAdmin } from "@/lib/auth/system";
import { prisma } from "@/lib/prisma";
import { CreateServiceKeyButton } from "./create-service-key-modal";

export const metadata = { title: "Системийн ангилал" };

export const dynamic = "force-dynamic";

export default async function SystemServiceKeysPage() {
  await requireSuperAdmin();

  const keys = await prisma.systemServiceKey.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: { _count: { select: { categories: true } } },
  });

  return (
    <div className="p-4 sm:p-6 max-w-full flex-1 flex flex-col min-h-0 w-full">
      <PageHeader
        title="Системийн ангилал"
        description="Байгууллага сонгохоос өмнө үйлчлүүлэгч ямар ажил хийлгэхээ сонгодог, платформ даяарх нэгдсэн ажлын жагсаалт. Тенант өөрийн ангиллаа эндхийн түлхүүрт холбож болно."
        actions={<CreateServiceKeyButton />}
      />

      {keys.length === 0 ? (
        <EmptyState>Одоогоор ажлын түлхүүр алга байна.</EmptyState>
      ) : (
        <div className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] overflow-hidden flex-1 min-h-0 flex flex-col">
          <div className="overflow-auto flex-1 min-h-0">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-[var(--oc-line)]">
                  {["Нэр", "Ашигласан ангилал", "Төлөв"].map((h) => (
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
                {keys.map((k) => (
                  <ClickableRow key={k.id} href={`/system/service-keys/${k.id}`}>
                    <td className="px-5 py-4">
                      <div className="text-sm font-medium text-[var(--oc-ink)]">
                        {k.name}
                      </div>
                      {k.description ? (
                        <div className="text-xs text-[var(--oc-muted3)] mt-0.5 line-clamp-1">
                          {k.description}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-5 py-4 font-plex-mono text-sm text-[var(--oc-muted2)]">
                      {k._count.categories}
                    </td>
                    <td className="px-5 py-4">
                      <Chip tone={k.isActive ? "ok" : "neutral"}>
                        {k.isActive ? "Идэвхтэй" : "Идэвхгүй"}
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
