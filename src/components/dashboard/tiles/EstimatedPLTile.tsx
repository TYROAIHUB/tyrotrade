import * as React from "react";
import { motion } from "framer-motion";
import { Bar, BarChart, Rectangle, XAxis } from "recharts";
import { Coins02Icon } from "@hugeicons/core-free-icons";
import { BentoTile } from "../BentoTile";
import { AnimatedNumber } from "../AnimatedNumber";
import {
  TONE_PL,
  TONE_EXPENSE,
  type IconBadgeTone,
} from "@/components/details/AccentIconBadge";
import {
  ChartContainer,
  type ChartConfig,
} from "@/components/evilcharts/ui/chart";
import { useThemeAccent } from "@/components/layout/theme-accent";
import { aggregateEstimatedPL } from "@/lib/selectors/aggregate";
import { selectProjectPL } from "@/lib/selectors/profitLoss";
import { toUsd } from "@/lib/finance/fxRates";
import { getFinancialYear } from "@/lib/dashboard/financialPeriod";
import { formatCompactCurrency } from "@/lib/format";
import type { Project } from "@/lib/dataverse/entities";

const TONE_NEUTRAL: IconBadgeTone = {
  gradient: "linear-gradient(135deg, #94a3b8 0%, #64748b 55%, #334155 100%)",
  ring: "rgba(100, 116, 139, 0.55)",
  solid: "#64748b",
};

interface EstimatedPLTileProps {
  projects: Project[];
  now?: Date;
  span?: string;
  rowSpan?: string;
  onClick?: () => void;
}

interface MonthBucket {
  monthKey: string;
  /** Short Turkish month name ("Tem", "Ağu", …). */
  monthLabel: string;
  /** Full Turkish month name ("Temmuz", "Ağustos", …) for the Zirve readout. */
  monthLong: string;
  /** Net P&L (USD equivalent, can be negative). */
  pl: number;
}

/**
 * Tahmini K&Z tile — USD-equivalent rollup of (sales − purchase − expense)
 * with a monthly distribution chart.
 *
 * Layout (matches user-supplied evilcharts monospace bar chart pattern):
 *  - Header row (above chart):
 *      • Left: net K&Z value + margin % + "Zirve" label naming the FY
 *        month with the largest |P&L|
 *      • Right: stacked Tahmini Satış / Alım / Gider compact metrics
 *        (replaces the legend that used to live below the radial chart)
 *  - Body: 12-month FY-aligned bar chart, theme-accent fill, hover
 *    expands a thin "spine" bar to full width and surfaces the value
 *    label on top — same animation dialect as the source snippet.
 *
 * Bar fill tracks `useThemeAccent()` so light / navy / black themes all
 * paint the chart in the active sidebar accent.
 */
export function EstimatedPLTile({
  projects,
  now = new Date(),
  span,
  rowSpan,
  onClick,
}: EstimatedPLTileProps) {
  const accent = useThemeAccent();
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

  /* ─────────── FY-aligned monthly P&L buckets ─────────── */
  const monthly = React.useMemo<MonthBucket[]>(() => {
    const fy = getFinancialYear(now);
    const buckets: MonthBucket[] = [];
    const indexByKey = new Map<string, number>();
    for (let i = 0; i < 12; i++) {
      const d = new Date(fy.startYear, 6 + i, 1); // Jul = month 6
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const monthLabel = new Intl.DateTimeFormat("tr-TR", {
        month: "short",
      }).format(d);
      const monthLong = new Intl.DateTimeFormat("tr-TR", {
        month: "long",
      }).format(d);
      buckets.push({ monthKey, monthLabel, monthLong, pl: 0 });
      indexByKey.set(monthKey, i);
    }
    for (const p of projects) {
      const projPL = selectProjectPL(p);
      if (projPL.salesTotal <= 0) continue;
      const cur = (projPL.currency ?? "USD").toUpperCase();
      const plUsd = toUsd(projPL.pl, cur);
      const t = new Date(p.projectDate);
      if (Number.isNaN(t.getTime())) continue;
      const key = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}`;
      const idx = indexByKey.get(key);
      if (idx !== undefined) buckets[idx].pl += plUsd;
    }
    return buckets;
  }, [projects, now]);

  // "Zirve" — the FY month with the largest absolute P&L. Picking by
  // |P&L| (not max positive) so a heavy loss month still surfaces as the
  // peak; the text colour reflects whether it's a profit or loss spike.
  const peak = React.useMemo<MonthBucket | null>(() => {
    let best: MonthBucket | null = null;
    for (const b of monthly) {
      if (!best || Math.abs(b.pl) > Math.abs(best.pl)) best = b;
    }
    return best && Math.abs(best.pl) > 0 ? best : null;
  }, [monthly]);

  const hasChartData = monthly.some((b) => b.pl !== 0);

  // Single-series ChartConfig (the actual fill comes from BarShape via
  // theme accent — config only feeds the ChartContainer wrapper).
  const chartConfig: ChartConfig = {
    pl: {
      label: "K&Z",
      colors: { light: [accent.solid], dark: [accent.solid] },
    },
  };

  return (
    <BentoTile
      title="Tahmini K&Z"
      subtitle={
        pl.fxConvertedCount > 0
          ? `USD eşdeğeri · ${pl.contributingCount} proje · ${pl.fxConvertedCount} FX`
          : `USD bazlı · ${pl.contributingCount} proje`
      }
      icon={Coins02Icon}
      iconTone={iconTone}
      span={span}
      rowSpan={rowSpan}
      onClick={onClick}
    >
      <div className="flex flex-col h-full min-h-0">
        {/* ─────────── Header: TOPLAM + ZIRVE | SATIŞ/ALIM/GİDER ───────────
            Two columns of "eyebrow over big value" on the left
            (TOPLAM | ZIRVE) baseline-aligned, three rows of
            label/dot/value on the right (3-col grid for column-aligned
            dots and figures across rows). */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-stretch gap-3 min-w-0">
            <div className="flex flex-col gap-1 min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-foreground/70 leading-none">
                Toplam
              </span>
              <span
                className="text-[22px] font-semibold leading-none tracking-tight"
                style={{ color: tintColor }}
              >
                <AnimatedNumber
                  value={pl.pl}
                  preset="currency"
                  currency="USD"
                  prefix={pl.pl > 0 ? "+" : undefined}
                />
              </span>
            </div>

            {peak && (
              <>
                <span className="border-l border-dashed border-border/70 self-stretch" />
                <div
                  className="flex flex-col gap-1 min-w-0"
                  title={`En yüksek |K&Z| ${peak.monthLong} ayı — ${peak.pl >= 0 ? "+" : ""}${formatCompactCurrency(peak.pl, "USD")}`}
                >
                  <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-foreground/70 leading-none">
                    Zirve
                  </span>
                  <span
                    className="text-[22px] font-semibold leading-none tracking-tight truncate"
                    style={{ color: peak.pl >= 0 ? tintColor : "rgb(159 18 57)" }}
                  >
                    {peak.monthLong}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Right: 3-row grid (label · dot · value) so the columns line
              up vertically across the three rows. Labels right-aligned
              against the dot column; values right-aligned at the pill's
              right edge. */}
          <div
            className="grid shrink-0 gap-x-1.5 gap-y-1 items-center"
            style={{
              gridTemplateColumns: "auto auto minmax(64px, max-content)",
            }}
          >
            <RightMetric label="Satış" value={pl.salesTotalUsd} dot="#10b981" />
            <RightMetric label="Alım" value={pl.purchaseTotalUsd} dot="#f59e0b" />
            <RightMetric label="Gider" value={pl.expenseTotalUsd} dot="#dc2626" />
          </div>
        </div>

        <hr className="my-2.5 border-t border-dashed border-border/70" />

        {/* ─────────── Monthly bar chart ─────────── */}
        {hasChartData ? (
          <ChartContainer
            config={chartConfig}
            className="flex-1 min-h-[88px] w-full"
          >
            <BarChart
              accessibilityLayer
              data={monthly}
              margin={{ top: 26, right: 6, left: 6, bottom: 0 }}
            >
              {/* Tick styling matches EstimatedQuantityTile so the two
                  monthly bar charts read with the same axis dialect. */}
              <XAxis
                dataKey="monthLabel"
                tickLine={false}
                tickMargin={6}
                axisLine={false}
                tick={{
                  fontSize: 11,
                  fill: "currentColor",
                  opacity: 0.85,
                  fontWeight: 600,
                }}
                interval={0}
              />
              <Bar
                dataKey="pl"
                shape={(p: unknown) => (
                  <BarShape {...(p as BarShapeProps)} accentColor={accent.solid} />
                )}
                activeBar={(p: unknown) => (
                  <BarShape {...(p as BarShapeProps)} accentColor={accent.solid} />
                )}
              />
            </BarChart>
          </ChartContainer>
        ) : (
          <div className="flex-1 grid place-items-center text-[10.5px] text-muted-foreground/70">
            Aylık K&Z dağılımı için veri yok
          </div>
        )}

        {pl.unknownCurrencyCount > 0 && (
          <div className="text-[9.5px] text-muted-foreground/70 italic mt-1">
            {pl.unknownCurrencyCount} proje tanımsız para birimi — kur uygulanmadı
          </div>
        )}
      </div>
    </BentoTile>
  );
}

/* ─────────── Right-column compact metric row ─────────── */

/**
 * One row of the right-side 3-column grid (label / dot / value).
 * Returns a fragment so the parent grid can lay out all three rows in
 * three columns — that's what gives the dots and currency figures a
 * clean vertical alignment regardless of label length.
 */
function RightMetric({
  label,
  value,
  dot,
}: {
  label: string;
  value: number;
  dot: string;
}) {
  return (
    <>
      <span
        className="text-[10px] uppercase tracking-wider text-muted-foreground/85 text-right leading-none"
        title={`${label}: ${formatCompactCurrency(value, "USD")}`}
      >
        {label}
      </span>
      <span
        className="size-1.5 rounded-full shrink-0 justify-self-center"
        style={{ backgroundColor: dot }}
      />
      <span
        className="text-[11.5px] font-bold tabular-nums leading-none text-right"
        style={{ color: dot }}
      >
        {formatCompactCurrency(value, "USD")}
      </span>
    </>
  );
}

/* ─────────── Animated bar shape ─────────── */
//
// Adapted from the user-supplied evilcharts "monospace" bar pattern.
// At rest each bar collapses to a 10%-wide "spine"; on hover (recharts
// fires this for the activeBar slot) it springs to the full bar width
// and the value label fades in above the tip. transformOrigin is
// pinned to the geometric centre so the scale animation reads as the
// bar "blooming" outward rather than sliding from one edge.

const COLLAPSED_SCALE = 0.1;

interface BarShapeProps {
  index?: number;
  value?: number | [number, number];
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
  isActive?: boolean;
  accentColor?: string;
}

function BarShape(props: BarShapeProps) {
  const { x, y, width, height, index, value, isActive, accentColor } = props;
  const xPos = Number(x ?? 0);
  const yPos = Number(y ?? 0);
  const w = Number(width ?? 0);
  const h = Number(height ?? 0);
  const numericValue =
    typeof value === "number"
      ? value
      : Array.isArray(value)
        ? value[1] - value[0]
        : 0;
  const fill = accentColor ?? "#3b82f6";
  const centerX = xPos + w / 2;

  // Zero-value months: render a visible baseline tick so the slot still
  // reads as "month exists, no data" instead of looking like the bar is
  // missing. Higher opacity + slightly larger than before so the user
  // can tell the slot is intentionally there.
  if (h === 0 || numericValue === 0) {
    return (
      <>
        <Rectangle
          {...props}
          fill="transparent"
          style={{ pointerEvents: "all" }}
        />
        <rect
          x={centerX - 2}
          y={yPos - 1.5}
          width={4}
          height={3}
          rx={1.5}
          fill={fill}
          fillOpacity={0.45}
        />
      </>
    );
  }

  // Enforce a minimum visible height so months with very small (relative
  // to the peak) P&L don't render as sub-pixel slivers. We extend the
  // bar in the direction it grows: positive bars need extra height
  // above yPos (so we shift yPos up); negative bars extend below the
  // baseline (yPos stays, h grows down).
  const MIN_H = 6;
  const renderH = Math.max(h, MIN_H);
  const renderY = numericValue >= 0 ? yPos - (renderH - h) : yPos;
  const tipY = numericValue >= 0 ? renderY : renderY + renderH;
  // Label clears the bar tip with comfortable headroom. For negative
  // bars the tip is at the bottom of the bar, so the label sits below.
  const labelClearance = 10;
  const labelY =
    numericValue >= 0 ? tipY - labelClearance : tipY + labelClearance + 8;
  const centerY = renderY + renderH / 2;

  return (
    <>
      {/* Invisible hit-target so hover is detected across the full
          natural bar width even when the visible spine is only 10%.
          Explicit pointer-events:all because some browsers skip
          hit-testing for `fill="transparent"` rects. */}
      <Rectangle
        {...props}
        fill="transparent"
        style={{ pointerEvents: "all" }}
      />

      <motion.rect
        key={`bar-${index}`}
        x={xPos}
        y={renderY}
        width={w}
        height={renderH}
        fill={fill}
        rx={1.5}
        initial={{ scaleX: COLLAPSED_SCALE }}
        animate={{ scaleX: isActive ? 1 : COLLAPSED_SCALE }}
        transition={{ type: "spring", stiffness: 220, damping: 26 }}
        style={{
          transformOrigin: `${centerX}px ${centerY}px`,
          transformBox: "fill-box",
          pointerEvents: "none",
        }}
      />

      {isActive && (
        <motion.text
          key={`text-${index}`}
          x={centerX}
          y={labelY}
          textAnchor="middle"
          dominantBaseline="alphabetic"
          fill={fill}
          initial={{ opacity: 0, y: labelY - 4, filter: "blur(2px)" }}
          animate={{ opacity: 1, y: labelY, filter: "blur(0px)" }}
          exit={{ opacity: 0, filter: "blur(2px)" }}
          transition={{ duration: 0.18 }}
          style={{
            pointerEvents: "none",
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: "-0.01em",
          }}
        >
          {`${numericValue >= 0 ? "+" : "−"}${formatCompactCurrency(Math.abs(numericValue), "USD")}`}
        </motion.text>
      )}
    </>
  );
}
