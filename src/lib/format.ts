const trCollator = new Intl.Collator("tr", { sensitivity: "base" });

export const formatCurrency = (
  amount: number,
  currency: string = "USD",
  opts?: { maximumFractionDigits?: number }
): string =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
    maximumFractionDigits: opts?.maximumFractionDigits ?? 0,
  }).format(amount);

export const formatCompactCurrency = (
  amount: number,
  currency: string = "USD"
): string =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);

export const formatTons = (kg: number): string => {
  const tons = kg / 1000;
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(tons);
};

export const formatNumber = (n: number, fractionDigits = 0): string =>
  new Intl.NumberFormat("tr-TR", {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  }).format(n);

/**
 * Standard Turkish date display — `dd.MM.yyyy` (e.g. `25.04.2026`).
 *
 * Used everywhere a date is shown to the user (project list, right-panel
 * cards, milestone timeline, dashboard tiles, data inspector). Operators
 * read the same format whether they're in the Veri Yönetimi raw table or
 * in the Projeler hero card — consistency is the goal.
 *
 * Accepts ISO datetime ("2026-04-25T00:00:00Z") or date-only ("2026-04-25");
 * any other parseable string falls back through `new Date()`.
 */
export const formatDate = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
};

/** Compact `dd.MM` (no year) — kept for pill / inline contexts where the
 *  year is implied by surrounding context. */
export const formatDateShort = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
  }).format(d);
};

export const trSort = trCollator.compare;
