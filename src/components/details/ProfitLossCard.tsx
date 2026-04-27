import * as React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { GlassPanel } from "@/components/glass/GlassPanel";
import { AccentIconBadge, TONE_EXPENSE } from "./AccentIconBadge";
import { formatCurrency, formatNumber } from "@/lib/format";
import type { Project } from "@/lib/dataverse/entities";

interface Props {
  project: Project;
}

/**
 * "Tahmini Kâr & Zarar" — estimated P&L card for the right rail.
 *
 *   Sales total    = Σ ((quantityKg / 1000) × unitPrice)        (per line, sales price = `mserp_unitprice`)
 *   Purchase total = Σ ((quantityKg / 1000) × purchasePrice)    (per line, purchase price = `mserp_salesprice`)
 *   Expense total  = `costEstimate.totalUsd` (sum of expense lines × tons)
 *
 *   P&L = Sales − Purchase − Expense
 *
 * If neither sales nor purchase prices are filled the whole card
 * hides — there's nothing meaningful to show. Currency comes from
 * the first project line; same logic the cargo card uses.
 */
export function ProfitLossCard({ project }: Props) {
  const lines = project.lines ?? [];
  const currency = lines[0]?.currency ?? project.currency ?? "USD";

  let salesTotal = 0;
  let purchaseTotal = 0;
  for (const l of lines) {
    const tons = l.quantityKg / 1000;
    if (l.unitPrice > 0) salesTotal += tons * l.unitPrice;
    if (l.purchasePrice && l.purchasePrice > 0)
      purchaseTotal += tons * l.purchasePrice;
  }
  const expenseTotal = project.costEstimate?.totalUsd ?? 0;

  // If both legs are empty the calculation isn't meaningful — bail.
  if (salesTotal <= 0 && purchaseTotal <= 0) return null;

  const pl = salesTotal - purchaseTotal - expenseTotal;
  const positive = pl > 0;
  const negative = pl < 0;
  const Icon = positive ? TrendingUp : negative ? TrendingDown : Minus;
  const accentColor = positive
    ? "#059669" // emerald-600
    : negative
      ? "#dc2626" // rose-600
      : "#475569"; // slate-600
  const accentTint = positive
    ? "rgba(5,150,105,0.10)"
    : negative
      ? "rgba(220,38,38,0.10)"
      : "rgba(71,85,105,0.10)";

  // Margin pct relative to sales total — easier to read than raw delta.
  const marginPct =
    salesTotal > 0 ? (pl / salesTotal) * 100 : null;

  return (
    <GlassPanel tone="default" className="rounded-2xl">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center gap-2.5 mb-3">
          <AccentIconBadge size="sm" tone={TONE_EXPENSE}>
            <Icon className="size-4" strokeWidth={2} />
          </AccentIconBadge>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Tahmini Kâr &amp; Zarar
            </div>
            <div className="text-[13px] font-semibold leading-snug">
              Satış − Alım − Gider
            </div>
          </div>
          {/* Big P&L value */}
          <div className="text-right shrink-0">
            <div
              className="text-[18px] font-bold tabular-nums tracking-tight"
              style={{ color: accentColor }}
            >
              {pl >= 0 ? "+" : "−"}
              {formatCurrency(Math.abs(pl), currency)}
            </div>
            {marginPct != null && (
              <div
                className="inline-flex items-center mt-0.5 px-1.5 rounded-sm text-[10px] font-semibold tabular-nums"
                style={{ backgroundColor: accentTint, color: accentColor }}
              >
                Marj %{marginPct.toFixed(1)}
              </div>
            )}
          </div>
        </div>

        {/* Breakdown rows */}
        <div className="rounded-xl border border-border/40 overflow-hidden">
          <BreakdownRow
            label="Tahmini Satış"
            sub={`${formatNumber(
              lines.reduce((s, l) => s + l.quantityKg / 1000, 0),
              0
            )} t × ort. fiyat`}
            value={formatCurrency(salesTotal, currency)}
            sign="positive"
          />
          <BreakdownRow
            label="Tahmini Alım"
            sub="Satınalma birim fiyatı × miktar"
            value={`-${formatCurrency(purchaseTotal, currency)}`}
            sign="negative"
            faded={purchaseTotal === 0}
          />
          <BreakdownRow
            label="Tahmini Gider"
            sub={
              project.costEstimateLines && project.costEstimateLines.length > 0
                ? `${project.costEstimateLines.length} kalem`
                : "Gider satırı yok"
            }
            value={`-${formatCurrency(expenseTotal, currency)}`}
            sign="negative"
            faded={expenseTotal === 0}
          />
          <BreakdownRow
            label="Tahmini Kâr / Zarar"
            value={`${pl >= 0 ? "+" : "−"}${formatCurrency(
              Math.abs(pl),
              currency
            )}`}
            sign={positive ? "positive" : negative ? "negative" : "neutral"}
            emphasised
          />
        </div>
      </div>
    </GlassPanel>
  );
}

/* ─────────── Breakdown row ─────────── */

function BreakdownRow({
  label,
  sub,
  value,
  sign,
  emphasised = false,
  faded = false,
}: {
  label: string;
  sub?: string;
  value: string;
  sign: "positive" | "negative" | "neutral";
  emphasised?: boolean;
  faded?: boolean;
}) {
  const valueColor =
    sign === "positive"
      ? "text-emerald-700"
      : sign === "negative"
        ? "text-rose-700"
        : "text-foreground";
  return (
    <div
      className={
        "grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 px-3 py-2 text-[11.5px] border-t border-border/30 first:border-t-0 items-baseline " +
        (emphasised ? "bg-foreground/[0.04]" : "") +
        (faded ? " opacity-55" : "")
      }
    >
      <div className="min-w-0">
        <div
          className={
            "truncate " +
            (emphasised
              ? "font-semibold uppercase tracking-wider text-[10.5px] text-muted-foreground"
              : "font-medium text-foreground")
          }
        >
          {label}
        </div>
        {sub && (
          <div className="text-[10px] text-muted-foreground/80 truncate mt-0.5">
            {sub}
          </div>
        )}
      </div>
      <div
        className={
          "text-right tabular-nums " +
          (emphasised ? "text-[13px] font-bold" : "font-semibold") +
          " " +
          valueColor
        }
      >
        {value}
      </div>
    </div>
  );
}
