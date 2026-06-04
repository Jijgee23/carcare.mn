import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/app/_components/page-header";
import { requireUser } from "@/lib/auth";
import { canFillDiagnostics, type OrderStatus } from "@/lib/orders";
import {
  type TemplateSchema,
  emptySchema,
} from "@/lib/diagnostics";
import { prisma } from "@/lib/prisma";
import { DiagnosticForm } from "../diagnostic-form";
import { AddDiagnosticList } from "../add-diagnostic-list";

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
      status: true,
      vehicle: { select: { plate: true, make: true, model: true } },
    },
  });
  if (!order) notFound();

  // Захиалга эхэлсний дараа л оношилгоо бөглөнө (UI-аас гадуур хандсан хамгаалалт).
  if (!canFillDiagnostics(order.status as OrderStatus)) {
    redirect(`/dashboard/orders/${orderId}`);
  }

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

  return (
    <div className="p-6 sm:p-8 max-full flex-1 flex flex-col min-h-0 w-full">
      <PageHeader
        title="Оношилгооны загвар сонгох"
        description={`Захиалга #${order.number} · ${order.vehicle.plate}`}
      />

      <p className="text-sm text-white/40 -mt-2 mb-4">
        Сонгосон оношилгоо жагсаалтад нэмэгдэнэ. Дараа нь «Бөглөх» дарж бөглөнө.
      </p>

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
        <AddDiagnosticList orderId={orderId} templates={templates} />
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
