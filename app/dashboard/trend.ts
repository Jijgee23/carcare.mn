const DAY_MS = 24 * 60 * 60 * 1000;

export type Trend = {
  /** Per-day counts over the window (oldest → newest). */
  spark: number[];
  /** % change of the recent half vs the previous half; null when no baseline. */
  changePct: number | null;
};

/**
 * Buckets a list of dates into daily counts over the last `days` days and
 * compares the recent half to the previous half — for stat-card sparklines.
 */
export function dailyTrend(dates: (Date | null)[], days = 14): Trend {
  const now = new Date();
  const startMs = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - (days - 1),
  ).getTime();

  const spark = new Array<number>(days).fill(0);
  for (const d of dates) {
    if (!d) continue;
    const dayMs = new Date(
      d.getFullYear(),
      d.getMonth(),
      d.getDate(),
    ).getTime();
    const idx = Math.round((dayMs - startMs) / DAY_MS);
    if (idx >= 0 && idx < days) spark[idx]++;
  }

  const half = Math.floor(days / 2);
  const recent = spark.slice(days - half).reduce((a, b) => a + b, 0);
  const prev = spark
    .slice(days - 2 * half, days - half)
    .reduce((a, b) => a + b, 0);
  const changePct = prev > 0 ? ((recent - prev) / prev) * 100 : null;

  return { spark, changePct };
}
