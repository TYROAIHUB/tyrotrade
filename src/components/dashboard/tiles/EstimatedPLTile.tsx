import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Coins02Icon } from "@hugeicons/core-free-icons";
import { BentoTile } from "../BentoTile";
import { AnimatedNumber } from "../AnimatedNumber";
import {
  aggregateEstimatedPL,
  aggregateMarginDistribution,
} from "@/lib/selectors/aggregate";
import type { Project } from "@/lib/dataverse/entities";

interface EstimatedPLTileProps {
  projects: Project[];
  span?: string;
  rowSpan?: string;
}

/**
 * Tahmini P&L tile — USD-only rollup of (sales − purchase − expense).
 * Domain-fixed colours follow margin sign (emerald = healthy, rose =
 * loss, slate = neutral). Shows margin distribution as a 3-segment
 * bar (positive / marginal / negative) underneath the headline number.
 */
export function EstimatedPLTile({
  projects,
  span,
  rowSpan,
}: EstimatedPLTileProps) {
  const reduce = useReducedMotion();
  const pl = React.useMemo(() => aggregateEstimatedPL(projects), [projects]);
  const dist = React.useMemo(
    () => aggregateMarginDistribution(projects),
    [projects]
  );

  const positive = pl.pl > 0;
  const negative = pl.pl < 0;
  const tintColor = positive
    ? "rgb(4 120 87)"
    : negative
      ? "rgb(159 18 57)"
      : "rgb(71 85 105)";
  const iconColor = positive
    ? "rgb(16 185 129)"
    : negative
      ? "rgb(244 63 94)"
      : "rgb(100 116 139)";

  const totalDist =
    dist.positive + dist.marginal + dist.negative + dist.unknown;
  const segs =
    totalDist === 0
      ? null
      : [
          { key: "positive", value: dist.positive, color: "#10b981" },
          { key: "marginal", value: dist.marginal, color: "#94a3b8" },
          { key: "negative", value: dist.negative, color: "#f43f5e" },
        ];

  return (
    <BentoTile
      title="Tahmini K&Z"
      subtitle={`USD bazlı · ${pl.contributingCount} proje`}
      icon={Coins02Icon}
      iconColor={iconColor}
      span={span}
      rowSpan={rowSpan}
    >
      <div className="flex flex-col gap-2 h-full">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span
            className="text-[28px] font-semibold leading-none tracking-tight"
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
            className="text-[12px] font-semibold tabular-nums"
            style={{ color: tintColor }}
          >
            {pl.marginPct >= 0 ? "+" : ""}
            {pl.marginPct.toFixed(1)}%
          </span>
        </div>

        <div className="text-[10.5px] text-muted-foreground/80 leading-snug">
          Satış {((pl.salesTotalUsd / 1_000_000) || 0).toFixed(1)}M − Alım{" "}
          {((pl.purchaseTotalUsd / 1_000_000) || 0).toFixed(1)}M − Gider{" "}
          {((pl.expenseTotalUsd / 1_000_000) || 0).toFixed(1)}M
        </div>

        {/* Margin distribution stacked bar */}
        {segs && (
          <div className="mt-auto flex flex-col gap-1.5">
            <div className="relative h-1.5 w-full rounded-full overflow-hidden bg-foreground/[0.06]">
              {segs.map((s, i) => {
                const offset = segs
                  .slice(0, i)
                  .reduce(
                    (acc, prev) => acc + (prev.value / totalDist) * 100,
                    0
                  );
                const pct = (s.value / totalDist) * 100;
                if (pct === 0) return null;
                return (
                  <motion.span
                    key={s.key}
                    initial={reduce ? { width: `${pct}%` } : { width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{
                      duration: 0.6,
                      delay: 0.15 + i * 0.08,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    className="absolute top-0 h-full"
                    style={{ left: `${offset}%`, backgroundColor: s.color }}
                  />
                );
              })}
            </div>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <Legend dot="#10b981" label={`${dist.positive} kazanan`} />
              <Legend dot="#94a3b8" label={`${dist.marginal} marjinal`} />
              <Legend dot="#f43f5e" label={`${dist.negative} zararlı`} />
            </div>
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

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 truncate">
      <span
        className="size-1.5 rounded-full shrink-0"
        style={{ backgroundColor: dot }}
      />
      <span className="truncate">{label}</span>
    </span>
  );
}
