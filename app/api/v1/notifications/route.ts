import { jsonOk, requireApiUser } from "@/lib/api";
import { getApiPageInfo, buildMeta } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE_DEFAULT = 20;

export async function GET(req: Request) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;

  const url = new URL(req.url);
  const { page, pageSize, skip, take } = getApiPageInfo(url.searchParams, {
    defaultSize: PAGE_SIZE_DEFAULT,
    maxSize: 50,
  });

  const where = { userId: auth.user.id };

  const [notifications, total, unreadCount] = await Promise.all([
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
    prisma.notification.count({ where: { userId: auth.user.id, readAt: null } }),
  ]);

  return jsonOk({
    notifications,
    pagination: buildMeta(total, page, pageSize),
    unreadCount,
  });
}
