import { jsonError, jsonOk, requireApiUser, requirePermission } from "@/lib/api";
import {
  DiagnosticTemplateCommandError,
  deleteTemplateCommand,
  updateTemplateCommand,
} from "@/lib/diagnostics-templates-server";
import { tenantVisibleTemplateWhere } from "@/lib/diagnostics";
import { prisma } from "@/lib/prisma";
import { requireActiveSubscriptionApi } from "@/lib/subscription-server";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;
  const denied = requirePermission(auth.user, "diagnostics.view");
  if (denied) return denied;

  const { id } = await ctx.params;
  const template = await prisma.diagnosticTemplate.findFirst({
    where: { AND: [{ id }, tenantVisibleTemplateWhere(auth.user.tenantId)] },
    select: {
      id: true,
      name: true,
      description: true,
      type: true,
      version: true,
      isActive: true,
      price: true,
      durationMin: true,
      schema: true,
      updatedAt: true,
    },
  });
  if (!template) return jsonError(404, "Загвар олдсонгүй.");

  return jsonOk({ template });
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

// PATCH /api/v1/diagnostics/templates/[id] — permission: diagnostics.edit
// Whole-record replace, matching the other mobile PATCH endpoints. Rejects
// `isSystemDefault` templates and bumps `version` only when the schema
// actually changed and the template already has reports — all enforced
// inside `updateTemplateCommand`, not re-implemented here.
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;
  const denied = requirePermission(auth.user, "diagnostics.edit");
  if (denied) return denied;
  const locked = await requireActiveSubscriptionApi(auth.user);
  if (locked) return locked;

  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "JSON body шаардлагатай.");
  }
  if (!body || typeof body !== "object") return jsonError(400, "Body буруу.");

  const { name, description, type, isActive, schema, price, durationMin, categoryId } =
    body as Record<string, unknown>;

  let updated;
  try {
    updated = await updateTemplateCommand({
      actor: auth.user,
      templateId: id,
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

  return jsonOk({ template: updated });
}

// DELETE /api/v1/diagnostics/templates/[id] — permission: diagnostics.delete
// Delegates to `deleteTemplateCommand`, which archives (`isActive:false`)
// rather than hard-deleting when the template has report history, and
// rejects `isSystemDefault` templates outright.
export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;
  const denied = requirePermission(auth.user, "diagnostics.delete");
  if (denied) return denied;
  const locked = await requireActiveSubscriptionApi(auth.user);
  if (locked) return locked;

  const { id } = await ctx.params;

  let result;
  try {
    result = await deleteTemplateCommand({ actor: auth.user, templateId: id });
  } catch (e) {
    return commandErrorResponse(e);
  }

  return jsonOk({ template: result });
}
