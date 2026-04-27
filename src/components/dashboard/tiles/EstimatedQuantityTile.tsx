import * as React from "react";
import { CubeIcon } from "@hugeicons/core-free-icons";
import { Bar, BarChart, XAxis } from "recharts";
import { BentoTile } from "../BentoTile";
import { TONE_CARGO } from "@/components/details/AccentIconBadge";
import {
  ChartContainer,
  type ChartConfig,
} from "@/components/evilcharts/ui/chart";
import {
  GridBarBackground,
  GridBarShape,
} from "@/components/evilcharts/blocks/grid-bar-chart";
import { selectTotalKg, selectTotalTons } from "@/lib/selectors/project";
import { getFinancialYear } from "@/lib/dashboard/financialPeriod";
import type { Project } from "@/lib/dataverse/entities";

interface EstimatedQuantityTileProps {
  projects: Project[];
  /** Reference date — drives FY anchoring for the monthly chart. */
  now?: Date;
  span?: string;
  rowSpan?: string;
}

interface MonthRow {
  month: string;
  tons: number;
}

const TR_MONTHS = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];

/**
 * Tahmini Miktar tile — period-scoped tonnage with the full
 * `@evilcharts/grid-bar-chart` treatment (Total + Peak headers above
 * the grid bars). FY-aligned: months render Jul → Jun, peak month
 * surfaces the heaviest month inside the period.
 *
 * Domain colour: amber / cargo (TONE_CARGO). Grid bars use the same
 * amber so the visual hierarchy reads vertically: pill icon → headline
 * total → peak callout → bars.
 */
export function EstimatedQuantityTile({
  projects,
  now = new Date(),
  span,
  rowSpan,
}: EstimatedQuantityTileProps) {
  const totalTons = React.useMemo(
    () => projects.reduce((sum, p) => sum + selectTotalTons(p), 0),
    [projects]
  );

  // FY-aligned monthly tonnage. Aggregates `quantityKg` by the project's
  // `projectDate` calendar month, so the chart bucketing matches the
  // dashboard period filter (which uses the same field).
  const monthly = React.useMemo<MonthRow[]>(() => {
    const fy = getFinancialYear(now);
    const buckets: MonthRow[] = [];
    const indexByKey = new Map<string, number>();
    for (let i = 0; i < 12; i++) {
      const d = new Date(fy.startYear, 6 + i, 1); // Jul = 6
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      buckets.push({ month: TR_MONTHS[d.getMonth()], tons: 0 });
      indexByKey.set(key, i);
    }
    for (const p of projects) {
      const t = new Date(p.projectDate);
      if (Number.isNaN(t.getTime())) continue;
      const key = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}`;
      const idx = indexByKey.get(key);
      if (idx !== undefined) buckets[idx].tons += selectTotalKg(p) / 1000;
    }
    return buckets;
  }, [projects, now]);

  const peak = React.useMemo(
    () =>
      monthly.reduce(
        (acc, b, i) => (b.tons > acc.tons ? { ...b, idx: i } : acc),
        { month: monthly[0]?.month ?? "—", tons: 0, idx: 0 }
      ),
    [monthly]
  );

  // Compact total formatter — matches headline conventions elsewhere
  // (e.g. "12.4 bin t", "847 t").
  const totalLabel =
    totalTons >= 1000
      ? `${(totalTons / 1000).toLocaleString("tr-TR", {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        })} bin`
      : totalTons.toLocaleString("tr-TR", {
          maximumFractionDigits: 0,
        });
  const totalUnit = totalTons >= 1000 ? "t" : "t";

  // Single-series chart config — amber, theme-stable in light + dark.
  const chartConfig: ChartConfig = {
    tons: {
      label: "Tonaj",
      colors: { light: ["#f59e0b"], dark: ["#fbbf24"] },
    },
  };

  return (
    <BentoTile
      title="Tahmini Miktar"
      subtitle="Toplam tonaj · ay bazlı dağılım"
      icon={CubeIcon}
      iconTone={TONE_CARGO}
      span={span}
      rowSpan={rowSpan}
    >
      <div className="flex flex-col h-full min-w-0">
        {/* Total + Peak month strip — pattern from @evilcharts/grid-bar-chart */}
        <div className="flex items-stretch gap-3 mb-2">
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-muted-foreground font-mono text-[10px]">
              [Σ] Toplam
            </span>
            <span className="text-amber-700 font-mono text-2xl tracking-tighter leading-none">
              {totalLabel}
              <span className="text-[11px] ml-0.5 text-muted-foreground">
                {totalUnit}
              </span>
            </span>
          </div>
          <span className="border-l border-dashed border-border/70 self-stretch" />
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-muted-foreground font-mono text-[10px]">
              [⬆] Peak
            </span>
            <span className="text-amber-700 font-mono text-2xl tracking-tighter leading-none truncate">
              {peak.tons > 0 ? peak.month.slice(0, 3) : "—"}
            </span>
          </div>
        </div>
        <hr className="border-t border-dashed border-border/70 mb-2" />

        {/* Grid-bar chart — recharts BarChart with the GridBarShape +
            GridBarBackground primitives from @evilcharts/grid-bar-chart. */}
        {peak.tons > 0 ? (
          <ChartContainer config={chartConfig} className="flex-1 min-h-[80px] w-full">
            <BarChart
              accessibilityLayer
              data={monthly}
              margin={{ top: 4, right: 0, left: 0, bottom: 0 }}
            >
              <XAxis
                dataKey="month"
                tickLine={false}
                tickMargin={4}
                axisLine={false}
                tick={{ fontSize: 9, fill: "currentColor", opacity: 0.6 }}
                tickFormatter={(v: string) => v.slice(0, 3)}
                interval={0}
              />
              <Bar
                dataKey="tons"
                fill="var(--color-tons-0)"
                background={GridBarBackground}
                shape={GridBarShape}
                activeBar={GridBarShape}
              />
            </BarChart>
          </ChartContainer>
        ) : (
          <div className="flex-1 grid place-items-center text-[10.5px] text-muted-foreground/70">
            Veri yok
          </div>
        )}
      </div>
    </BentoTile>
  );
}
