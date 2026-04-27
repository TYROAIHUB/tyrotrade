import * as React from "react";
import { CubeIcon } from "@hugeicons/core-free-icons";
import { BentoTile } from "../BentoTile";
import { AnimatedNumber } from "../AnimatedNumber";
import { TONE_CARGO } from "@/components/details/AccentIconBadge";
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

interface MonthBucket {
  monthKey: string;
  monthLabel: string;
  tons: number;
}

/**
 * Tahmini Miktar tile — period-scoped tonnage with a small monthly
 * breakdown chart at the bottom. Total tonnage stays as the headline
 * number; the 12-bar grid chart underneath shows distribution across
 * the financial year (Jul → Jun).
 *
 * Domain colour: amber / cargo. Bar intensity scales with the value's
 * percentile within the period, so heavy months read as deeper amber.
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
  const monthly = React.useMemo<MonthBucket[]>(() => {
    const fy = getFinancialYear(now);
    const buckets: MonthBucket[] = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(fy.startYear, 6 + i, 1);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const monthLabel = new Intl.DateTimeFormat("tr-TR", {
        month: "short",
      }).format(d);
      buckets.push({ monthKey, monthLabel, tons: 0 });
    }
    const indexByKey = new Map(buckets.map((b, i) => [b.monthKey, i]));
    for (const p of projects) {
      const t = new Date(p.projectDate);
      if (Number.isNaN(t.getTime())) continue;
      const key = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}`;
      const idx = indexByKey.get(key);
      if (idx !== undefined) buckets[idx].tons += selectTotalKg(p) / 1000;
    }
    return buckets;
  }, [projects, now]);

  const maxMonth = React.useMemo(
    () => monthly.reduce((m, b) => (b.tons > m ? b.tons : m), 0),
    [monthly]
  );

  return (
    <BentoTile
      title="Tahmini Miktar"
      subtitle="Toplam tonaj · ay bazlı dağılım"
      icon={CubeIcon}
      iconTone={TONE_CARGO}
      span={span}
      rowSpan={rowSpan}
    >
      <div className="flex flex-col gap-2 h-full">
        <div className="flex items-baseline gap-1">
          <span className="text-[28px] font-semibold leading-none tracking-tight text-amber-700">
            <AnimatedNumber value={totalTons} preset="tons" />
          </span>
        </div>

        {/* Monthly grid-bar chart — FY aligned (Jul → Jun) */}
        {maxMonth > 0 ? (
          <MiniGridBarChart data={monthly} max={maxMonth} />
        ) : (
          <div className="mt-auto text-[10.5px] text-muted-foreground/70">
            Veri yok
          </div>
        )}
      </div>
    </BentoTile>
  );
}

/* ─────────── Compact grid-bar chart ─────────── */

const CELL = 6; // square size px
const GAP = 2;
const STEP = CELL + GAP;
const CHART_HEIGHT = 64;
const COL_GAP = 4;

/**
 * Inline grid-bar chart — same visual grammar as `@evilcharts/grid-bar-chart`
 * but compact enough to fit a 3-col bento tile. Each month renders as a
 * vertical stack of small squares; cell colour scales by the bar's
 * percentile (low / mid / high) within the period.
 */
function MiniGridBarChart({
  data,
  max,
}: {
  data: MonthBucket[];
  max: number;
}) {
  const numCells = Math.floor(CHART_HEIGHT / STEP);
  // Three amber stops covering low → mid → high tonnage. None of them are
  // black; intensity is the only "level" cue (per user spec).
  const STOPS = ["#fcd34d", "#f59e0b", "#b45309"];
  const colorFor = (tons: number): string => {
    if (max <= 0) return STOPS[0];
    const ratio = tons / max;
    if (ratio < 0.34) return STOPS[0];
    if (ratio < 0.67) return STOPS[1];
    return STOPS[2];
  };
  return (
    <div className="mt-auto flex flex-col gap-1">
      <div className="flex items-end justify-between gap-[2px] h-[64px]">
        {data.map((b) => {
          const filled = max > 0 ? Math.round((b.tons / max) * numCells) : 0;
          const color = colorFor(b.tons);
          return (
            <div
              key={b.monthKey}
              className="flex-1 flex flex-col-reverse items-center justify-start"
              title={`${b.monthLabel}: ${b.tons.toFixed(0)} t`}
              style={{ gap: GAP }}
            >
              {Array.from({ length: numCells }).map((_, i) => {
                const isFilled = i < filled;
                return (
                  <span
                    key={i}
                    style={{
                      width: CELL,
                      height: CELL,
                      borderRadius: 1,
                      background: isFilled ? color : "rgba(15,23,42,0.06)",
                      boxShadow: isFilled
                        ? "inset 0 1px 0 0 rgba(255,255,255,0.4)"
                        : undefined,
                    }}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
      {/* Month labels under the bars */}
      <div
        className="flex justify-between text-[8.5px] text-muted-foreground tabular-nums"
        style={{ gap: COL_GAP }}
      >
        {data.map((b) => (
          <span
            key={`l-${b.monthKey}`}
            className="flex-1 text-center truncate"
          >
            {b.monthLabel}
          </span>
        ))}
      </div>
    </div>
  );
}
