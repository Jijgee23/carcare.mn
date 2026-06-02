import { Prisma } from "@/app/generated/prisma/client";
import { jsonOk, requireApiUser } from "@/lib/api";
import {
  DIAGNOSTIC_TYPES,
  type DiagnosticType,
} from "@/lib/diagnostics";
import { buildMeta, getApiPageInfo } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;

  const url = new URL(req.url);
  const type = url.searchParams.get("type")?.trim();
  const q = url.searchParams.get("q")?.trim();
  const includeInactive =
    url.searchParams.get("includeInactive") === "true";
  const { page, pageSize, skip, take } = getApiPageInfo(url.searchParams);

  const where: Prisma.DiagnosticTemplateWhereInput = {
    tenantId: auth.user.tenantId,
  };
  if (!includeInactive) where.isActive = true;
  if (type && DIAGNOSTIC_TYPES.includes(type as DiagnosticType)) {
    where.type = type as DiagnosticType;
  }
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
    ];
  }

  const [templates, total] = await Promise.all([
    prisma.diagnosticTemplate.findMany({
      where,
      orderBy: [{ type: "asc" }, { name: "asc" }],
      skip,
      take,
      select: {
        id: true,
        name: true,
        description: true,
        type: true,
        version: true,
        isActive: true,
        price: true,
        durationMin: true,
        updatedAt: true,
      },
    }),
    prisma.diagnosticTemplate.count({ where }),
  ]);

  return jsonOk({ templates, pagination: buildMeta(total, page, pageSize) });
}
