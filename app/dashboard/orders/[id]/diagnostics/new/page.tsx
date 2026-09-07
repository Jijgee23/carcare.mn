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

export const metadata = {
  title: "Оношилгоо хийх",
};

export default async function NewReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ itemId?: string }>;
}) {
  const user = await requireUser();
  const { id: orderId } = await params;
  const { itemId } = await searchParams;

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

  const backHref = `/dashboard/orders/${orderId}`;

  // Захиалга эхэлсний дараа л оношилгоо бөглөнө (UI-аас гадуур хандсан хамгаалалт).
  if (!canFillDiagnostics(order.status as OrderStatus)) {
    redirect(backHref);
  }

  // Оношилгоог захиалгын "Үйлчилгээ" хэсгээс (kind=DIAGNOSTIC мөр нэмэх)
  // сонгодог тул энд зөвхөн тухайн, хараахан бөглөгдөөгүй мөрийг бөглөх
  // формыг харуулна — жагсаалтаас сонгох тусдаа алхам байхгүй болсон.
  if (!itemId) redirect(backHref);

  const item = await prisma.serviceItem.findFirst({
    where: {
      id: itemId,
      orderId,
      kind: "DIAGNOSTIC",
      status: { not: "CANCELLED" },
      diagnosticReportId: null,
    },
    select: {
      id: true,
      diagnosticTemplate: true,
    },
  });
  if (!item?.diagnosticTemplate) notFound();

  const template = item.diagnosticTemplate;
  let schema: TemplateSchema;
  try {
    schema = template.schema as unknown as TemplateSchema;
    if (!schema.sections) schema = emptySchema();
  } catch {
    schema = emptySchema();
  }

  return (
    <div className="p-4 sm:p-6 max-w-full flex-1 flex flex-col min-h-0 w-full">
      <PageHeader
        title="Оношилгоо бөглөх"
        description={`Засварын хуудас #${order.number} · ${order.vehicle.plate}`}
      />
      <DiagnosticForm
        orderId={orderId}
        itemId={item.id}
        templateId={template.id}
        templateName={template.name}
        schema={schema}
        backHref={backHref}
      />
    </div>
  );
}
