import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron-auth";
import { prisma } from "@/lib/prisma";
import { setBypassContext } from "@/lib/tenant-context";

/**
 * Хугацаа дууссан subscription-уудыг автоматаар EXPIRED болгоно.
 *
 * `endsAt <= now` бөгөөд статус нь TRIAL/ACTIVE байгаа бүх subscription-ыг
 * EXPIRED болгоно. Энэ тенант-уудын `plan`-ыг өөрчилдөггүй — өмнөх багц нь
 * harmless хэвээр үлдэх ба banner нь "хугацаа дууссан"-ыг харуулна.
 *
 * Мөн PENDING SubscriptionPayment-ийг 30 минутаас илүү уртассан үед CANCELLED
 * болгоно — QPay invoice бүр төгсөж байгааг тэмдэглэхэд хэрэгтэй.
 *
 * Cron шууд гадуурх (Vercel cron, QStash, cron-job.org) дуудна. Bearer secret
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

async function run(req: Request) {
  const denied = verifyCronSecret(req);
  if (denied) return denied;
  // Бүх tenant дундуур bulk update хийдэг cron тул RLS-г тойрч гарна.
  setBypassContext();

  const now = new Date();

  const [expiredSubs, expiredPayments] = await Promise.all([
    prisma.subscription.updateMany({
      where: {
        status: { in: ["TRIAL", "ACTIVE"] },
        endsAt: { lte: now },
      },
      data: { status: "EXPIRED" },
    }),
    prisma.subscriptionPayment.updateMany({
      where: {
        status: "PENDING",
        createdAt: { lte: new Date(now.getTime() - 30 * 60 * 1000) },
      },
      data: { status: "CANCELLED" },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    expiredSubscriptions: expiredSubs.count,
    cancelledPendingPayments: expiredPayments.count,
    ranAt: now.toISOString(),
  });
}
