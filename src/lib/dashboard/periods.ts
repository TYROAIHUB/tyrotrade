export type PeriodKey = "monthly" | "quarterly" | "yearly" | "all";

export interface PeriodMeta {
  key: PeriodKey;
  label: string;
  /** Days back from `now`, or null for unbounded. */
  days: number | null;
}

export const PERIODS: PeriodMeta[] = [
  { key: "monthly", label: "Aylık", days: 30 },
  { key: "quarterly", label: "Çeyreklik", days: 90 },
  { key: "yearly", label: "Yıllık", days: 365 },
  { key: "all", label: "Tüm Zamanlar", days: null },
];

export const DEFAULT_PERIOD: PeriodKey = "yearly";

/**
 * Return only items whose `projectDate` falls within the rolling window
 * specified by `period`. "all" returns the input unchanged.
 */
export function filterByPeriod<T extends { projectDate: string }>(
  items: T[],
  period: PeriodKey,
  now: Date = new Date()
): T[] {
  const meta = PERIODS.find((p) => p.key === period);
  if (!meta || meta.days == null) return items;
  const cutoff = now.getTime() - meta.days * 24 * 60 * 60 * 1000;
  return items.filter((it) => {
    const t = new Date(it.projectDate).getTime();
    return Number.isFinite(t) && t >= cutoff;
  });
}
