import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/app/_components/page-header";
import { requireUser } from "@/lib/auth";
import { canEdit } from "@/lib/auth/roles";
import { formatTugrik } from "@/lib/orders";
import { prisma } from "@/lib/prisma";
import {
  SERVICE_KIND_BADGE,
  SERVICE_KIND_LABEL,
  STOCK_BADGE,
  STOCK_LABEL,
  type ServiceKind,
  formatStock,
  stockLevel,
} from "@/lib/services";
import { ServiceForm } from "../service-form";
import { StockAdjustForm } from "../stock-adjust-form";

export const metadata = { title: "Үйлчилгээ засах" };

export default async function EditServicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  if (!canEdit(user, "services")) redirect("/dashboard/services");

  const { id } = await params;
  const svc = await prisma.service.findFirst({
    where: { id, tenantId: user.tenantId },
    include: {
      _count: { select: { items: true } },
      unit: { select: { id: true, name: true } },
      durationUnit: { select: { id: true, name: true } },
    },
  });
  if (!svc) notFound();

  const [laborCategories, units] = await Promise.all([
    prisma.laborCategory.findMany({
      where: { tenantId: user.tenantId },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      select: { id: true, name: true, isActive: true },
    }),
    prisma.unit.findMany({
      where: { tenantId: user.tenantId },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      select: { id: true, name: true, code: true, isActive: true },
    }),
  ]);

  const type = svc.type as ServiceKind;
  const isGoods = type === "GOODS";
  const stockNum = svc.stock ? Number.parseFloat(svc.stock.toString()) : 0;

  return (
    <div className="p-4 sm:p-6 max-w-full flex-1 flex flex-col min-h-0 w-full">
      <PageHeader
        title={svc.name}
        description={svc.code ? `Код: ${svc.code}` : undefined}
        actions={
          <span
            className={`text-xs px-2.5 py-1 rounded-full ${SERVICE_KIND_BADGE[type]}`}
          >
            {SERVICE_KIND_LABEL[type]}
          </span>
        }
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3 glass rounded-xl p-4 sm:p-5 border border-white/[0.08]">
          <h2 className="font-semibold mb-4">Мэдээлэл</h2>
          <ServiceForm
            laborCategories={laborCategories}
            units={units}
            initial={{
              id: svc.id,
              type,
              name: svc.name,
              code: svc.code,
              unitId: svc.unitId,
              price: svc.price.toString(),
              costPrice: svc.costPrice?.toString() ?? null,
              stock: svc.stock?.toString() ?? null,
              durationValue: svc.durationValue?.toString() ?? null,
              durationUnitId: svc.durationUnitId,
              description: svc.description,
              isActive: svc.isActive,
              laborCategoryId: svc.laborCategoryId,
            }}
          />
        </div>

        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="glass rounded-xl p-4 sm:p-5">
            <div className="text-xs text-white/40 uppercase tracking-wider">
              {isGoods ? "Одоогийн үлдэгдэл" : "Үнэ"}
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <div className="text-3xl font-bold gradient-text">
                {isGoods
                  ? formatStock(stockNum, svc.unit?.name ?? null)
                  : formatTugrik(svc.price.toString())}
              </div>
            </div>
            {isGoods ? (
              <div className="mt-3">
                <span
                  className={`text-xs px-2.5 py-1 rounded-full ${STOCK_BADGE[stockLevel(stockNum)]}`}
                >
                  {STOCK_LABEL[stockLevel(stockNum)]}
                </span>
              </div>
            ) : null}

            <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
              {isGoods ? (
                <>
                  <div>
                    <dt className="text-xs text-white/40">Өртөг</dt>
                    <dd className="mt-0.5 text-white/80">
                      {svc.costPrice
                        ? formatTugrik(svc.costPrice.toString())
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-white/40">Борлуулах</dt>
                    <dd className="mt-0.5 text-white/80">
                      {formatTugrik(svc.price.toString())}
                    </dd>
                  </div>
                </>
              ) : (
                <div>
                  <dt className="text-xs text-white/40">Нэгж</dt>
                  <dd className="mt-0.5 text-white/80">
                    {svc.unit?.name ?? "—"}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-white/40">Захиалгад орсон</dt>
                <dd className="mt-0.5 text-white/80">{svc._count.items} удаа</dd>
              </div>
              <div>
                <dt className="text-xs text-white/40">Бүртгэсэн</dt>
                <dd className="mt-0.5 text-white/80">
                  {svc.createdAt.toLocaleDateString("mn-MN")}
                </dd>
              </div>
            </dl>
          </div>

          {isGoods ? (
            <div className="glass rounded-xl p-4 sm:p-5">
              <h2 className="font-semibold mb-1">Орлого / Зарлага</h2>
              <p className="text-xs text-white/40 mb-4">
                Гараар тохируулах. Захиалгад ашиглавал автоматаар хасагдана.
              </p>
              <StockAdjustForm
                serviceId={svc.id}
                unit={svc.unit?.name ?? ""}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
