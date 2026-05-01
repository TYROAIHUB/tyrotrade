import * as React from "react";
import { Receipt, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { GlassPanel } from "@/components/glass/GlassPanel";
import { AccentIconBadge, TONE_EXPENSE } from "./AccentIconBadge";
import {
  formatCompactCurrency,
  formatCurrency,
  formatNumber,
} from "@/lib/format";
import { selectEstimateTotal } from "@/lib/selectors/project";
import { toUsdAtDate } from "@/lib/finance/fxRates";
import { useProjectActualExpense } from "@/hooks/useProjectActualExpense";
import type { Project } from "@/lib/dataverse/entities";

interface Props {
  project: Project;
}

/**
 * Tahmini vs Gerçekleşen Gider — side-by-side comparison card on the
 * Vessel Projects right rail, sitting directly under the
 * `CommoditySalesCard` ("Taşınan Ürün" block).
 *
 *   Expected  ← `selectEstimateTotal(project)` — already USD per the
 *               F&O entity model (`mserp_expamountusdd` is normalised
 *               to USD per ton on the Tahmini Gider entity).
 *   Realized  ← Σ rows from `mserp_tryaifrtexpenselinedistlineentities`
 *               for the project, converted to USD at each row's
 *               `mserp_datefinancial` via the historical FX table so
 *               TRY / EUR / RUB postings land at their period rate
 *               (matches the dashboard P&L rollups).
 *
 * Variance (realized − expected):
 *   - negative → saved vs estimate (emerald) — under budget = GOOD
 *   - positive → over estimate    (rose)   — over budget  = BAD
 *   - zero / no estimate → slate "on target"
 */
export function ExpectedRealizedExpenseCard({ project }: Props) {
  const { rows, isFetching, fetchedAt } = useProjectActualExpense(
    project.projectNo
  );

  const expectedUsd = selectEstimateTotal(project);

  const realized = React.useMemo(() => {
    let usdTotal = 0;
    /** Native-currency buckets so we can show breakdown in the
     *  tooltip — useful when the project posted across mixed
     *  currencies (rare but happens). */
    const byCurrency = new Map<string, number>();
    for (const r of rows) {
      const amount = Number(r.mserp_lineamount);
      if (!Number.isFinite(amount) || amount === 0) continue;
      const currency = String(r.mserp_currencycode ?? "USD")
        .trim()
        .toUpperCase();
      const date =
        typeof r.mserp_datefinancial === "string"
          ? r.mserp_datefinancial
          : null;
      usdTotal += toUsdAtDate(amount, currency, date);
      byCurrency.set(currency, (byCurrency.get(currency) ?? 0) + amount);
    }
    const currencies = [...byCurrency.entries()].sort(
      (a, b) => b[1] - a[1]
    );
    return { usdTotal, byCurrency: currencies, rowCount: rows.length };
  }, [rows]);

  const hasExpected = expectedUsd > 0;
  const hasRealized = realized.usdTotal > 0;
  const variance = realized.usdTotal - expectedUsd;
  const variancePct =
    hasExpected && hasRealized ? (variance / expectedUsd) * 100 : null;

  /* Color rule (expense semantics — lower is better):
   *   under budget (variance < 0) → emerald
   *   over budget  (variance > 0) → rose
   *   on target / unknown          → slate */
  const varTone = !hasExpected || !hasRealized
    ? {
        text: "rgb(71 85 105)", // slate-600
        bg: "rgba(100,116,139,0.12)",
        ring: "rgba(100,116,139,0.30)",
        Icon: Minus,
        label: hasRealized
          ? "Tahmini gider girilmemiş"
          : hasExpected
            ? "Henüz gerçekleşen yok"
            : "Veri yok",
      }
    : variance < 0
      ? {
          text: "rgb(4 120 87)", // emerald-700
          bg: "rgba(16,185,129,0.12)",
          ring: "rgba(16,185,129,0.30)",
          Icon: TrendingDown,
          label: "Bütçenin altında",
        }
      : variance > 0
        ? {
            text: "rgb(159 18 57)", // rose-700
            bg: "rgba(244,63,94,0.12)",
            ring: "rgba(244,63,94,0.30)",
            Icon: TrendingUp,
            label: "Bütçenin üstünde",
          }
        : {
            text: "rgb(71 85 105)",
            bg: "rgba(100,116,139,0.12)",
            ring: "rgba(100,116,139,0.30)",
            Icon: Minus,
            label: "Hedefinde",
          };

  const VarIcon = varTone.Icon;

  return (
    <GlassPanel tone="default" className="rounded-2xl">
      <div className="p-4">
        {/* Header — same iconography pattern as the sibling cards */}
        <div className="flex items-start gap-2.5 mb-3">
          <AccentIconBadge size="sm" tone={TONE_EXPENSE}>
            <Receipt className="size-4" strokeWidth={2} />
          </AccentIconBadge>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Gider Karşılaştırması
            </div>
            <div className="text-[13px] font-semibold leading-snug">
              Tahmini vs Gerçekleşen
            </div>
          </div>
          {isFetching && (
            <span
              className="size-2 rounded-full bg-amber-500 animate-pulse mt-1.5"
              title="Gerçekleşen masraf satırları yükleniyor"
            />
          )}
        </div>

        {/* Two stats side-by-side: Expected | Realized */}
        <div className="grid grid-cols-2 gap-2 mb-2.5">
          <BigStat
            label="Tahmini"
            valueUsd={expectedUsd}
            placeholder={hasExpected ? null : "—"}
          />
          <BigStat
            label="Gerçekleşen"
            valueUsd={realized.usdTotal}
            placeholder={
              hasRealized
                ? null
                : isFetching
                  ? "..."
                  : fetchedAt
                    ? "0"
                    : "—"
            }
            tooltip={
              realized.byCurrency.length > 0
                ? realized.byCurrency
                    .map(
                      ([c, v]) =>
                        `${c}: ${formatNumber(v, 0)}`
                    )
                    .join(" · ")
                : undefined
            }
          />
        </div>

        {/* Variance pill — full-width, tone reflects expense direction */}
        <div
          className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl"
          style={{
            backgroundColor: varTone.bg,
            boxShadow: `inset 0 0 0 1px ${varTone.ring}`,
            color: varTone.text,
          }}
          title={
            hasExpected && hasRealized
              ? `Tahmini ${formatCurrency(expectedUsd, "USD")}, Gerçekleşen ${formatCurrency(realized.usdTotal, "USD")} → fark ${variance >= 0 ? "+" : ""}${formatCurrency(variance, "USD")}`
              : undefined
          }
        >
          <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider">
            <VarIcon className="size-3.5" strokeWidth={2.5} />
            {varTone.label}
          </span>
          {hasExpected && hasRealized && (
            <span className="text-[13px] font-bold tabular-nums">
              {variance >= 0 ? "+" : "−"}
              {formatCompactCurrency(Math.abs(variance), "USD")}
              {variancePct != null && (
                <span className="text-[11.5px] font-semibold opacity-80 ml-1.5">
                  ({variance >= 0 ? "+" : "−"}
                  {formatNumber(Math.abs(variancePct), 1)}%)
                </span>
              )}
            </span>
          )}
        </div>

        {realized.rowCount > 0 && (
          <div className="text-[10px] text-muted-foreground mt-2 italic">
            {realized.rowCount} gerçekleşen masraf satırı
            {realized.byCurrency.length > 1 &&
              ` · ${realized.byCurrency.length} para birimi (USD'ye çevrildi)`}
          </div>
        )}
      </div>
    </GlassPanel>
  );
}

/* ─────────── Helpers ─────────── */

function BigStat({
  label,
  valueUsd,
  placeholder,
  tooltip,
}: {
  label: string;
  valueUsd: number;
  placeholder: string | null;
  tooltip?: string;
}) {
  return (
    <div
      className="px-3 py-2 rounded-xl bg-card/50 border border-border/40 min-w-0"
      title={tooltip ?? (placeholder ? undefined : formatCurrency(valueUsd, "USD"))}
    >
      <div className="text-[9.5px] uppercase tracking-wider text-muted-foreground truncate">
        {label}
      </div>
      <div className="text-[15px] font-bold tabular-nums mt-0.5 truncate">
        {placeholder ?? formatCompactCurrency(valueUsd, "USD")}
      </div>
    </div>
  );
}
