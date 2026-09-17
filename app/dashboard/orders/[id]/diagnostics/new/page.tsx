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

  // Захиалга эхэлсний дараа л оношилгоо бөглөнө (UI-аас гадуур хандсан
  // хамгаалалт — order-items.tsx-ийн холбоос аль хэдийн disable-лэгдсэн ч,
  // хуучин таб/шууд URL-аар ирж болзошгүй). Урьд нь энд redirect(backHref)
  // дуудаж ажилтныг тайлбаргүйгээр захиалгын хуудас руу шууд буцаадаг байсан
  // — оронд нь энд үлдээж, яагаад боломжгүйг тайлбарлана.
  if (!canFillDiagnostics(order.status as OrderStatus)) {
    return (
      <div className="p-4 sm:p-6 max-w-full flex-1 flex flex-col min-h-0 w-full">
        <PageHeader
          title="Оношилгоо бөглөх"
          description={`Засварын хуудас #${order.number} · ${order.vehicle.plate}`}
        />
        <div className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] p-6 flex flex-col items-start gap-3">
          <p className="text-sm text-[var(--oc-muted)]">
            Захиалга эхлээгүй байна. Эхлүүлсний дараа оношилгоо бөглөнө.
          </p>
          <Link
            href={backHref}
            className="text-sm text-[var(--oc-accent)] hover:text-[var(--oc-accent-hi)] transition-colors"
          >
            ← Захиалга руу буцах
          </Link>
        </div>
      </div>
    );
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
