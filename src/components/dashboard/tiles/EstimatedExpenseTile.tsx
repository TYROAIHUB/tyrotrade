import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Wallet01Icon } from "@hugeicons/core-free-icons";
import { BentoTile } from "../BentoTile";
import { AnimatedNumber } from "../AnimatedNumber";
import type { Project } from "@/lib/dataverse/entities";

interface EstimatedExpenseTileProps {
  projects: Project[];
  span?: string;
  rowSpan?: string;
}

/**
 * Tahmini Gider tile — sums `costEstimateLines.totalUsd` grouped by the
 * actual F&O category name (`mserp_tryexpensetype@FormattedValue`, e.g.
 * "freight", "opex", "Operasyonel giderler"). No translation, no
 * bucketing — what F&O stores is what we render. Top-5 categories are
 * shown explicitly; anything beyond the top-5 collapses into "other"
 * so the visualisation stays scannable on a 4-col tile.
 *
 * Domain colour: rose (cost / drag on margin).
 */
export function EstimatedExpenseTile({
  projects,
  span,
  rowSpan,
}: EstimatedExpenseTileProps) {
  const reduce = useReducedMotion();
  const { categories, total } = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const p of projects) {
      const lines = p.costEstimateLines;
      if (!lines) continue;
      for (const l of lines) {
        if (!l.totalUsd) continue;
        map.set(l.name, (map.get(l.name) ?? 0) + l.totalUsd);
      }
    }
    const sorted = [...map.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    const total = sorted.reduce((s, r) => s + r.value, 0);
    // Top-5 explicit, rest collapsed
    const top = sorted.slice(0, 5);
    const restSum = sorted.slice(5).reduce((s, r) => s + r.value, 0);
    const categories =
      restSum > 0 ? [...top, { name: "other", value: restSum }] : top;
    return { categories, total };
  }, [projects]);

  // Distinct palette — rose-leaning but with enough variety so adjacent
  // bars are clearly different in the stacked bar chart.
  const PALETTE = [
    "#f97316", // orange
    "#a855f7", // purple
    "#06b6d4", // cyan
    "#10b981", // emerald
    "#f59e0b", // amber
    "#64748b", // slate (overflow / "other")
  ];

  return (
    <BentoTile
      title="Tahmini Gider"
      subtitle="F&O kategori dağılımı · USD"
      icon={Wallet01Icon}
      iconColor="rgb(244 63 94)"
      span={span}
      rowSpan={rowSpan}
    >
      <div className="flex flex-col gap-2.5 h-full">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[26px] font-semibold leading-none tracking-tight text-rose-700">
            <AnimatedNumber value={total} preset="currency" currency="USD" />
          </span>
        </div>

        {/* Stacked bar — one segment per actual F&O category */}
        {total > 0 ? (
          <div className="mt-auto flex flex-col gap-2">
            <div className="relative h-2 w-full rounded-full overflow-hidden bg-foreground/[0.06]">
              {categories.map((c, i) => {
                const offset = categories
                  .slice(0, i)
                  .reduce(
                    (acc, prev) => acc + (prev.value / total) * 100,
                    0
                  );
                const pct = (c.value / total) * 100;
                if (pct === 0) return null;
                return (
                  <motion.span
                    key={c.name}
                    initial={reduce ? { width: `${pct}%` } : { width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{
                      duration: 0.55,
                      delay: 0.1 + i * 0.07,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    className="absolute top-0 h-full"
                    style={{
                      left: `${offset}%`,
                      backgroundColor: PALETTE[i % PALETTE.length],
                    }}
                  />
                );
              })}
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
              {categories.map((c, i) => (
                <div
                  key={c.name}
                  className="flex items-center gap-1.5 min-w-0"
                  title={c.name}
                >
                  <span
                    className="size-1.5 rounded-full shrink-0"
                    style={{
                      backgroundColor: PALETTE[i % PALETTE.length],
                    }}
                  />
                  <span className="text-muted-foreground truncate">
                    {c.name}
                  </span>
                  <span className="font-semibold tabular-nums text-foreground ml-auto shrink-0">
                    {((c.value / total) * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-auto text-[10.5px] text-muted-foreground/70">
            Gider tahmini henüz tanımlı değil
          </div>
        )}
      </div>
    </BentoTile>
  );
}
