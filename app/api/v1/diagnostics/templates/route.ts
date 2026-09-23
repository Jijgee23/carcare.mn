import { Prisma } from "@/app/generated/prisma/client";
import { jsonError, jsonOk, requireApiUser, requirePermission } from "@/lib/api";
import {
  DIAGNOSTIC_TYPES,
  tenantVisibleTemplateWhere,
  type DiagnosticType,
} from "@/lib/diagnostics";
import {
  DiagnosticTemplateCommandError,
  createTemplateCommand,
} from "@/lib/diagnostics-templates-server";
import { buildMeta, getApiPageInfo } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { requireActiveSubscriptionApi } from "@/lib/subscription-server";

export async function GET(req: Request) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;
  const denied = requirePermission(auth.user, "diagnostics.view");
  if (denied) return denied;

  const url = new URL(req.url);
  const type = url.searchParams.get("type")?.trim();
  const q = url.searchParams.get("q")?.trim();
  const includeInactive =
    url.searchParams.get("includeInactive") === "true";
  const { page, pageSize, skip, take } = getApiPageInfo(url.searchParams);

  // AND-ээр нэгтгэнэ — тухайн тенантад харагдах загварын OR нөхцөл (өөрийнх
  // эсвэл систем admin-аас олгосон) хайлтын `q`-ийн OR-той мөргөлдөхгүй.
  const and: Prisma.DiagnosticTemplateWhereInput[] = [
    tenantVisibleTemplateWhere(auth.user.tenantId),
  ];
  if (!includeInactive) and.push({ isActive: true });
  if (type && DIAGNOSTIC_TYPES.includes(type as DiagnosticType)) {
    and.push({ type: type as DiagnosticType });
  }
  if (q) {
    and.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ],
    });
  }
  const where: Prisma.DiagnosticTemplateWhereInput = { AND: and };

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

function commandErrorResponse(error: unknown) {
  if (error instanceof DiagnosticTemplateCommandError) {
    return jsonError(
      error.status,
      error.message,
      error.fieldErrors ? { code: error.code, fieldErrors: error.fieldErrors } : { code: error.code },
    );
  }
  throw error;
}

// POST /api/v1/diagnostics/templates — permission: diagnostics.create
// Delegates entirely to `createTemplateCommand`, which enforces the
// `ENABLE_DIAGNOSTICS` feature flag, the `MAX_DIAGNOSTIC_TEMPLATES` count
// limit, category tenant-ownership, and schema validation — this route does
// not re-implement any of that.
export async function POST(req: Request) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;
  const denied = requirePermission(auth.user, "diagnostics.create");
  if (denied) return denied;
  const locked = await requireActiveSubscriptionApi(auth.user);
  if (locked) return locked;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "JSON body шаардлагатай.");
  }
  if (!body || typeof body !== "object") return jsonError(400, "Body буруу.");

  const { name, description, type, isActive, schema, price, durationMin, categoryId } =
    body as Record<string, unknown>;

  let created;
  try {
    created = await createTemplateCommand({
      actor: auth.user,
      data: {
        name: typeof name === "string" ? name : "",
        description: typeof description === "string" ? description : null,
        type: typeof type === "string" ? type : "",
        isActive: typeof isActive === "boolean" ? isActive : false,
        schema,
        price: typeof price === "string" || typeof price === "number" ? price : null,
        durationMin:
          typeof durationMin === "string" || typeof durationMin === "number" ? durationMin : null,
        categoryId: typeof categoryId === "string" ? categoryId : null,
      },
    });
  } catch (e) {
    return commandErrorResponse(e);
  }

  return jsonOk({ template: created });
}
