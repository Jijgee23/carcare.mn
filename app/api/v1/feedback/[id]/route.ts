// Contract — GET /api/v1/feedback/[id] (P7-B2)
//
// Auth: any authenticated user (D-176 — no permission code).
// Tenant-scoped: another tenant's ticket id returns 404, same as
// `GET /api/v1/employees/[id]`'s convention.
// 200: { feedback: FeedbackDto, messages: FeedbackMessageDto[] }
// Errors: 401, 404 (NOT_FOUND)
//
// No status route exists for staff (P7-B2 spec) — staff can never set
// `status` or author as ADMIN; see `POST /api/v1/feedback/[id]/replies`.

import { jsonError, jsonOk, requireApiUser } from "@/lib/api";
import { getStaffFeedbackWithThread, toFeedbackDto, toFeedbackMessageDto } from "@/lib/feedback-staff";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;
  const { id } = await ctx.params;

  const actor = { id: auth.user.id, tenantId: auth.user.tenantId };
  const feedback = await getStaffFeedbackWithThread(actor, id);
  if (!feedback) return jsonError(404, "Олдсонгүй.", { code: "NOT_FOUND" });

  const { messages, ...rest } = feedback;
  return jsonOk({
    feedback: toFeedbackDto(rest),
    messages: messages.map(toFeedbackMessageDto),
  });
}
