import type { Prisma } from "@/app/generated/prisma/client";

/**
 * Allocate the next human-facing order number while holding the tenant row
 * lock for the whole transaction. Computing MAX outside the create
 * transaction lets concurrent requests all choose the same number and then
 * exhaust their retry loops on the unique (tenantId, number) constraint.
 *
 * Existing fixtures and older data may use values such as `D1-1001`, while
 * newly-created orders use zero-padded numeric values. Read the numeric suffix
 * instead of relying on lexical ordering or parseInt from the first character;
 * otherwise every prefixed order would incorrectly produce `00001` forever.
 */
export async function nextOrderNumber(
  tx: Prisma.TransactionClient,
  tenantId: string,
): Promise<string> {
  const tenant = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Tenant" WHERE id = ${tenantId} FOR UPDATE
  `;
  if (!tenant.length) throw new Error("Тенант олдсонгүй.");

  const existing = await tx.serviceOrder.findMany({
    where: { tenantId },
    select: { number: true },
  });
  const occupied = new Set(existing.map(({ number }) => number));
  let next = existing.reduce((max, { number }) => {
    const match = /([0-9]+)$/.exec(number.trim());
    if (!match) return max;
    const parsed = Number.parseInt(match[1], 10);
    return Number.isSafeInteger(parsed) ? Math.max(max, parsed) : max;
  }, 0) + 1;

  let candidate = String(next).padStart(5, "0");
  while (occupied.has(candidate)) {
    next += 1;
    candidate = String(next).padStart(5, "0");
  }
  return candidate;
}
