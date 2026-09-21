export type OrderProgressItem = {
  kind: string;
  status: string;
};

export type OrderProgressSummary = {
  total: number;
  completed: number;
};

/**
 * Summarize work items for list consumers without exposing item rows.
 * Parts and cancelled items are not actionable work and are excluded from
 * both counts.
 */
export function summarizeOrderProgress(
  items: readonly OrderProgressItem[],
): OrderProgressSummary {
  let total = 0;
  let completed = 0;

  for (const item of items) {
    if (item.kind === "PART" || item.status === "CANCELLED") continue;
    total += 1;
    if (item.status === "COMPLETED") completed += 1;
  }

  return { total, completed };
}
