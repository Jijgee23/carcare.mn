import { jsonError, jsonOk, requireApiUser, requirePermission } from "@/lib/api";
import {
  DiagnosticTemplateCommandError,
  duplicateTemplateCommand,
} from "@/lib/diagnostics-templates-server";
import { requireActiveSubscriptionApi } from "@/lib/subscription-server";

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

// POST /api/v1/diagnostics/templates/[id]/duplicate — permission: diagnostics.create
// Sources from the tenant's own template OR a system-admin-granted shared
// template (`tenantVisibleTemplateWhere`), but always writes a tenant-owned
// copy with `version: 1`. Enforces the same `ENABLE_DIAGNOSTICS`/
// `MAX_DIAGNOSTIC_TEMPLATES` gates as create — see
// `duplicateTemplateCommand`'s doc comment for why this is a deliberate
// correction over `duplicateTemplateAction`'s current (ungated) behaviour.
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;
  const denied = requirePermission(auth.user, "diagnostics.create");
  if (denied) return denied;
  const locked = await requireActiveSubscriptionApi(auth.user);
  if (locked) return locked;

  const { id } = await ctx.params;

  let copy;
  try {
    copy = await duplicateTemplateCommand({ actor: auth.user, templateId: id });
  } catch (e) {
    return commandErrorResponse(e);
  }

  return jsonOk({ template: copy });
}
