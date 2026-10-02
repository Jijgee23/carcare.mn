// Дугаараар эзэмшигчийг СЕРВЕР талд шийдээд (tenant холбоос → HUR) бодит
// утсаар нь үйлчлүүлэгч үүсгэх нэг канон функц. Dashboard-ийн
// `quickCreateCustomerFromPlateAction` болон staff API
// `POST /api/v1/customers/from-plate` хоёул үүнийг дуудна (давхар логик байхгүй).
// Эрх/subscription шалгалт дуудагч талд үлдэнэ.

import { PublicUpstreamError } from "@/lib/action-errors";
import {
  type CreateCustomerCommandResult,
  createCustomerCommand,
} from "@/lib/customers/customer-commands";
import { resolveOwnerForPlate } from "@/lib/hur-lookup";
import { consumeRateLimit } from "@/lib/rate-limit";
import { normalizePlate } from "@/lib/vehicles";

export class CustomerFromPlateError extends Error {
  constructor(
    message: string,
    public readonly status: 404 | 429 | 502,
    public readonly code: "RATE_LIMITED" | "OWNER_NOT_FOUND" | "HUR_UPSTREAM",
  ) {
    super(message);
    this.name = "CustomerFromPlateError";
  }
}

export async function createCustomerFromPlate(input: {
  actor: { id: string; tenantId: string };
  plate: string;
  auditSummarySuffix?: string;
}): Promise<CreateCustomerCommandResult> {
  // Uncached HUR дуудалтаар утас цуглуулахаас сэргийлнэ — lookup route-тай ЯГ
  // ижил "hur:<userId>" bucket/хязгаар.
  if (!consumeRateLimit(`hur:${input.actor.id}`, { limit: 20, windowMs: 60_000 }).ok) {
    throw new CustomerFromPlateError(
      "Хэт олон хүсэлт илгээлээ. Түр хүлээгээд дахин оролдоно уу.",
      429,
      "RATE_LIMITED",
    );
  }
  let owner;
  try {
    owner = await resolveOwnerForPlate(input.actor.tenantId, normalizePlate(input.plate ?? ""));
  } catch (e) {
    if (e instanceof PublicUpstreamError) {
      throw new CustomerFromPlateError(e.message, 502, "HUR_UPSTREAM");
    }
    console.error("[customer-from-plate]", e);
    throw new CustomerFromPlateError("HUR алдаа гарлаа.", 502, "HUR_UPSTREAM");
  }
  if (!owner) {
    throw new CustomerFromPlateError("Эзэмшигчийн мэдээлэл олдсонгүй.", 404, "OWNER_NOT_FOUND");
  }
  return createCustomerCommand({
    actor: input.actor,
    data: { fullName: owner.fullName, phone: owner.phone },
    auditSummarySuffix: input.auditSummarySuffix,
  });
}
