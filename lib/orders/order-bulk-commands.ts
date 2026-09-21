import {
  assignOrderCommand,
  changeOrderStatusCommand,
  OrderCommandError,
  parseCommandDuration,
  type OrderCommandActor,
  type OrderCommandScope,
} from "@/lib/orders/order-commands";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/orders";

export const MAX_BULK_ORDER_IDS = 100;

export type BulkOrderFailure = {
  orderId: string;
  code: string;
  message: string;
};

export type BulkOrderResult = {
  succeeded: string[];
  failed: BulkOrderFailure[];
};

export type BulkRequestError = {
  field: string;
  message: string;
};

export type ParsedBulkOrderIds =
  | { ok: true; orderIds: string[] }
  | { ok: false; error: BulkRequestError };

export type ParsedBulkStatus =
  | {
      ok: true;
      orderIds: string[];
      status: OrderStatus;
      durationMinutes?: number | null;
    }
  | { ok: false; error: BulkRequestError };

export type ParsedBulkAssignment =
  | { ok: true; orderIds: string[]; assignedToId: string | null }
  | { ok: false; error: BulkRequestError };

type BulkCommandDependencies = {
  changeOrderStatusCommand?: (
    input: Parameters<typeof changeOrderStatusCommand>[0],
  ) => Promise<unknown>;
  assignOrderCommand?: (
    input: Parameters<typeof assignOrderCommand>[0],
  ) => Promise<unknown>;
};

function invalid(field: string, message: string): { ok: false; error: BulkRequestError } {
  return { ok: false, error: { field, message } };
}

export function parseBulkOrderIds(value: unknown): ParsedBulkOrderIds {
  if (!Array.isArray(value)) {
    return invalid("orderIds", "orderIds нь string-ийн массив байна.");
  }
  if (value.length === 0) {
    return invalid("orderIds", "Дор хаяж нэг захиалга сонгоно уу.");
  }
  if (value.length > MAX_BULK_ORDER_IDS) {
    return invalid("orderIds", `Нэг хүсэлтэд хамгийн ихдээ ${MAX_BULK_ORDER_IDS} захиалга сонгоно уу.`);
  }

  const orderIds: string[] = [];
  const seen = new Set<string>();
  for (const valueItem of value) {
    if (typeof valueItem !== "string" || !valueItem.trim()) {
      return invalid("orderIds", "orderIds бүр хоосон биш string байх ёстой.");
    }
    const orderId = valueItem.trim();
    if (seen.has(orderId)) {
      return invalid("orderIds", "Нэг захиалгыг давхар сонгож болохгүй.");
    }
    seen.add(orderId);
    orderIds.push(orderId);
  }
  return { ok: true, orderIds };
}

export function parseBulkStatusBody(body: unknown): ParsedBulkStatus {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return invalid("body", "JSON object body шаардлагатай.");
  }
  const record = body as Record<string, unknown>;
  const ids = parseBulkOrderIds(record.orderIds);
  if (!ids.ok) return ids;
  if (typeof record.status !== "string" || !(ORDER_STATUSES as readonly string[]).includes(record.status)) {
    return invalid("status", "Статус буруу байна.");
  }

  let durationMinutes: number | null | undefined;
  if (Object.prototype.hasOwnProperty.call(record, "durationMinutes")) {
    if (record.durationMinutes !== null && typeof record.durationMinutes !== "number") {
      return invalid("durationMinutes", "durationMinutes нь бүхэл тоо эсвэл null байна.");
    }
    if (typeof record.durationMinutes === "number") {
      const parsed = parseCommandDuration(record.durationMinutes);
      if (!parsed.ok) return invalid("durationMinutes", parsed.error);
      durationMinutes = parsed.minutes;
    } else {
      durationMinutes = null;
    }
  }

  return {
    ok: true,
    orderIds: ids.orderIds,
    status: record.status as OrderStatus,
    ...(Object.prototype.hasOwnProperty.call(record, "durationMinutes")
      ? { durationMinutes }
      : {}),
  };
}

export function parseBulkAssignmentBody(body: unknown): ParsedBulkAssignment {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return invalid("body", "JSON object body шаардлагатай.");
  }
  const record = body as Record<string, unknown>;
  const ids = parseBulkOrderIds(record.orderIds);
  if (!ids.ok) return ids;
  if (!Object.prototype.hasOwnProperty.call(record, "assignedToId")) {
    return invalid("assignedToId", "assignedToId нь заавал байна.");
  }
  if (record.assignedToId !== null && typeof record.assignedToId !== "string") {
    return invalid("assignedToId", "assignedToId нь string эсвэл null байна.");
  }
  if (typeof record.assignedToId === "string" && !record.assignedToId.trim()) {
    return invalid("assignedToId", "assignedToId хоосон байж болохгүй.");
  }
  return {
    ok: true,
    orderIds: ids.orderIds,
    assignedToId: typeof record.assignedToId === "string" ? record.assignedToId.trim() : null,
  };
}

function failureFor(orderId: string, error: unknown): BulkOrderFailure {
  if (error instanceof OrderCommandError) {
    return { orderId, code: error.code, message: error.message };
  }
  return {
    orderId,
    code: "INTERNAL_ERROR",
    message: "Серверийн алдаа гарлаа. Дахин оролдоно уу.",
  };
}

export async function runBulkOrderCommands(
  orderIds: readonly string[],
  execute: (orderId: string) => Promise<unknown>,
): Promise<BulkOrderResult> {
  const succeeded: string[] = [];
  const failed: BulkOrderFailure[] = [];
  // Serial execution is intentional: each command owns its own row lock and
  // independent failure must not abort the remaining batch.
  for (const orderId of orderIds) {
    try {
      await execute(orderId);
      succeeded.push(orderId);
    } catch (error) {
      failed.push(failureFor(orderId, error));
    }
  }
  return { succeeded, failed };
}

export function bulkChangeOrderStatusCommand(input: {
  actor: OrderCommandActor;
  orderIds: readonly string[];
  nextStatus: OrderStatus;
  durationMinutes?: number | null;
  scope?: OrderCommandScope;
}, dependencies: BulkCommandDependencies = {}): Promise<BulkOrderResult> {
  const executeStatus = dependencies.changeOrderStatusCommand ?? changeOrderStatusCommand;
  return runBulkOrderCommands(input.orderIds, (orderId) =>
    executeStatus({
      actor: input.actor,
      orderId,
      nextStatus: input.nextStatus,
      durationMinutes: input.durationMinutes,
      scope: input.scope,
    }),
  );
}

export function bulkAssignOrderCommand(input: {
  actor: OrderCommandActor;
  orderIds: readonly string[];
  assignedToId: string | null;
  scope?: OrderCommandScope;
}, dependencies: BulkCommandDependencies = {}): Promise<BulkOrderResult> {
  const executeAssignment = dependencies.assignOrderCommand ?? assignOrderCommand;
  return runBulkOrderCommands(input.orderIds, (orderId) =>
    executeAssignment({
      actor: input.actor,
      orderId,
      assignedToId: input.assignedToId,
      scope: input.scope,
    }),
  );
}
