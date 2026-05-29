import { redirect } from "next/navigation";
import { Prisma } from "@/app/generated/prisma/client";
import {
  FilterSelect,
  ResetFilters,
  SearchBox,
} from "@/app/_components/list-filters";
import {
  EmptyState,
  PageHeader,
} from "@/app/_components/page-header";
import { requireUser } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Аудит лог",
};

const ACTION_LABEL: Record<string, string> = {
  CREATE: "Үүсгэсэн",
  UPDATE: "Шинэчлэсэн",
  DELETE: "Устгасан",
  STATUS_CHANGE: "Статус",
  PAYMENT_CHANGE: "Төлбөр",
  STOCK_CHANGE: "Нөөц",
  ITEM_ADDED: "Мөр нэмсэн",
  ITEM_REMOVED: "Мөр устгасан",
  LOGIN: "Нэвтэрсэн",
  LOGOUT: "Гарсан",
  OTHER: "Бусад",
};

const ACTION_BADGE: Record<string, string> = {
  CREATE: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
  UPDATE: "bg-blue-500/15 text-blue-300 border border-blue-500/30",
  DELETE: "bg-red-500/15 text-red-300 border border-red-500/30",
  STATUS_CHANGE: "bg-violet-500/15 text-violet-300 border border-violet-500/30",
  PAYMENT_CHANGE: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
  STOCK_CHANGE: "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30",
  ITEM_ADDED: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
  ITEM_REMOVED: "bg-rose-500/15 text-rose-300 border border-rose-500/30",
  LOGIN: "bg-white/10 text-white/60 border border-white/15",
  LOGOUT: "bg-white/10 text-white/60 border border-white/15",
  OTHER: "bg-white/10 text-white/60 border border-white/15",
};

const ENTITY_LABEL: Record<string, string> = {
  ServiceOrder: "Захиалга",
  Service: "Үйлчилгээ",
  Customer: "Үйлчлүүлэгч",
  Vehicle: "Машин",
  User: "Ажилтан",
  Branch: "Салбар",
};

const ACTION_OPTIONS = Object.entries(ACTION_LABEL).map(([value, label]) => ({
  value,
  label,
}));

const ENTITY_OPTIONS = Object.entries(ENTITY_LABEL).map(([value, label]) => ({
  value,
  label,
}));

const PAGE_SIZE = 50;

function entityHref(entity: string, entityId: string): string | null {
  switch (entity) {
    case "ServiceOrder":
      return `/dashboard/orders/${entityId}`;
    case "Service":
      return `/dashboard/services/${entityId}`;
    case "Customer":
      return `/dashboard/customers/${entityId}`;
    case "Vehicle":
      return `/dashboard/vehicles/${entityId}`;
    case "User":
      return `/dashboard/employees/${entityId}`;
    case "Branch":
      return `/dashboard/branches/${entityId}`;
    default:
      return null;
  }
}

function fmtDate(d: Date): string {
  return d.toLocaleString("mn-MN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    action?: string;
    entity?: string;
    userId?: string;
    page?: string;
  }>;
}) {
  const me = await requireUser();
  if (!hasPermission(me, "audit.view")) redirect("/dashboard");

  const {
    q = "",
    action = "",
    entity = "",
    userId = "",
    page: pageStr = "1",
  } = await searchParams;
  const page = Math.max(1, Number.parseInt(pageStr, 10) || 1);

  const where: Prisma.AuditLogWhereInput = { tenantId: me.tenantId };
  if (action) where.action = action as Prisma.EnumAuditActionFilter["equals"];
  if (entity) where.entity = entity;
  if (userId) where.userId = userId;
  if (q) {
    where.OR = [
      { summary: { contains: q, mode: "insensitive" } },
      { entityId: { contains: q } },
    ];
  }

  const [logs, total, users] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
      },
    }),
    prisma.auditLog.count({ where }),
    prisma.user.findMany({
      where: { tenantId: me.tenantId },
      orderBy: [{ firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="p-6 sm:p-8 max-full flex-1 flex flex-col min-h-0 w-full">
      <PageHeader
        title="Аудит лог"
        description="Тенант доторх чухал үйлдлийн түүх — захиалгын статус, төлбөр, нөөц, мөр нэмэх/устгах."
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          marginBottom: "1rem",
        }}
      >
        <SearchBox placeholder="Тайлбар, entity ID-аар хайх" />
        <FilterSelect
          paramName="action"
          placeholder="Бүх үйлдэл"
          options={ACTION_OPTIONS}
        />
        <FilterSelect
          paramName="entity"
          placeholder="Бүх обьект"
          options={ENTITY_OPTIONS}
        />
        <FilterSelect
          paramName="userId"
          placeholder="Бүх ажилтан"
          options={users.map((u) => ({
            value: u.id,
            label: `${u.lastName} ${u.firstName}`,
          }))}
        />
        <ResetFilters paramNames={["q", "action", "entity", "userId"]} />
      </div>

      {logs.length === 0 ? (
        <EmptyState
          title="Лог олдсонгүй"
          description="Шүүлтүүрээ өөрчилж үзнэ үү эсвэл системд үйлдэл хийгдсэн эсэхийг шалгана уу."
        />
      ) : (
        <div className="glass rounded-xl overflow-hidden flex-1 min-h-0 flex flex-col">
          <div className="px-5 py-3 border-b border-white/[0.06] text-xs text-white/40 flex items-center justify-between">
            <span>
              Нийт {total.toLocaleString("mn-MN")} бичлэг · {page}/{totalPages}{" "}
              хуудас
            </span>
          </div>

          <div className="overflow-auto flex-1 min-h-0">
            <table className="w-full min-w-[860px]">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {[
                    "Огноо",
                    "Хэрэглэгч",
                    "Обьект",
                    "Үйлдэл",
                    "Тайлбар",
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
                {logs.map((l) => {
                  const href = entityHref(l.entity, l.entityId);
                  const entityLabel = ENTITY_LABEL[l.entity] ?? l.entity;
                  return (
                    <tr
                      key={l.id}
                      className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-5 py-3 text-xs text-white/60 whitespace-nowrap">
                        {fmtDate(l.createdAt)}
                      </td>
                      <td className="px-5 py-3 text-sm text-white/70">
                        {l.user ? (
                          <>
                            {l.user.lastName} {l.user.firstName}
                            <div className="text-xs text-white/30">
                              {l.user.email}
                            </div>
                          </>
                        ) : (
                          <span className="text-white/30 text-xs">Систем</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-sm">
                        {href ? (
                          <a
                            href={href}
                            className="text-violet-300 hover:text-violet-200 transition-colors"
                          >
                            {entityLabel}
                          </a>
                        ) : (
                          <span className="text-white/70">{entityLabel}</span>
                        )}
                        <div className="text-xs text-white/30 font-mono">
                          {l.entityId.slice(0, 10)}…
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            ACTION_BADGE[l.action] ?? ACTION_BADGE.OTHER
                          }`}
                        >
                          {ACTION_LABEL[l.action] ?? l.action}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm text-white/70">
                        {l.summary ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 ? (
            <div className="px-5 py-3 border-t border-white/[0.06] flex items-center justify-end gap-2 text-xs">
              <PageLink
                page={page - 1}
                disabled={page <= 1}
                label="← Өмнөх"
                searchParamsObj={{ q, action, entity, userId }}
              />
              <span className="text-white/40">
                {page} / {totalPages}
              </span>
              <PageLink
                page={page + 1}
                disabled={page >= totalPages}
                label="Дараах →"
                searchParamsObj={{ q, action, entity, userId }}
              />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function PageLink({
  page,
  disabled,
  label,
  searchParamsObj,
}: {
  page: number;
  disabled: boolean;
  label: string;
  searchParamsObj: Record<string, string>;
}) {
  if (disabled) {
    return <span className="text-white/20 px-3 py-1">{label}</span>;
  }
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParamsObj)) {
    if (v) params.set(k, v);
  }
  params.set("page", String(page));
  return (
    <a
      href={`?${params.toString()}`}
      className="text-white/60 hover:text-white px-3 py-1 rounded-md hover:bg-white/[0.04] transition-colors"
    >
      {label}
    </a>
  );
}
