import { Prisma } from "@/app/generated/prisma/client";
import { jsonOk, requireApiUser } from "@/lib/api";
import {
  DIAGNOSTIC_TYPES,
  type DiagnosticType,
} from "@/lib/diagnostics";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;

  const url = new URL(req.url);
  const type = url.searchParams.get("type")?.trim();
  const includeInactive =
    url.searchParams.get("includeInactive") === "true";

  const where: Prisma.DiagnosticTemplateWhereInput = {
    tenantId: auth.user.tenantId,
  };
  if (!includeInactive) where.isActive = true;
  if (type && DIAGNOSTIC_TYPES.includes(type as DiagnosticType)) {
    where.type = type as DiagnosticType;
  }

  const templates = await prisma.diagnosticTemplate.findMany({
    where,
    orderBy: [{ type: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      type: true,
      version: true,
      isActive: true,
      updatedAt: true,
    },
  });

  return jsonOk({ templates });
}
