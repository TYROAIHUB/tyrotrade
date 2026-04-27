import * as React from "react";
import { Coins02Icon } from "@hugeicons/core-free-icons";
import { BentoTile } from "../BentoTile";
import { AnimatedNumber } from "../AnimatedNumber";
import {
  TONE_PL,
  TONE_EXPENSE,
  type IconBadgeTone,
} from "@/components/details/AccentIconBadge";
import { EvilRadialChart } from "@/components/evilcharts/charts/radial-chart";
import { type ChartConfig } from "@/components/evilcharts/ui/chart";
import { aggregateEstimatedPL } from "@/lib/selectors/aggregate";
import { formatCompactCurrency } from "@/lib/format";
import type { Project } from "@/lib/dataverse/entities";

const TONE_NEUTRAL: IconBadgeTone = {
  gradient: "linear-gradient(135deg, #94a3b8 0%, #64748b 55%, #334155 100%)",
  ring: "rgba(100, 116, 139, 0.55)",
};

interface EstimatedPLTileProps {
  projects: Project[];
  span?: string;
  rowSpan?: string;
}

/**
 * Tahmini K&Z tile — USD-only rollup of (sales − purchase − expense).
 *
 * Layout:
 *   - Headline: net P&L value + margin % (sign-coloured)
 *   - Hero: 3-arc radial chart (Tahmini Satış / Alım / Gider) using
 *     `@evilcharts/radial-chart`. Concentric arcs make it instantly
 *     obvious how much sales is consumed by purchase + expense.
 *   - Footer: net P&L total
 *
 * Domain-fixed colours — emerald for sales (revenue), rose for purchase
 * + expense (outflows). Different shades distinguish purchase from
 * expense without breaking the rose family.
 */
export function EstimatedPLTile({
  projects,
  span,
  rowSpan,
}: EstimatedPLTileProps) {
  const pl = React.useMemo(() => aggregateEstimatedPL(projects), [projects]);

  const positive = pl.pl > 0;
  const negative = pl.pl < 0;
  const tintColor = positive
    ? "rgb(4 120 87)"
    : negative
      ? "rgb(159 18 57)"
      : "rgb(71 85 105)";
  const iconTone: IconBadgeTone = positive
    ? TONE_PL
    : negative
      ? TONE_EXPENSE
      : TONE_NEUTRAL;

  // Radial chart data — 3 arcs sized by their absolute USD totals. Sales
  // gets the emerald family, purchase + expense get rose shades. Recharts
  // RadialBar renders each entry as a concentric arc; relative arc length
  // reflects the value ratio.
  const chartData = React.useMemo(
    () => [
      { key: "sales", label: "Satış", value: pl.salesTotalUsd },
      { key: "purchase", label: "Alım", value: pl.purchaseTotalUsd },
      { key: "expense", label: "Gider", value: pl.expenseTotalUsd },
    ],
    [pl]
  );

  const chartConfig: ChartConfig = {
    sales: {
      label: "Tahmini Satış",
      colors: { light: ["#10b981"], dark: ["#34d399"] }, // emerald
    },
    purchase: {
      label: "Tahmini Alım",
      colors: { light: ["#f59e0b"], dark: ["#fbbf24"] }, // amber
    },
    expense: {
      label: "Tahmini Gider",
      colors: { light: ["#dc2626"], dark: ["#ef4444"] }, // red
    },
  };

  return (
    <BentoTile
      title="Tahmini K&Z"
      subtitle={`USD bazlı · ${pl.contributingCount} proje`}
      icon={Coins02Icon}
      iconTone={iconTone}
      span={span}
      rowSpan={rowSpan}
    >
      <div className="flex flex-col gap-1 h-full min-h-0">
        {/* Headline net P&L + margin */}
        <div className="flex items-baseline gap-2 flex-wrap">
          <span
            className="text-[24px] font-semibold leading-none tracking-tight"
            style={{ color: tintColor }}
          >
            <AnimatedNumber
              value={pl.pl}
              preset="currency"
              currency="USD"
              prefix={pl.pl > 0 ? "+" : undefined}
            />
          </span>
          <span
            className="text-[11px] font-semibold tabular-nums"
            style={{ color: tintColor }}
          >
            {pl.marginPct >= 0 ? "+" : ""}
            {pl.marginPct.toFixed(1)}%
          </span>
        </div>

        {/* 3-arc semi-radial chart */}
        {pl.salesTotalUsd > 0 ? (
          <div className="relative flex-1 min-h-[150px] -mx-1 -mb-1">
            <EvilRadialChart
              data={chartData}
              dataKey="value"
              nameKey="key"
              chartConfig={chartConfig}
              variant="semi"
              hideLegend
              hideTooltip
              hideBackground
              className="h-full w-full"
            />
            {/* Inline legend with values — sits below the semi-circle */}
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-around gap-1 text-[9.5px] px-1">
              <PLLegend dot="#10b981" label="Satış" value={pl.salesTotalUsd} />
              <PLLegend dot="#f59e0b" label="Alım" value={pl.purchaseTotalUsd} />
              <PLLegend dot="#dc2626" label="Gider" value={pl.expenseTotalUsd} />
            </div>
          </div>
        ) : (
          <div className="mt-auto text-[10.5px] text-muted-foreground/70">
            Tahmini satış verisi yok
          </div>
        )}

        {pl.nonUsdCount > 0 && (
          <div className="text-[9.5px] text-muted-foreground/70 italic">
            {pl.nonUsdCount} proje USD dışı — dönüşüm uygulanmadı
          </div>
        )}
      </div>
    </BentoTile>
  );
}

function PLLegend({
  dot,
  label,
  value,
}: {
  dot: string;
  label: string;
  value: number;
}) {
  return (
    <span className="inline-flex items-center gap-1 min-w-0">
      <span
        className="size-1.5 rounded-full shrink-0"
        style={{ backgroundColor: dot }}
      />
      <span className="text-muted-foreground truncate">{label}</span>
      <span className="font-semibold tabular-nums text-foreground/85 shrink-0">
        {formatCompactCurrency(value, "USD")}
      </span>
    </span>
  );
}
