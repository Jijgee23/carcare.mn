import { NextResponse } from "next/server";
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

// GET-ыг бас зөвшөөрөв (зарим cron service зөвхөн GET дэмждэг — гэхдээ
// secret-ыг URL-ээр шалгах сонголт нэмж байна).
export async function GET(req: Request) {
  return run(req);
}

const RETENTION_DAYS = 90;

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
