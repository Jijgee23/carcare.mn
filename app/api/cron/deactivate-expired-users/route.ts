import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron-auth";
import { prisma } from "@/lib/prisma";
import { setBypassContext } from "@/lib/tenant-context";

/**
 * Хугацаа нь дууссан ажилтнуудыг (`activeUntil <= now`) `isActive=false`
 * болгож тэмдэглэнэ. Login + requireUser хоёр өөрсдөө `activeUntil`-г шалгадаг
 * тул энэ нь ямар ч цаг үзүүлэлт дутуу тохиолдолд ч жинхэнэ хамгаалалт биш —
 * зөвхөн жагсаалт/шүүлтэд (`isActive` талбар дээр найддаг) тогтвортой статус
 * харуулахын тулд (харах: lib/auth/active.ts-ийн checkUserActive).
 *
 * Cron шууд гадуурх (systemcron) дуудна. Bearer secret шалгаж нэвтрэхгүй бол 401.
 */
export async function POST(req: Request) {
  return run(req);
}

// GET-ыг бас зөвшөөрөв (зарим cron service зөвхөн GET дэмждэг — secret нь
// GET-д ч Authorization header-ээр ирнэ, URL-ээр биш).
export async function GET(req: Request) {
  return run(req);
}

async function run(req: Request) {
  const denied = verifyCronSecret(req);
  if (denied) return denied;
  // Бүх tenant дундуур bulk update хийдэг cron тул RLS-г тойрч гарна.
  setBypassContext();

  const now = new Date();
  const result = await prisma.user.updateMany({
    where: {
      isActive: true,
      activeUntil: { not: null, lte: now },
    },
    data: { isActive: false },
  });

  return NextResponse.json({
    ok: true,
    deactivatedUsers: result.count,
    ranAt: now.toISOString(),
  });
}
