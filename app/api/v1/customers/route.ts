import { Prisma } from "@/app/generated/prisma/client";
import { jsonError, jsonOk, requireApiUser, requirePermission } from "@/lib/api";
import { buildMeta, getApiPageInfo } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const { page, pageSize, skip, take } = getApiPageInfo(url.searchParams);

  const where: Prisma.CustomerWhereInput = { tenantId: auth.user.tenantId };
  if (q) {
    where.OR = [
      { fullName: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
      { email: { contains: q, mode: "insensitive" } },
    ];
  }

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { fullName: "asc" },
      skip,
      take,
      select: {
        id: true,
        fullName: true,
        phone: true,
        email: true,
        note: true,
        createdAt: true,
      },
    }),
    prisma.customer.count({ where }),
  ]);

  return jsonOk({ customers, pagination: buildMeta(total, page, pageSize) });
}

export async function POST(req: Request) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;
  const denied = requirePermission(auth.user, "customers.create");
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "JSON body шаардлагатай.");
  }
  if (!body || typeof body !== "object") {
    return jsonError(400, "Body буруу.");
  }
  const { fullName, phone, email, note } = body as Record<string, unknown>;

  const nameStr = typeof fullName === "string" ? fullName.trim() : "";
  const phoneStr = typeof phone === "string" ? phone.trim() : "";
  const emailStr = typeof email === "string" ? email.trim() : "";
  const noteStr = typeof note === "string" ? note.trim() : "";

  const fieldErrors: Record<string, string> = {};
  // Зөвхөн утас заавал. Овог нэр заавал биш.
  if (!phoneStr) fieldErrors.phone = "Утас шаардлагатай.";
  if (Object.keys(fieldErrors).length > 0) {
    return jsonError(422, "Хүсэлт буруу.", { fieldErrors });
  }

  const customer = await prisma.customer.create({
    data: {
      tenantId: auth.user.tenantId,
      fullName: nameStr,
      phone: phoneStr,
      email: emailStr || null,
      note: noteStr || null,
    },
    select: {
      id: true,
      fullName: true,
      phone: true,
      email: true,
      note: true,
      createdAt: true,
    },
  });

  return jsonOk({ customer }, { status: 201 });
}
