import { jsonError, jsonOk } from "@/lib/api";
import { getApiAccountFromRequest } from "@/lib/auth/account-api-token";
import { toAccountNotificationItem } from "@/lib/notifications";
import { buildMeta, getApiPageInfo } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";

// Мобайл нэг хуудсыг л уншиж, доошоо гүйлгэхдээ нэмж ачаалдаггүй (уншсан
// мэдэгдлийг cron 90 хоногийн дараа цэвэрлэдэг тул жагсаалт богино байна).
// `pagination` хариуд үлддэг — хожим infinite scroll нэмэхэд шинэ талбар
// шаардахгүй.
const PAGE_SIZE_DEFAULT = 50;

// GET /api/v1/app/notifications — нэвтэрсэн Account-ийн мэдэгдлүүд, шинэ нь эхэнд.
export async function GET(req: Request) {
  const account = await getApiAccountFromRequest(req);
  if (!account) return jsonError(401, "Нэвтрэх шаардлагатай.");

  const { searchParams } = new URL(req.url);
  const { page, pageSize, skip, take } = getApiPageInfo(searchParams, {
    defaultSize: PAGE_SIZE_DEFAULT,
    maxSize: 100,
  });

  // Account нь tenant-гүй глобал объект тул `getApiAccountFromRequest` bypass
  // context тавьдаг: эзэмшлийн цорын ганц хамгаалалт нь энэ `accountId` шүүлт.
  // Ажилтны (`userId`) болон super admin-ы мөрүүд ижил хүснэгтэд байдаг.
  const where = { accountId: account.id };

  const [rows, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        data: true,
        readAt: true,
        createdAt: true,
      },
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { ...where, readAt: null } }),
  ]);

  return jsonOk({
    notifications: rows.map(toAccountNotificationItem),
    pagination: buildMeta(total, page, pageSize),
    // Хуудаслалттай үед жагсаалтаас тоолж болохгүй тул сервер талаас — апп
    // энэ утгаар хонхны badge-ээ харуулна.
    unreadCount,
  });
}
