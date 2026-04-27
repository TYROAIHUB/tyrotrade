import * as React from "react";
import { Clock01Icon } from "@hugeicons/core-free-icons";
import { BentoTile } from "../BentoTile";
import { AnimatedNumber } from "../AnimatedNumber";
import { aggregateAvgTransitDays } from "@/lib/selectors/aggregate";
import type { Project } from "@/lib/dataverse/entities";

interface VelocityTileProps {
  projects: Project[];
  span?: string;
  rowSpan?: string;
}

/**
 * Velocity tile — average transit days between loading-end (lpEd / blDate)
 * and discharge-arrival (dpEta / dpNorAccepted). Working-capital efficiency
 * proxy: faster cycles = sermaye dönüşü artar.
 *
 * Domain colour follows theme accent (operational, not P&L semantics).
 */
export function VelocityTile({
  projects,
  span,
  rowSpan,
}: VelocityTileProps) {
  const stats = React.useMemo(
    () => aggregateAvgTransitDays(projects),
    [projects]
  );

  return (
    <BentoTile
      title="Ortalama Transit"
      subtitle="LP-(ED) → DP-ETA"
      icon={Clock01Icon}
      span={span}
      rowSpan={rowSpan}
    >
      <div className="flex flex-col gap-2 h-full">
        <div className="flex items-baseline gap-1">
          <span className="text-[28px] font-semibold leading-none tracking-tight">
            <AnimatedNumber value={Math.round(stats.avgDays)} preset="days" />
          </span>
        </div>

        {stats.sampleSize > 0 ? (
          <div className="mt-auto flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-2 text-[10.5px]">
              <span className="text-muted-foreground">Min</span>
              <span className="font-semibold tabular-nums">
                {Math.round(stats.minDays)} gün
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-2 text-[10.5px]">
              <span className="text-muted-foreground">Max</span>
              <span className="font-semibold tabular-nums">
                {Math.round(stats.maxDays)} gün
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-2 text-[10px]">
              <span className="text-muted-foreground/80">Örneklem</span>
              <span className="text-muted-foreground tabular-nums">
                {stats.sampleSize} sefer
              </span>
            </div>
          </div>
        ) : (
          <div className="mt-auto text-[10.5px] text-muted-foreground/70">
            Tarihler eksik
          </div>
        )}
      </div>
    </BentoTile>
  );
}
