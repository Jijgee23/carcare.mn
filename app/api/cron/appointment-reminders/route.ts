import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron-auth";
import { createNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { sendSms } from "@/lib/sms";
import { setBypassContext } from "@/lib/tenant-context";

/**
 * Удахгүй болох (24 цагийн дотор) баталгаажсан цаг захиалгуудад сануулга SMS
 * илгээнэ. Давхар илгээхгүйн тулд `reminderSentAt`-аар тэмдэглэнэ.
 *
 * Cron гадуурх (Vercel cron, cron-job.org) дуудна — `CRON_SECRET`-ээр хамгаална
 * (зөвхөн `Authorization: Bearer` header — S17-аас хойш `?secret=` дэмжихгүй).
 * Цагт нэг удаа ажиллуулахад тохиромжтой.
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
  // S17 Phase A: explicit business timezone — host-local formatting silently
  // shifted the SMS text whenever the server isn't in Asia/Ulaanbaatar (same
  // convention as lib/booking-time.ts's bookingDateKey/parseBusinessLocalDateTime).
  return d.toLocaleString("mn-MN", {
    timeZone: "Asia/Ulaanbaatar",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

async function run(req: Request) {
  const denied = verifyCronSecret(req);
  if (denied) return denied;
  // Бүх tenant дундуур scan хийдэг cron тул RLS-г тойрч гарна.
  setBypassContext();

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
    // S17 Phase A: atomic claim BEFORE sending — a conditional `updateMany`
    // scoped to `reminderSentAt: null` so only ONE concurrent cron
    // invocation can claim a given row (the other gets `count === 0` and
    // skips it, never double-sending). We claim first and send after,
    // rather than send-then-mark, so a crash between the two can only ever
    // lose a reminder (accepted tradeoff — full retry semantics are Phase C,
    // out of scope), never send it twice.
    const claim = await prisma.appointment.updateMany({
      where: { id: a.id, reminderSentAt: null },
      data: { reminderSentAt: new Date() },
    });
    if (claim.count !== 1) continue;

    const phone = a.account?.phone ?? a.customer?.phone ?? null;
    const when = formatWhen(a.requestedAt);
    const body = `${a.tenant.name} (${a.branch.name}) дахь таны цаг ${when}-д товлогдсон байна.`;

    // SMS (утас байвал). Хэрэв sendSms амжилтгүй болвол мөр нэгэнт claim
    // хийгдсэн хэвээр үлдэнэ (дахин оролдохгүй — дээрх тайлбарыг үз).
    if (phone) {
      const ok = await sendSms(phone, `Carservice: ${body}`);
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
  }

  return NextResponse.json({
    ok: true,
    candidates: due.length,
    smsSent,
    pushSent,
    ranAt: now.toISOString(),
  });
}
