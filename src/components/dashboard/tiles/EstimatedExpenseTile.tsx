import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Wallet01Icon } from "@hugeicons/core-free-icons";
import { BentoTile } from "../BentoTile";
import { AnimatedNumber } from "../AnimatedNumber";
import { TONE_EXPENSE } from "@/components/details/AccentIconBadge";
import type { Project } from "@/lib/dataverse/entities";

interface EstimatedExpenseTileProps {
  projects: Project[];
  span?: string;
  rowSpan?: string;
}

type BucketKey = "freight" | "opex" | "other";

interface BucketStat {
  key: BucketKey;
  label: string;
  color: string;
  value: number;
}

/**
 * Tahmini Gider tile — sums `costEstimateLines.totalUsd` across all
 * projects, then collapses everything into three executive buckets:
 *   - **Freight**: anything matching "freight" / "navlun"
 *   - **Opex**: anything matching "opex" / "operasyonel"
 *   - **Other**: everything else (insurance, customs, port charges, …)
 *
 * Three side-by-side colour-coded chips sit under the stacked bar so
 * the dominant category is obvious without reading numbers.
 *
 * Domain colour: rose (cost / drag on margin).
 */
export function EstimatedExpenseTile({
  projects,
  span,
  rowSpan,
}: EstimatedExpenseTileProps) {
  const reduce = useReducedMotion();
  const buckets = React.useMemo<BucketStat[]>(() => {
    let freight = 0;
    let opex = 0;
    let other = 0;
    for (const p of projects) {
      const lines = p.costEstimateLines;
      if (!lines) continue;
      for (const l of lines) {
        if (!l.totalUsd) continue;
        const n = (l.name ?? "").toLowerCase();
        if (n.includes("freight") || n.includes("navlun")) {
          freight += l.totalUsd;
        } else if (n.includes("opex") || n.includes("operasyonel")) {
          opex += l.totalUsd;
        } else {
          other += l.totalUsd;
        }
      }
    }
    return [
      { key: "freight", label: "Freight", color: "#f97316", value: freight },
      { key: "opex", label: "Opex", color: "#a855f7", value: opex },
      { key: "other", label: "Other", color: "#64748b", value: other },
    ];
  }, [projects]);

  const total = buckets.reduce((s, b) => s + b.value, 0);

  return (
    <BentoTile
      title="Tahmini Gider"
      subtitle="Freight · Opex · Other · USD"
      icon={Wallet01Icon}
      iconTone={TONE_EXPENSE}
      span={span}
      rowSpan={rowSpan}
    >
      <div className="flex flex-col gap-2.5 h-full">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[26px] font-semibold leading-none tracking-tight text-rose-700">
            <AnimatedNumber value={total} preset="currency" currency="USD" />
          </span>
        </div>

        {/* Stacked bar — 3 segments, glossy gradient + inset highlight */}
        {total > 0 ? (
          <div className="mt-auto flex flex-col gap-2">
            <div
              className="relative h-2.5 w-full rounded-full overflow-hidden"
              style={{
                background: "rgba(15,23,42,0.06)",
                boxShadow:
                  "inset 0 1px 1px 0 rgba(15,23,42,0.08), inset 0 -1px 0 0 rgba(255,255,255,0.6)",
              }}
            >
              {buckets.map((b, i) => {
                const offset = buckets
                  .slice(0, i)
                  .reduce(
                    (acc, prev) => acc + (prev.value / total) * 100,
                    0
                  );
                const pct = (b.value / total) * 100;
                if (pct === 0) return null;
                return (
                  <motion.span
                    key={b.key}
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
                      background: `linear-gradient(180deg, ${b.color} 0%, ${b.color} 55%, color-mix(in oklab, ${b.color} 75%, black 25%) 100%)`,
                      boxShadow:
                        "inset 0 1px 0 0 rgba(255,255,255,0.4), inset 0 -1px 0 0 rgba(0,0,0,0.08)",
                    }}
                  />
                );
              })}
            </div>
            {/* 3-up legend chips under the bar */}
            <div className="grid grid-cols-3 gap-1.5">
              {buckets.map((b) => {
                const pct = (b.value / total) * 100;
                return (
                  <div
                    key={b.key}
                    className="flex flex-col gap-0.5 min-w-0"
                    title={b.label}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="size-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: b.color }}
                      />
                      <span className="text-[10px] text-muted-foreground truncate">
                        {b.label}
                      </span>
                    </div>
                    <span
                      className="text-[12px] font-bold tabular-nums leading-none"
                      style={{ color: b.color }}
                    >
                      {pct.toFixed(0)}%
                    </span>
                  </div>
                );
              })}
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
