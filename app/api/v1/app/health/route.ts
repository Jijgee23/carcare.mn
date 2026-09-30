/**
 * GET /api/v1/app/health — customer app-ийн сүлжээний шалгалт (reachability
 * probe). Нийтэд нээлттэй, DB-д хандахгүй, rate limit-гүй: утас "онлайн"
 * гэж мэдээлэхэд апп энэ endpoint-оос JSON хариу авсан тохиолдолд л манай
 * серверт хүрч чадна гэж үзнэ (captive portal-ийн HTML хариуг ялгана).
 * Зориуд `lib/api`/`lib/prisma` импортлохгүй — DB унасан ч сүлжээ байгаа
 * эсэхийг зөв хэлэх ёстой.
 */
export function GET() {
  return Response.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
