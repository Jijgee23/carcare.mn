/**
 * Converts the durations configured on service-catalog items into one order
 * estimate. Parts and fees do not consume work time; a labor/diagnostic item
 * without a usable duration keeps the result unresolved so the worker can
 * enter it explicitly instead of receiving a misleading estimate.
 */

type NumericLike = number | string | { toString(): string };

export type ServiceDurationItem = {
  kind: string;
  status: string;
  quantity: NumericLike;
  service: {
    durationValue: NumericLike | null;
    durationUnit: { name: string; code: string | null } | null;
  } | null;
  diagnosticTemplate: { durationMin: NumericLike | null } | null;
};

function positiveNumber(value: NumericLike | null | undefined): number | null {
  if (value == null) return null;
  const parsed = typeof value === "number" ? value : Number(value.toString());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function minutesPerUnit(unit: { name: string; code: string | null }): number | null {
  const name = unit.name.trim().toLocaleLowerCase("mn-MN");
  const code = unit.code?.trim().toLocaleLowerCase("mn-MN") ?? "";
  if (["мин", "минут", "minute", "minutes", "m"].includes(name) || code === "мин") {
    return 1;
  }
  if (
    ["цаг", "hour", "hours", "хүн/цаг"].includes(name) ||
    ["ц", "h", "х/ц"].includes(code)
  ) {
    return 60;
  }
  // "Өдөр" has no stable meaning across branches with different opening
  // hours, so it must be resolved manually rather than guessed as 8/24 hours.
  return null;
}

/** Returns the total whole-minute estimate, or null when it cannot be trusted. */
export function calculateServiceItemDurationMinutes(
  items: readonly ServiceDurationItem[],
): number | null {
  const workItems = items.filter(
    (item) =>
      (item.status === "PENDING" || item.status === "IN_PROGRESS") &&
      (item.kind === "LABOR" || item.kind === "DIAGNOSTIC"),
  );
  if (workItems.length === 0) return null;

  let total = 0;
  for (const item of workItems) {
    const quantity = positiveNumber(item.quantity);
    if (quantity == null) return null;

    const serviceValue = positiveNumber(item.service?.durationValue);
    if (serviceValue != null) {
      const multiplier = item.service?.durationUnit
        ? minutesPerUnit(item.service.durationUnit)
        : null;
      if (multiplier == null) return null;
      total += serviceValue * quantity * multiplier;
      continue;
    }

    const diagnosticValue = positiveNumber(item.diagnosticTemplate?.durationMin);
    if (diagnosticValue == null) return null;
    // DiagnosticTemplate.durationMin is already expressed in minutes.
    total += diagnosticValue * quantity;
  }

  return Number.isFinite(total) && total > 0 ? Math.ceil(total) : null;
}
