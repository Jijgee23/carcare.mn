import { jsonError, jsonOk, requireApiUser, requirePermission } from "@/lib/api";
import { resolveWorkingBranch } from "@/lib/auth/api-branch";
import { SUBSCRIPTION_LOCKED_MESSAGE } from "@/lib/subscription";
import {
  AppointmentCommandError,
  STAFF_SCOPE_MESSAGES,
} from "@/lib/appointments/appointment-commands";
import {
  MAX_BULK_APPOINTMENT_IDS,
  bulkChangeAppointmentCategoryCommand,
} from "@/lib/appointments/appointment-bulk-commands";

type ParsedBulkCategoryBody =
  | { ok: true; appointmentIds: string[]; categoryId: string }
  | { ok: false; message: string; field: string };

function invalid(field: string, message: string): ParsedBulkCategoryBody {
  return { ok: false, field, message };
}

/**
 * Boundary parse for `{appointmentIds, categoryId}` — empty, non-string,
 * duplicate and oversized `appointmentIds` are rejected here, before any row
 * is touched. `categoryId` is a single id; the P2-B1 bulk command takes a
 * `categoryIds` array (an appointment can carry more than one category), so
 * this route wraps it as `[categoryId]` when calling the command.
 */
function parseBulkCategoryBody(body: unknown): ParsedBulkCategoryBody {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return invalid("body", "JSON object body шаардлагатай.");
  }
  const record = body as Record<string, unknown>;

  const rawIds = record.appointmentIds;
  if (!Array.isArray(rawIds)) {
    return invalid("appointmentIds", "appointmentIds нь string-ийн массив байна.");
  }
  if (rawIds.length === 0) {
    return invalid("appointmentIds", "Дор хаяж нэг цаг захиалга сонгоно уу.");
  }
  if (rawIds.length > MAX_BULK_APPOINTMENT_IDS) {
    return invalid(
      "appointmentIds",
      `Нэг хүсэлтэд хамгийн ихдээ ${MAX_BULK_APPOINTMENT_IDS} цаг захиалга сонгоно уу.`,
    );
  }
  const appointmentIds: string[] = [];
  const seen = new Set<string>();
  for (const raw of rawIds) {
    if (typeof raw !== "string" || !raw.trim()) {
      return invalid("appointmentIds", "appointmentIds бүр хоосон биш string байх ёстой.");
    }
    const appointmentId = raw.trim();
    if (seen.has(appointmentId)) {
      return invalid("appointmentIds", "Нэг цаг захиалгыг давхар сонгож болохгүй.");
    }
    seen.add(appointmentId);
    appointmentIds.push(appointmentId);
  }

  if (typeof record.categoryId !== "string" || !record.categoryId.trim()) {
    return invalid("categoryId", "categoryId шаардлагатай.");
  }

  return { ok: true, appointmentIds, categoryId: record.categoryId.trim() };
}

/**
 * `assertStaffScope`/`assertActiveSubscription` inside the P2-B1 command
 * throw a plain `Error` for permission/branch/subscription rejection (not
 * `AppointmentCommandError`) — mirrors `knownAuthorizationMessage` handling
 * in `app/_actions/appointments.ts` for the same command, same pattern as
 * the sibling lifecycle routes.
 */
function commandErrorResponse(error: unknown) {
  if (error instanceof AppointmentCommandError) {
    return jsonError(error.status, error.message, {
      code: error.code,
      ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}),
    });
  }
  if (error instanceof Error && (STAFF_SCOPE_MESSAGES as readonly string[]).includes(error.message)) {
    return jsonError(403, error.message);
  }
  if (error instanceof Error && error.message === SUBSCRIPTION_LOCKED_MESSAGE) {
    return jsonError(403, error.message, { code: "SUBSCRIPTION_EXPIRED" });
  }
  console.error("[appointments/bulk/category]", error instanceof Error ? error.name : "UnknownError");
  return jsonError(500, "Серверийн алдаа гарлаа. Дахин оролдоно уу.");
}

/**
 * POST /api/v1/appointments/bulk/category
 * Body: { appointmentIds: string[], categoryId: string }
 * Permission: appointments.edit
 *
 * Thin adapter over the P2-B1 `bulkChangeAppointmentCategoryCommand` — each
 * target appointment is locked and scope/tenant-checked independently inside
 * `changeAppointmentCategoryCommand`, so one row's rejection (wrong tenant,
 * out-of-branch, linked order, unknown category) never aborts the batch.
 * Response shape mirrors `POST /orders/bulk/status`'s
 * `{succeeded, failed:[{id, code, message}]}` so mobile binds one bulk shape.
 */
export async function POST(req: Request) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;
  const denied = requirePermission(auth.user, "appointments.edit");
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "JSON body шаардлагатай.", { code: "INVALID_BULK_REQUEST" });
  }
  const parsed = parseBulkCategoryBody(body);
  if (!parsed.ok) {
    return jsonError(400, parsed.message, {
      code: "INVALID_BULK_REQUEST",
      field: parsed.field,
    });
  }

  const scopeResult = await resolveWorkingBranch(req, auth.user);
  if (scopeResult.response) return scopeResult.response;

  try {
    const result = await bulkChangeAppointmentCategoryCommand({
      actor: { ...auth.user, workingBranchId: scopeResult.branchId ?? undefined },
      appointmentIds: parsed.appointmentIds,
      categoryIds: [parsed.categoryId],
    });
    return jsonOk(result);
  } catch (error) {
    return commandErrorResponse(error);
  }
}
