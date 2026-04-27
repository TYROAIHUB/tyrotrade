/**
 * Currency conversion utility — static rates pinned at April 2026.
 *
 * The dashboard rolls everything up in USD, but project lines can be
 * priced in USD / EUR / TRY. We don't have a live FX feed wired in (no
 * Dataverse FX table, no external API), so rates are hardcoded here.
 * The values are intentionally approximate: this is for executive
 * KPI displays, not accounting-grade reconciliation. When a finance
 * feed is wired in, swap `RATES_TO_USD` for a hook that reads the
 * dated rates per project.
 *
 * Rate sources (April 2026 mid-month, indicative):
 *   - EUR/USD ~ 1.07
 *   - TRY/USD ~ 0.026
 *   - GBP/USD ~ 1.27
 *
 * If a project ships in a currency we don't recognise, we treat it as
 * USD (no conversion) and surface the project in the "uncovered" count
 * via `convertToUsd().converted === false`.
 */

const RATES_TO_USD: Record<string, number> = {
  USD: 1,
  EUR: 1.07,
  TRY: 0.026,
  GBP: 1.27,
};

export interface FxConversion {
  /** Amount in USD after applying the static rate. */
  usd: number;
  /** True when an FX rate was applied (i.e. source currency ≠ USD). */
  converted: boolean;
  /** True when the source currency is in `RATES_TO_USD`. */
  recognised: boolean;
}

/**
 * Convert an amount in a source currency into USD using the static rate
 * table above. Always returns a numeric result so callers don't need
 * null-checks; the `recognised` flag tells you whether the result was
 * a real conversion or a passthrough.
 */
export function convertToUsd(
  amount: number,
  currency: string | undefined | null
): FxConversion {
  if (!Number.isFinite(amount)) {
    return { usd: 0, converted: false, recognised: false };
  }
  const code = (currency ?? "USD").toUpperCase();
  const rate = RATES_TO_USD[code];
  if (rate === undefined) {
    // Unknown currency — pass through as-is and flag for the UI so it
    // can render a disclaimer if needed.
    return { usd: amount, converted: false, recognised: false };
  }
  return {
    usd: amount * rate,
    converted: code !== "USD",
    recognised: true,
  };
}

/** Convenience for callers that just want the USD number. */
export function toUsd(amount: number, currency: string | undefined | null): number {
  return convertToUsd(amount, currency).usd;
}

/** Currencies the table currently knows about. */
export const SUPPORTED_FX_CODES = Object.keys(RATES_TO_USD);
