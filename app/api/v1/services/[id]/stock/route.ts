// P4-B1 — Directional stock adjustment for a GOODS service. Thin adapter
// over `adjustServiceStockCommand` (`lib/services/service-commands.ts`) —
// this route does not implement the GOODS-only check, the directional
// in/out math or the negative-balance rejection itself; see that module for
// all three.

import { jsonError, jsonOk, requireApiUser, requirePermission } from "@/lib/api";
import { requireActiveSubscriptionApi } from "@/lib/subscription-server";
import {
  ServiceCommandError,
  adjustServiceStockCommand,
} from "@/lib/services/service-commands";

// POST /api/v1/services/[id]/stock — permission: services.edit
// Body: `{ direction: "in" | "out", amount: number | string }`. This is a
// DIRECTIONAL adjustment, never an absolute overwrite — the client never
// sends a target stock value, only how much to add or subtract. A resulting
// negative balance is a 422 field error on `amount`, not clamped to zero.
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;
  const denied = requirePermission(auth.user, "services.edit");
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

  const { direction, amount } = body as Record<string, unknown>;

  let result;
  try {
    result = await adjustServiceStockCommand({
      actor: auth.user,
      serviceId: id,
      data: {
        direction: typeof direction === "string" ? direction : "",
        amount: typeof amount === "string" || typeof amount === "number" ? amount : null,
      },
    });
  } catch (e) {
    if (e instanceof ServiceCommandError) {
      return jsonError(
        e.status,
        e.message,
        e.fieldErrors ? { code: e.code, fieldErrors: e.fieldErrors } : { code: e.code },
      );
    }
    throw e;
  }

  return jsonOk({ service: { id: result.id, stock: result.stock.toString() } });
}
