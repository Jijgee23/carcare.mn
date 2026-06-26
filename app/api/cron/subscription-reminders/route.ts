import { NextResponse } from "next/server";
import { createNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { SUBSCRIPTION_WARN_DAYS, formatDaysLeft } from "@/lib/subscription";

/**
 * Удахгүй (SUBSCRIPTION_WARN_DAYS хоногийн дотор) дуусах TRIAL/ACTIVE багцуудад
 * сунгалтын сануулга илгээнэ — тенант бүрийн OWNER-уудад (тэд л төлбөр төлж
 * сунгана). Давхар илгээхгүйн тулд Subscription.reminderSentAt-аар тэмдэглэнэ.
 *
 * Cron гадуурх (crontab, cron-job.org) дуудна — `CRON_SECRET`-ээр хамгаална
 * (Bearer header эсвэл `?secret=`). Өдөрт нэг удаа ажиллуулахад тохиромжтой.
 */
export async function POST(req: Request) {
  return run(req);
}

export async function GET(req: Request) {
  return run(req);
}

const MAX_BATCH = 200;
const DAY_MS = 24 * 60 * 60 * 1000;

function formatDate(d: Date): string {
  return d.toLocaleDateString("mn-MN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
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
  const until = new Date(now.getTime() + SUBSCRIPTION_WARN_DAYS * DAY_MS);

  // Идэвхтэй/туршилтын, дуусах хугацаатай (endsAt != null), удахгүй дуусах гэж буй,
  // сануулга хараахан илгээгээгүй багцууд.
  const due = await prisma.subscription.findMany({
    where: {
      status: { in: ["TRIAL", "ACTIVE"] },
      reminderSentAt: null,
      endsAt: { gte: now, lte: until },
    },
    orderBy: { endsAt: "asc" },
    take: MAX_BATCH,
    select: {
      id: true,
      tenantId: true,
      endsAt: true,
      tenant: { select: { name: true } },
    },
  });

  let remindedSubs = 0;
  let notified = 0;
  for (const sub of due) {
    if (!sub.endsAt) continue;

    // Тухайн тенантын төлбөр төлж чадах эзэд (идэвхтэй).
    const owners = await prisma.user.findMany({
      where: { tenantId: sub.tenantId, isOwner: true, isActive: true },
      select: { id: true },
    });

    const daysLeft = Math.max(
      0,
      Math.ceil((sub.endsAt.getTime() - now.getTime()) / DAY_MS),
    );
    const body = `${sub.tenant.name}: багцын хугацаа ${formatDaysLeft(daysLeft)} (${formatDate(sub.endsAt)}). Тасралтгүй ажиллахын тулд сунгана уу.`;

    for (const owner of owners) {
      try {
        await createNotification({
          type: "subscription_expiring",
          recipient: { userId: owner.id },
          tenantId: sub.tenantId,
          input: { subscriptionId: sub.id, body },
        });
        notified++;
      } catch (e) {
        console.warn("[notify] subscription_expiring:", e);
      }
    }

    // Амжилт/амжилтгүйгээс үл хамаарч тэмдэглэж, дахин илгээхээс сэргийлнэ.
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { reminderSentAt: now },
    });
    remindedSubs++;
  }

  return NextResponse.json({
    ok: true,
    candidates: due.length,
    remindedSubscriptions: remindedSubs,
    ownersNotified: notified,
    ranAt: now.toISOString(),
  });
}
