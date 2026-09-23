// P3-B7 — Customer broadcast staff API. Thin adapter over
// `lib/customers/customer-broadcast.ts` — no limit/audit/send logic is
// re-implemented here, mirroring the house convention in
// `app/api/v1/customers/[id]/route.ts` and `app/api/v1/customers/route.ts`.
//
// Path frozen for this slice: ONE route, two verbs, matching the existing
// `/api/v1/customers` collection convention (GET lists, POST creates) rather
// than adding a second endpoint for the count. `GET /api/v1/customers/notify`
// returns the recipient preview (count only — no message has been composed
// yet, so there is nothing to send); `POST /api/v1/customers/notify` sends.
// A separate `/api/v1/customers/notify/count` endpoint was considered and
// rejected: the count is cheap, has no side effects, and belongs under the
// same permission gate as the send, so splitting it into its own resource
// would only add a second route to keep in sync with this one.

import { jsonError, jsonOk, requireApiUser, requirePermission } from "@/lib/api";
import { requireActiveSubscriptionApi } from "@/lib/subscription-server";
import {
  CustomerBroadcastError,
  countBroadcastRecipients,
  sendCustomerBroadcast,
} from "@/lib/customers/customer-broadcast";

// GET /api/v1/customers/notify
// Permission: customers.notify + active subscription
// Recipient preview only — counts account-linked customers in the actor's
// tenant. `accountId: null` (walk-in) customers are never recipients and are
// never counted (Security and correctness invariants, TENANT_MOBILE_SLICES.md).
export async function GET(req: Request) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;
  const denied = requirePermission(auth.user, "customers.notify");
  if (denied) return denied;
  const locked = await requireActiveSubscriptionApi(auth.user);
  if (locked) return locked;

  const recipientCount = await countBroadcastRecipients(auth.user);
  return jsonOk({ recipientCount });
}

// POST /api/v1/customers/notify
// Permission: customers.notify + active subscription
// Delegates entirely to `sendCustomerBroadcast` — this route does not
// re-implement the daily-limit check, the send, or the audit write.
export async function POST(req: Request) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;
  const denied = requirePermission(auth.user, "customers.notify");
  if (denied) return denied;
  const locked = await requireActiveSubscriptionApi(auth.user);
  if (locked) return locked;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "JSON body шаардлагатай.");
  }
  if (!body || typeof body !== "object") {
    return jsonError(400, "Body буруу.");
  }
  const { title, body: messageBody } = body as Record<string, unknown>;

  const fieldErrors: Record<string, string> = {};
  const titleValue = typeof title === "string" ? title.trim() : "";
  const bodyValue = typeof messageBody === "string" ? messageBody.trim() : "";
  if (!titleValue) fieldErrors.title = "Гарчиг оруулна уу.";
  if (!bodyValue) fieldErrors.body = "Агуулга оруулна уу.";
  if (Object.keys(fieldErrors).length > 0) {
    return jsonError(422, "Хүсэлт буруу.", { fieldErrors });
  }

  try {
    const result = await sendCustomerBroadcast({
      actor: auth.user,
      data: { title: titleValue, body: bodyValue },
    });
    return jsonOk({ notified: result.notified });
  } catch (e) {
    if (e instanceof CustomerBroadcastError) {
      return jsonError(e.status, e.message, { code: e.code });
    }
    throw e;
  }
}
