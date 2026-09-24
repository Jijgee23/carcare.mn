// Contract — POST /api/v1/feedback/[id]/replies (P7-B2)
//
// Auth: any authenticated user (D-176 — no permission code).
// Author is ALWAYS "SUBMITTER" — the client can never set `authorType` or
// `status`; those fields are not even read from the body. Tenant-scoped
// (another tenant's id -> "Олдсонгүй.", same wording as the web action).
// Replying to a RESOLVED/DISMISSED ticket reopens it to IN_REVIEW, mirroring
// `app/_actions/feedback.ts`'s `addSubmitterFeedbackReply`.
//
// Body: { message: string } (2-2000 chars after trim).
// 201: { message: FeedbackMessageDto, reopened: boolean }
// Errors: 400 (bad JSON), 401, 404 (NOT_FOUND), 422 (VALIDATION)

import { jsonError, jsonOk, requireApiUser } from "@/lib/api";
import { addStaffFeedbackReply, toFeedbackMessageDto } from "@/lib/feedback-staff";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;
  const { id } = await ctx.params;

  let body: { message?: unknown };
  try {
    body = (await req.json()) as { message?: unknown };
  } catch {
    return jsonError(400, "JSON body шаардлагатай.", { code: "VALIDATION" });
  }
  const message = typeof body?.message === "string" ? body.message : "";

  const actor = { id: auth.user.id, tenantId: auth.user.tenantId };
  const result = await addStaffFeedbackReply(actor, id, message);
  if (!result.ok) {
    const code = result.code ?? "VALIDATION";
    return jsonError(code === "NOT_FOUND" ? 404 : 422, result.message, { code });
  }

  return jsonOk(
    { message: toFeedbackMessageDto(result.data.feedbackMessage), reopened: result.data.reopened },
    { status: 201 },
  );
}
