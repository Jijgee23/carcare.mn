import { deleteBranchAction } from "@/app/_actions/branches";
import { ClickableRow } from "@/app/_components/clickable-row";
import {
  EmptyState,
  PageHeader,
  PrimaryLinkButton,
} from "@/app/_components/page-header";
import { Pagination } from "@/app/_components/pagination";
import { buildMeta, getPageInfo } from "@/lib/pagination";
import { requireUser } from "@/lib/auth";
import { canCreate, canDelete, canView } from "@/lib/auth/roles";
import { redirect } from "next/navigation";
import { formatAddress, formatWorkDays } from "@/lib/branches";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Салбарууд",
};

export default async function BranchesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requireUser();
  if (!canView(user, "branches")) redirect("/dashboard");
  const canAdd = canCreate(user, "branches");
  const canRemove = canDelete(user, "branches");

  const { page: pageParam } = await searchParams;
  const where = { tenantId: user.tenantId };
  const { page, pageSize, skip, take } = getPageInfo(pageParam);
  const [branches, total] = await Promise.all([
    prisma.branch.findMany({
      where,
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      skip,
      take,
      include: {
        _count: { select: { users: true, serviceOrders: true } },
        schedules: { select: { weekday: true, isOpen: true } },
      },
    }),
    prisma.branch.count({ where }),
  ]);
  const meta = buildMeta(total, page, pageSize);

  return (
    <div className="p-4 sm:p-6 max-w-full flex-1 flex flex-col min-h-0 w-full">
      <PageHeader
        title="Салбарууд"
        description="Байгууллагын салбаруудаа удирдах"
        actions={
          canAdd ? (
            <PrimaryLinkButton href="/dashboard/branches/new">
              Салбар нэмэх
            </PrimaryLinkButton>
          ) : null
        }
      />

      {branches.length === 0 ? (
        <EmptyState
          title="Салбар алга байна"
          description="Эхний салбараа үүсгэж эхлээрэй. Олон салбар нэмэх боломжтой."
          cta={
            canAdd ? (
              <PrimaryLinkButton href="/dashboard/branches/new">
                Эхний салбар үүсгэх
              </PrimaryLinkButton>
            ) : null
          }
        />
      ) : (
        <div className="glass rounded-2xl overflow-hidden flex-1 min-h-0 flex flex-col">
          <div className="overflow-auto flex-1 min-h-0">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {[
                    "Нэр",
                    "Хаяг",
                    "Цаг",
                    "Өдөр",
                    "Утас",
                    "Ажилтан",
                    "Захиалга",
                    "",
                  ].map((h) => (
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
                {branches.map((b) => (
                  <ClickableRow key={b.id} href={`/dashboard/branches/${b.id}`}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500/30 to-blue-500/30 flex items-center justify-center text-sm font-bold text-violet-300 shrink-0">
                          {b.name[0]?.toUpperCase() ?? "?"}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-white/90">
                              {b.name}
                            </span>
                            {b.isPrimary ? (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/30">
                                Үндсэн
                              </span>
                            ) : null}
                          </div>
                          <div className="text-xs text-white/30">
                            {b.createdAt.toLocaleDateString("mn-MN")}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-white/50 max-w-xs">
                      <div className="line-clamp-2">{formatAddress(b)}</div>
                      {b.latitude != null && b.longitude != null ? (
                        <a
                          href={`https://www.google.com/maps?q=${b.latitude},${b.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-violet-400/80 hover:text-violet-300"
                        >
                          📍 Газрын зураг
                        </a>
                      ) : null}
                    </td>
                    <td className="px-5 py-4 text-sm text-white/60 whitespace-nowrap">
                      {b.openTime && b.closeTime
                        ? `${b.openTime} – ${b.closeTime}`
                        : "—"}
                    </td>
                    <td className="px-5 py-4 text-xs text-white/50 whitespace-nowrap">
                      {formatWorkDays(b.schedules)}
                    </td>
                    <td className="px-5 py-4 text-sm text-white/50">
                      {b.phone ?? "—"}
                    </td>
                    <td className="px-5 py-4 text-sm text-white/60">
                      {b._count.users}
                    </td>
                    <td className="px-5 py-4 text-sm text-white/60">
                      {b._count.serviceOrders}
                    </td>
                    <td className="px-5 py-4">
                      {canRemove && !b.isPrimary ? (
                        <div className="flex items-center justify-end">
                          <form action={deleteBranchAction}>
                            <input type="hidden" name="id" value={b.id} />
                            <button
                              type="submit"
                              className="text-xs text-red-400 hover:text-red-300 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-red-500/10"
                            >
                              Устгах
                            </button>
                          </form>
                        </div>
                      ) : null}
                    </td>
                  </ClickableRow>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={meta.page}
            totalPages={meta.totalPages}
            total={meta.total}
          />
        </div>
      )}
    </div>
  );
}
