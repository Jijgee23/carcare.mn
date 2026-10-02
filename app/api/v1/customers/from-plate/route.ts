import { jsonError, jsonOk, requireApiUser, requirePermission } from "@/lib/api";
import { requireActiveSubscriptionApi } from "@/lib/subscription-server";
import { CustomerCommandError } from "@/lib/customers/customer-commands";
import {
  CustomerFromPlateError,
  createCustomerFromPlate,
} from "@/lib/customers/customer-from-plate";

// Дугаараар эзэмшигчийг сервер талд шийдээд (tenant холбоос → HUR) үйлчлүүлэгч
// үүсгэнэ. Логик нь dashboard action-тай ижил `createCustomerFromPlate`.
export async function POST(req: Request) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;
  const denied = requirePermission(auth.user, "customers.create");
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
  const { plate } = body as Record<string, unknown>;
  if (typeof plate !== "string" || !plate.trim()) {
    return jsonError(422, "Хүсэлт буруу.", {
      fieldErrors: { plate: "Улсын дугаар шаардлагатай." },
    });
  }

  try {
    const result = await createCustomerFromPlate({ actor: auth.user, plate });
    return jsonOk(
      { customer: result.customer },
      { status: result.outcome === "created" ? 201 : 200 },
    );
  } catch (e) {
    if (e instanceof CustomerFromPlateError) {
      return jsonError(e.status, e.message, { code: e.code });
    }
    if (e instanceof CustomerCommandError) {
      if (e.fieldErrors) return jsonError(e.status, e.message, { fieldErrors: e.fieldErrors });
      return jsonError(e.status, e.message);
    }
    throw e;
  }
}
