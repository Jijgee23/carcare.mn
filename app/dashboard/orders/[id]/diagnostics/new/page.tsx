import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/app/_components/page-header";
import { requireUser } from "@/lib/auth";
import {
  DIAGNOSTIC_TYPES,
  DIAGNOSTIC_TYPE_BADGE,
  DIAGNOSTIC_TYPE_DESCRIPTION,
  DIAGNOSTIC_TYPE_LABEL,
  type DiagnosticType,
  type TemplateSchema,
  emptySchema,
} from "@/lib/diagnostics";
import { prisma } from "@/lib/prisma";
import { DiagnosticForm } from "../diagnostic-form";

export const metadata = {
  title: "Оношилгоо хийх",
};

export default async function NewReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ templateId?: string }>;
}) {
  const user = await requireUser();
  const { id: orderId } = await params;
  const { templateId } = await searchParams;

  const order = await prisma.serviceOrder.findFirst({
    where: { id: orderId, tenantId: user.tenantId },
    select: {
      id: true,
      number: true,
      vehicle: { select: { plate: true, make: true, model: true } },
    },
  });
  if (!order) notFound();

  const backHref = `/dashboard/orders/${orderId}`;

  // Шууд template сонгогдсон бол түүнийг бөглөх формыг харуулна
  if (templateId) {
    const template = await prisma.diagnosticTemplate.findFirst({
      where: {
        id: templateId,
        tenantId: user.tenantId,
        isActive: true,
      },
    });
    if (!template) notFound();
    let schema: TemplateSchema;
    try {
      schema = template.schema as unknown as TemplateSchema;
      if (!schema.sections) schema = emptySchema();
    } catch {
      schema = emptySchema();
    }

    return (
      <div className="p-6 sm:p-8 max-full flex-1 flex flex-col min-h-0 w-full">
        <PageHeader
          title="Оношилгоо бөглөх"
          description={`Захиалга #${order.number} · ${order.vehicle.plate}`}
        />
        <DiagnosticForm
          orderId={orderId}
          templateId={template.id}
          templateName={template.name}
          schema={schema}
          backHref={backHref}
        />
      </div>
    );
  }

  // Эс бөгөөс — төрлөөр бүлэглэсэн загвар сонголтыг харуулна
  const templates = await prisma.diagnosticTemplate.findMany({
    where: { tenantId: user.tenantId, isActive: true },
    orderBy: [{ type: "asc" }, { createdAt: "desc" }],
    select: { id: true, name: true, description: true, type: true },
  });

  const byType: Record<DiagnosticType, typeof templates> = {
    INTAKE: [],
    POST_SERVICE: [],
    ROUTINE: [],
    DAMAGE_REPORT: [],
  };
  for (const t of templates) {
    byType[t.type as DiagnosticType].push(t);
  }

  return (
    <div className="p-6 sm:p-8 max-full flex-1 flex flex-col min-h-0 w-full">
      <PageHeader
        title="Оношилгооны загвар сонгох"
        description={`Захиалга #${order.number} · ${order.vehicle.plate}`}
      />

      {templates.length === 0 ? (
        <div className="glass rounded-2xl p-10 text-center">
          <p className="text-sm text-white/60 mb-3">
            Идэвхтэй загвар алга байна.
          </p>
          <Link
            href="/dashboard/services/diagnostics/new"
            className="inline-block text-sm text-violet-300 hover:text-violet-200"
          >
            Шинэ загвар үүсгэх →
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {DIAGNOSTIC_TYPES.map((tp) => {
            const list = byType[tp];
            if (list.length === 0) return null;
            return (
              <section
                key={tp}
                className="glass rounded-2xl border border-white/[0.08] overflow-hidden"
              >
                <div className="px-5 py-3 flex items-center gap-3 border-b border-white/[0.06]">
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full ${DIAGNOSTIC_TYPE_BADGE[tp]}`}
                  >
                    {DIAGNOSTIC_TYPE_LABEL[tp]}
                  </span>
                  <span className="text-xs text-white/40">
                    {DIAGNOSTIC_TYPE_DESCRIPTION[tp]}
                  </span>
                </div>
                <div className="divide-y divide-white/[0.04]">
                  {list.map((t) => (
                    <Link
                      key={t.id}
                      href={`/dashboard/orders/${orderId}/diagnostics/new?templateId=${t.id}`}
                      className="flex items-center justify-between px-5 py-3 hover:bg-white/[0.02] transition-colors"
                    >
                      <div>
                        <div className="text-sm font-medium text-white/90">
                          {t.name}
                        </div>
                        {t.description ? (
                          <div className="text-xs text-white/40 mt-0.5">
                            {t.description}
                          </div>
                        ) : null}
                      </div>
                      <span className="text-xs text-violet-300">Сонгох →</span>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <div className="mt-6">
        <Link
          href={backHref}
          className="text-sm text-white/50 hover:text-white/80"
        >
          ← Захиалга руу буцах
        </Link>
      </div>
    </div>
  );
}
