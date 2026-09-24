import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron-auth";
import { createNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { setBypassContext } from "@/lib/tenant-context";

/**
 * Удахгүй болох баталгаажсан цаг захиалгуудад сануулга илгээнэ — зөвхөн
 * апп/веб мэдэгдэл (DB + push), SMS ИЛГЭЭХГҮЙ (зөвхөн `accountId`-тэй, өөрөөр
 * хэлбэл онлайн бүртгэлтэй үйлчлүүлэгчид хүрнэ — утсаар захиалсан, Account-гүй
 * захиалгад мэдэгдэх суваг байхгүй). Хэдэн минутын өмнө илгээхийг тенант бүр
 * `Tenant.appointmentReminderLeadMinutes`-ээр өөрөө тохируулна (24 цагаас,
 * өөрөөр хэлбэл 1440-ээс их байж болно — жиш. 1 хоног 4 цаг = 1680мин = 28ц
 * өмнө, 0 хоног 5 цаг = 300мин = 5ц өмнө). Тул тенант тус бүрийг тусад нь,
 * өөрийнх нь lead-ээр тооцсон цонхоор query хийнэ (нэг глобал цонх биш).
 * Давхар илгээхгүйн тулд `reminderSentAt`-аар тэмдэглэнэ.
 *
 * Cron гадуурх (Vercel cron, cron-job.org) дуудна — `CRON_SECRET`-ээр хамгаална
 * (зөвхөн `Authorization: Bearer` header — S17-аас хойш `?secret=` дэмжихгүй).
 * 30 минут тутам ажиллуулахад тохиромжтой (lead хугацаа тохируулснаас хойш
 * хэт удаан хүлээхгүйн тулд цагт нэг удаагаас нягт).
 */
export async function POST(req: Request) {
  return run(req);
}

export async function GET(req: Request) {
  return run(req);
}

const MAX_BATCH_PER_TENANT = 200;

function formatWhen(d: Date): string {
  // S17 Phase A: explicit business timezone — host-local formatting silently
  // shifted the notification text whenever the server isn't in
  // Asia/Ulaanbaatar (same convention as lib/booking-time.ts's
  // bookingDateKey/parseBusinessLocalDateTime).
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

  // Тенант бүрийн өөрийнх нь lead-ээр тооцсон цонхоор тусад нь query хийнэ —
  // нэг глобал цонх ашиглавал богино lead-тэй тенантын мөр хэт эрт (эсвэл
  // урт lead-тэй тенантынх хэтэрхий оройтож) шүүгдэнэ.
  const tenants = await prisma.tenant.findMany({
    select: { id: true, appointmentReminderLeadMinutes: true },
  });

  let candidates = 0;
  let pushSent = 0;

  for (const t of tenants) {
    const until = new Date(
      now.getTime() + t.appointmentReminderLeadMinutes * 60_000,
    );
    const due = await prisma.appointment.findMany({
      where: {
        tenantId: t.id,
        status: "CONFIRMED",
        reminderSentAt: null,
        requestedAt: { gte: now, lte: until },
      },
      orderBy: { requestedAt: "asc" },
      take: MAX_BATCH_PER_TENANT,
      select: {
        id: true,
        tenantId: true,
        requestedAt: true,
        accountId: true,
        tenant: { select: { name: true } },
        branch: { select: { name: true } },
      },
    });
    candidates += due.length;

    for (const a of due) {
      // S17 Phase A: atomic claim BEFORE sending — a conditional `updateMany`
      // scoped to `reminderSentAt: null` so only ONE concurrent cron
      // invocation can claim a given row (the other gets `count === 0` and
      // skips it, never double-sending). We claim first and send after,
      // rather than send-then-mark, so a crash between the two can only ever
      // lose a reminder (accepted tradeoff — full retry semantics are Phase C,
      // out of scope), never send it twice.
      // Нэг мөрийн DB алдаа үлдсэн batch-ийг зогсоохгүй.
      let claim: { count: number };
      try {
        claim = await prisma.appointment.updateMany({
          where: { id: a.id, reminderSentAt: null },
          data: { reminderSentAt: new Date() },
        });
      } catch (e) {
        console.warn("[cron] appointment-reminders claim failed:", a.id, e);
        continue;
      }
      if (claim.count !== 1) continue;

      const when = formatWhen(a.requestedAt);
      const body = `${a.tenant.name} (${a.branch.name}) дахь таны цаг ${when}-д товлогдсон байна.`;

      // Мэдэгдэл (DB + push, апп/веб) — зөвхөн онлайн захиалга (Account-той)
      // бол, SMS ИЛГЭЭХГҮЙ. dedupeKey-р давхар үүсэхээс хамгаална.
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
  }

  return NextResponse.json({
    ok: true,
    candidates,
    pushSent,
    ranAt: now.toISOString(),
  });
}
