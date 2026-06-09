import { NextResponse } from "next/server";
import { createNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { sendSms } from "@/lib/sms";

/**
 * Удахгүй болох (24 цагийн дотор) баталгаажсан цаг захиалгуудад сануулга SMS
 * илгээнэ. Давхар илгээхгүйн тулд `reminderSentAt`-аар тэмдэглэнэ.
 *
 * Cron гадуурх (Vercel cron, cron-job.org) дуудна — `CRON_SECRET`-ээр хамгаална
 * (Bearer header эсвэл `?secret=`). Цагт нэг удаа ажиллуулахад тохиромжтой.
 */
export async function POST(req: Request) {
  return run(req);
}

export async function GET(req: Request) {
  return run(req);
}

const MAX_BATCH = 200;
const WINDOW_MS = 24 * 60 * 60 * 1000;

function formatWhen(d: Date): string {
  return d.toLocaleString("mn-MN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function run(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET тогтоогоогүй." }, { status: 500 });
  }
  const url = new URL(req.url);
  const bearer = (req.headers.get("authorization") ?? "").match(/^Bearer\s+(.+)$/i)?.[1];
  const supplied = bearer ?? url.searchParams.get("secret") ?? "";
  if (supplied !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const until = new Date(now.getTime() + WINDOW_MS);

  const due = await prisma.appointment.findMany({
    where: {
      status: "CONFIRMED",
      reminderSentAt: null,
      requestedAt: { gte: now, lte: until },
    },
    orderBy: { requestedAt: "asc" },
    take: MAX_BATCH,
    select: {
      id: true,
      tenantId: true,
      requestedAt: true,
      accountId: true,
      account: { select: { phone: true } },
      customer: { select: { phone: true } },
      tenant: { select: { name: true } },
      branch: { select: { name: true } },
    },
  });

  let smsSent = 0;
  let pushSent = 0;
  for (const a of due) {
    const phone = a.account?.phone ?? a.customer?.phone ?? null;
    const when = formatWhen(a.requestedAt);
    const body = `${a.tenant.name} (${a.branch.name}) дахь таны цаг ${when}-д товлогдсон байна.`;

    // SMS (утас байвал)
    if (phone) {
      const ok = await sendSms(phone, `Carcare: ${body}`);
      if (ok) smsSent++;
    }

    // Мэдэгдэл (DB + push) — онлайн захиалга (Account-той) бол. dedupeKey-р
    // давхар үүсэхээс хамгаална.
    if (a.accountId) {
      try {
        await createNotification({
          type: "appointment_reminder",
          recipient: { accountId: a.accountId },
          tenantId: a.tenantId,
          input: { appointmentId: a.id, body },
        });
        pushSent++;
      } catch (e) {
        console.warn("[notify] reminder:", e);
      }
    }

    // Давтан илгээхээс сэргийлж тэмдэглэнэ (амжилт/амжилтгүйгээс үл хамаарч).
    await prisma.appointment.update({
      where: { id: a.id },
      data: { reminderSentAt: new Date() },
    });
  }

  return NextResponse.json({
    ok: true,
    candidates: due.length,
    smsSent,
    pushSent,
    ranAt: now.toISOString(),
  });
}
