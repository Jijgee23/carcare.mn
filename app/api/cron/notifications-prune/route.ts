import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron-auth";
import { prisma } from "@/lib/prisma";
import { setBypassContext } from "@/lib/tenant-context";

/**
 * Хуучин мэдэгдлүүдийг DB-ээс устгана — унших/устгах хугацаагүй тул
 * Notification хүснэгт хязгааргүй өсөхөөс сэргийлнэ.
 *
 * Зөвхөн УНШСАН (readAt тавигдсан) бөгөөд RETENTION_DAYS-аас хуучин
 * мэдэгдлийг устгана. Уншаагүй мэдэгдлийг хэдий хугацаанд ч хөндөхгүй —
 * хэрэглэгч хараагүй мэдэгдлийг алдагдуулахгүй байх нь аюулгүй анхдагч.
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

// GET-ыг бас зөвшөөрөв (зарим cron service зөвхөн GET дэмждэг — secret нь
// GET-д ч Authorization header-ээр ирнэ, URL-ээр биш, S17-аас хойш).
export async function GET(req: Request) {
  return run(req);
}

const RETENTION_DAYS = 90;

async function run(req: Request) {
  const denied = verifyCronSecret(req);
  if (denied) return denied;
  // Бүх tenant/account дундуур bulk delete хийдэг cron тул RLS-г тойрч гарна.
  setBypassContext();

  const now = new Date();
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

  const deleted = await prisma.notification.deleteMany({
    where: {
      readAt: { not: null, lt: cutoff },
    },
  });

  return NextResponse.json({
    ok: true,
    deletedNotifications: deleted.count,
    retentionDays: RETENTION_DAYS,
    ranAt: now.toISOString(),
  });
}
