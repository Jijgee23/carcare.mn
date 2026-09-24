// Contract — GET/POST /api/v1/feedback (P7-B2)
//
// GET /api/v1/feedback
//   Auth: any authenticated user (no permission code — D-176: feedback is
//     auth-only, matching the web dashboard's `requireUser()`-only gate,
//     same parity note as reports/P7-B0).
//   Query: page?, pageSize?/limit? (standard `parsePagination`; unknown
//     params rejected with 422 `{error, code: "VALIDATION", fieldErrors}`).
//   Lists the caller's own tenant's tickets only, newest first.
//   200: { feedback: FeedbackDto[], pagination: PaginationMeta }
//   Errors: 401 (no code), 422 (VALIDATION)
//
// POST /api/v1/feedback
//   Auth: any authenticated user.
//   Body: multipart/form-data — type (BUG/SUGGESTION/OTHER), message
//     (5-2000 chars), screenshot? (optional file, same limits as
//     `lib/storage.ts`'s other upload paths: 2MB, PNG/JPG/WEBP).
//   201: { feedback: FeedbackDto }
//   Errors: 400 (bad multipart), 401, 422 (VALIDATION)
//
// Both routes delegate to `lib/feedback-staff.ts` (P7-B2), the same core the
// web dashboard's `submitStaffFeedback` action calls — no forked validation,
// tenant scoping, or storage logic here.

import { jsonError, jsonOk, requireApiUser } from "@/lib/api";
import { createStaffFeedback, listStaffFeedback, toFeedbackDto } from "@/lib/feedback-staff";
import { parsePagination, rejectUnknownParams } from "@/lib/list-query-params";
import { buildMeta } from "@/lib/pagination";

const ALLOWED_PARAMS = ["page", "pageSize", "limit"] as const;

export async function GET(req: Request) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;

  const { searchParams } = new URL(req.url);

  const unknown = rejectUnknownParams(searchParams, ALLOWED_PARAMS);
  if (unknown) {
    return jsonError(422, unknown.message, {
      code: "VALIDATION",
      fieldErrors: { [unknown.field]: unknown.message },
    });
  }

  const paged = parsePagination(searchParams);
  if (typeof paged !== "object" || !("page" in paged)) {
    const err = paged as { field: string; message: string };
    return jsonError(422, err.message, { code: "VALIDATION", fieldErrors: { [err.field]: err.message } });
  }
  const { page, pageSize, skip, take } = paged;

  const actor = { id: auth.user.id, tenantId: auth.user.tenantId };
  const { items, total } = await listStaffFeedback(actor, { skip, take });

  return jsonOk({
    feedback: items.map(toFeedbackDto),
    pagination: buildMeta(total, page, pageSize),
  });
}

export async function POST(req: Request) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return jsonError(400, "Multipart form-data илгээнэ үү.");
  }

  const actor = { id: auth.user.id, tenantId: auth.user.tenantId };
  const result = await createStaffFeedback(actor, formData);
  if (!result.ok) {
    return jsonError(422, result.message, { code: "VALIDATION" });
  }

  return jsonOk({ feedback: toFeedbackDto(result.data.feedback) }, { status: 201 });
}
