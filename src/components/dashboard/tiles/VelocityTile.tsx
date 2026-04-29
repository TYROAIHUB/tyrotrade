import * as React from "react";
import { Clock01Icon } from "@hugeicons/core-free-icons";
import { BentoTile } from "../BentoTile";
import { TONE_VELOCITY } from "@/components/details/AccentIconBadge";
import { useThemeAccent } from "@/components/layout/theme-accent";
import { aggregateAvgTransitDays } from "@/lib/selectors/aggregate";
import type { Project } from "@/lib/dataverse/entities";

interface VelocityTileProps {
  projects: Project[];
  span?: string;
  rowSpan?: string;
  onClick?: () => void;
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
  onClick,
}: VelocityTileProps) {
  const accent = useThemeAccent();
  const stats = React.useMemo(
    () => aggregateAvgTransitDays(projects),
    [projects]
  );

  return (
    <BentoTile
      title="Ortalama Transit"
      subtitle="LP-(ED) → DP-ETA"
      icon={Clock01Icon}
      iconTone={TONE_VELOCITY}
      span={span}
      rowSpan={rowSpan}
      onClick={onClick}
    >
      <div className="flex flex-col gap-2 h-full">
        <div
          className="flex items-baseline gap-1"
          title={`Ortalama transit — yükleme bitişi (LP-ED ya da BL) ile varış limanına ulaşma (DP-ETA) arasındaki gün farkı. ${stats.sampleSize} seferde ölçüldü.`}
        >
          {/* Plain text instead of AnimatedNumber so the "gün" suffix
              picks up the same accent colour as the digits. The
              previous AnimatedNumber wrapper rendered the suffix in
              muted-foreground (gray), which broke the user's
              expectation that the unit reads with the headline. */}
          <span
            className="text-[28px] font-semibold leading-none tracking-tight tabular-nums"
            style={{ color: accent.solid }}
          >
            {Math.round(stats.avgDays)}
            <span className="text-[16px] font-medium ml-1">gün</span>
          </span>
        </div>

        {stats.sampleSize > 0 ? (
          <div className="mt-auto flex flex-col gap-1.5">
            {/* Min / Max in the accent palette (lighter / mid stops),
                Örneklem stays a darker neutral so it reads as
                meta-info. None of these go faded-grey — every line
                stays comfortably readable. */}
            <div
              className="flex items-baseline justify-between gap-2 text-[10.5px]"
              title="En kısa transit süresi"
            >
              <span
                className="font-medium"
                style={{ color: accent.stops[0] }}
              >
                Min
              </span>
              <span
                className="font-semibold tabular-nums"
                style={{ color: accent.stops[0] }}
              >
                {Math.round(stats.minDays)} gün
              </span>
            </div>
            <div
              className="flex items-baseline justify-between gap-2 text-[10.5px]"
              title="En uzun transit süresi"
            >
              <span
                className="font-medium"
                style={{ color: accent.stops[2] }}
              >
                Max
              </span>
              <span
                className="font-semibold tabular-nums"
                style={{ color: accent.stops[2] }}
              >
                {Math.round(stats.maxDays)} gün
              </span>
            </div>
            <div
              className="flex items-baseline justify-between gap-2 text-[10px] text-foreground/65"
              title="LP-ED ve DP-ETA tarihlerinin ikisi de dolu olan sefer sayısı"
            >
              <span>Örneklem</span>
              <span className="tabular-nums">{stats.sampleSize} sefer</span>
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
