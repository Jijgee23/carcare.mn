import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron-auth";
import { createNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { setBypassContext } from "@/lib/tenant-context";

/**
 * "Дараагийн үйлчилгээний сануулга" — `Service.reminderIntervalMonths`
 * тохируулсан үйлчилгээ (ж: Тос солиулах → 6 сар) COMPLETED болсноос хойш
 * тэр олон сар өнгөрсөн бол үйлчлүүлэгчид (Account холбогдсон бол) НЭГ л
 * удаа push мэдэгдэл илгээнэ. Зөвхөн апп/веб мэдэгдэл (DB + push), SMS
 * ИЛГЭЭХГҮЙ (appointment-reminders-тэй адил зарчим). Мөр бүрийг
 * `ServiceItem.reminderSentAt`-аар (claim-before-send, атомик `updateMany`)
 * тэмдэглэж давхар илгээхээс сэргийлнэ.
 *
 * Cron гадуурх (Vercel cron, cron-job.org) дуудна — `CRON_SECRET`-ээр
 * хамгаална. Өдөрт нэг удаа ажиллуулахад тохиромжтой.
 */
export async function POST(req: Request) {
  return run(req);
}

export async function GET(req: Request) {
  return run(req);
}

const MAX_BATCH_PER_SERVICE = 200;

/** `months` сарын өмнөх огноог тооцно — сарын өдрийн тоо ялгаатай тул нэг-хоёр
 * хоногийн зөрүү гарч болно (ж: гарагийн тоо өөр сар), гэхдээ энэ feature-д
 * тийм нарийвчлал шаардлагагүй (appointment/subscription reminder-үүд ч мөн
 * адил минут/хоногийн энгийн тооцоо ашигладаг). */
function monthsAgo(base: Date, months: number): Date {
  const d = new Date(base);
  d.setMonth(d.getMonth() - months);
  return d;
}

async function run(req: Request) {
  const denied = verifyCronSecret(req);
  if (denied) return denied;
  // Бүх tenant дундуур scan хийдэг cron тул RLS-г тойрч гарна.
  setBypassContext();

  const now = new Date();

  // Сануулга тохируулсан үйлчилгээ бүрийг тусад нь (давтамж өөр өөр тул нэг
  // глобал босго биш, үйлчилгээ тус бүрийн `reminderIntervalMonths`-аар
  // тооцсон босгоор) query хийнэ.
  const services = await prisma.service.findMany({
    where: { reminderIntervalMonths: { not: null } },
    select: { id: true, tenantId: true, name: true, reminderIntervalMonths: true },
  });

  let candidates = 0;
  let notified = 0;
  let skippedNoAccount = 0;

  for (const svc of services) {
    const threshold = monthsAgo(now, svc.reminderIntervalMonths!);
    const due = await prisma.serviceItem.findMany({
      where: {
        serviceId: svc.id,
        status: "COMPLETED",
        reminderSentAt: null,
        completedAt: { lte: threshold },
      },
      orderBy: { completedAt: "asc" },
      take: MAX_BATCH_PER_SERVICE,
      select: {
        id: true,
        order: {
          select: {
            tenantId: true,
            customer: { select: { accountId: true } },
            vehicle: { select: { plate: true } },
          },
        },
      },
    });
    candidates += due.length;

    for (const item of due) {
      // S17 Phase A-ийн адил зарчим (appointment-reminders): илгээхээс ӨМНӨ
      // атомикаар claim хийнэ — 2 зэрэгцээ cron invocation нэг мөрийг зэрэг
      // авахгүй, crash дунд орвол дахин илгээгдэхгүй (алгасагдана, давхар
      // илгээгдэхгүй).
      const claim = await prisma.serviceItem.updateMany({
        where: { id: item.id, reminderSentAt: null },
        data: { reminderSentAt: now },
      });
      if (claim.count !== 1) continue;

      const accountId = item.order.customer.accountId;
      if (!accountId) {
        // Онлайн бүртгэлгүй (Account холбогдоогүй) үйлчлүүлэгчид мэдэгдэх
        // суваг байхгүй тул алгасна — claim аль хэдийн тэмдэглэгдсэн тул
        // дараагийн ажиллагаанд дахин шалгагдахгүй.
        skippedNoAccount++;
        continue;
      }

      try {
        await createNotification({
          type: "service_reminder",
          recipient: { accountId },
          tenantId: item.order.tenantId,
          input: {
            serviceItemId: item.id,
            serviceId: svc.id,
            serviceName: svc.name,
            vehiclePlate: item.order.vehicle.plate,
          },
        });
        notified++;
      } catch (e) {
        console.warn("[notify] service_reminder:", e);
      }
    }
  }

  return NextResponse.json({
    ok: true,
    candidates,
    notified,
    skippedNoAccount,
    ranAt: now.toISOString(),
  });
}
