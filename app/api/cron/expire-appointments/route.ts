import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { setBypassContext } from "@/lib/tenant-context";

/**
 * Хугацаа нь хэтэрсэн (requestedAt < now) боловч ажилтан хараахан хариу
 * өгөөгүй (PENDING) цаг захиалгуудыг автоматаар CANCELLED болгоно.
 *
 * Баталгаажсан (CONFIRMED) захиалгыг хөндөхгүй — тэдгээрийг ажилтан өөрөө
 * "Ирээгүй" эсвэл "Цуцлах"-аар шийднэ.
 *
 * Мөр бүрт: (1) статус → CANCELLED, (2) AuditLog (систем — userId=null, "яагаад"
 * тодорхой харагдана), (3) онлайн захиалга (Account-той) бол мэдэгдэл.
 *
 * Cron гадуурх (Vercel cron, QStash, cron-job.org) дуудна. Bearer secret
 * шалгаж нэвтрэхгүй бол 401.
 *
 * Setup: env-д `CRON_SECRET=<random>` тогтоо. Vercel Cron-аас дуудаж байгаа бол
 * `Authorization: Bearer <CRON_SECRET>` нэмж тавина.
 */
export async function POST(req: Request) {
  return run(req);
}

// GET-ыг бас зөвшөөрөв (зарим cron service зөвхөн GET дэмждэг — гэхдээ
// secret-ыг URL-ээр шалгах сонголт нэмж байна).
export async function GET(req: Request) {
  return run(req);
}

const MAX_BATCH = 200;

async function run(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET тогтоогоогүй." },
      { status: 500 },
    );
  }

  const url = new URL(req.url);
  const headerAuth = req.headers.get("authorization") ?? "";
  const bearer = headerAuth.match(/^Bearer\s+(.+)$/i)?.[1];
  const tokenFromQuery = url.searchParams.get("secret");
  const supplied = bearer ?? tokenFromQuery ?? "";

  if (supplied !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Бүх tenant дундуур scan хийдэг cron тул RLS-г тойрч гарна.
  setBypassContext();

  const now = new Date();

  const due = await prisma.appointment.findMany({
    where: {
      status: "PENDING",
      requestedAt: { lt: now },
    },
    orderBy: { requestedAt: "asc" },
    take: MAX_BATCH,
    select: { id: true, tenantId: true, branchId: true, accountId: true, requestedAt: true },
  });

  let notified = 0;
  for (const a of due) {
    await prisma.appointment.update({
      where: { id: a.id },
      data: { status: "CANCELLED" },
    });

    await logAudit({
      tenantId: a.tenantId,
      branchId: a.branchId,
      entity: "Appointment",
      entityId: a.id,
      action: "STATUS_CHANGE",
      summary: "Цаг → CANCELLED (хугацаа хэтэрснээр систем автоматаар цуцалсан)",
      after: { status: "CANCELLED", reason: "expired" },
    });

    // Онлайн захиалга (Account-той) бол хэрэглэгчид мэдэгдэнэ.
    if (a.accountId) {
      try {
        await createNotification({
          type: "appointment_expired",
          recipient: { accountId: a.accountId },
          tenantId: a.tenantId,
          input: { appointmentId: a.id },
        });
        notified++;
      } catch (e) {
        console.warn("[notify] expireAppointment:", e);
      }
    }
  }

  return NextResponse.json({
    ok: true,
    expiredAppointments: due.length,
    notified,
    ranAt: now.toISOString(),
  });
}
