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

interface BucketStat {
  key: keyof BucketTotals;
  label: string;
  color: string;
  value: number;
}

interface BucketTotals {
  freightUsd: number;
  insuranceUsd: number;
  dutiesUsd: number;
  otherUsd: number;
}

/**
 * Tahmini Gider tile — sums `costEstimate` across projects, broken down
 * by the four operational buckets (freight / insurance / duties / other).
 * Renders a 4-segment horizontal stacked bar so dominant cost categories
 * are obvious at a glance, plus a chip legend underneath.
 *
 * Domain colour: rose (cost / drag on margin).
 */
export function EstimatedExpenseTile({
  projects,
  span,
  rowSpan,
}: EstimatedExpenseTileProps) {
  const reduce = useReducedMotion();
  const totals = React.useMemo<BucketTotals>(() => {
    const t: BucketTotals = {
      freightUsd: 0,
      insuranceUsd: 0,
      dutiesUsd: 0,
      otherUsd: 0,
    };
    for (const p of projects) {
      const ce = p.costEstimate;
      if (!ce) continue;
      t.freightUsd += ce.freightUsd ?? 0;
      t.insuranceUsd += ce.insuranceUsd ?? 0;
      t.dutiesUsd += ce.dutiesUsd ?? 0;
      t.otherUsd += ce.otherUsd ?? 0;
    }
    return t;
  }, [projects]);

  const total =
    totals.freightUsd + totals.insuranceUsd + totals.dutiesUsd + totals.otherUsd;
  const buckets: BucketStat[] = [
    {
      key: "freightUsd",
      label: "Navlun",
      color: "#f97316",
      value: totals.freightUsd,
    },
    {
      key: "insuranceUsd",
      label: "Sigorta",
      color: "#a855f7",
      value: totals.insuranceUsd,
    },
    {
      key: "dutiesUsd",
      label: "Gümrük",
      color: "#06b6d4",
      value: totals.dutiesUsd,
    },
    {
      key: "otherUsd",
      label: "Diğer",
      color: "#64748b",
      value: totals.otherUsd,
    },
  ];

  return (
    <BentoTile
      title="Tahmini Gider"
      subtitle="Bucket dağılımı · USD"
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

        {/* 4-bucket stacked bar */}
        {total > 0 ? (
          <div className="mt-auto flex flex-col gap-2">
            <div className="relative h-2 w-full rounded-full overflow-hidden bg-foreground/[0.06]">
              {buckets.map((b, i) => {
                const offset = buckets
                  .slice(0, i)
                  .reduce((acc, prev) => acc + (prev.value / total) * 100, 0);
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
                    style={{ left: `${offset}%`, backgroundColor: b.color }}
                  />
                );
              })}
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
              {buckets.map((b) => (
                <div
                  key={b.key}
                  className="flex items-center gap-1.5 min-w-0 truncate"
                >
                  <span
                    className="size-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: b.color }}
                  />
                  <span className="text-muted-foreground truncate">
                    {b.label}
                  </span>
                  <span className="font-semibold tabular-nums text-foreground ml-auto">
                    {((b.value / total) * 100).toFixed(0)}%
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
