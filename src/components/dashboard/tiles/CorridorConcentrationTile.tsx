import * as React from "react";
import { Route01Icon } from "@hugeicons/core-free-icons";
import { BentoTile } from "../BentoTile";
import { aggregateByCorridor } from "@/lib/selectors/aggregate";
import type { Project } from "@/lib/dataverse/entities";

interface CorridorConcentrationTileProps {
  projects: Project[];
  span?: string;
  rowSpan?: string;
}

/**
 * Corridor concentration — the top loading→discharge corridors plus a
 * Herfindahl–Hirschman index of how concentrated the route portfolio is.
 *
 * HHI thresholds (commodity trading benchmark):
 *   < 0.15  diversified
 *   0.15-0.25  moderately concentrated
 *   > 0.25  critical concentration (single-corridor risk)
 */
export function CorridorConcentrationTile({
  projects,
  span,
  rowSpan,
}: CorridorConcentrationTileProps) {
  const corridors = React.useMemo(() => aggregateByCorridor(projects), [projects]);
  const totalRoutedProjects = React.useMemo(
    () => corridors.reduce((sum, c) => sum + c.count, 0),
    [corridors]
  );
  // HHI on corridor counts
  const hhi = React.useMemo(() => {
    if (totalRoutedProjects === 0) return 0;
    let sum = 0;
    for (const c of corridors) {
      const share = c.count / totalRoutedProjects;
      sum += share * share;
    }
    return sum;
  }, [corridors, totalRoutedProjects]);
  const top3 = corridors.slice(0, 3);

  const concentrationLabel =
    hhi < 0.15
      ? "Çeşitli"
      : hhi < 0.25
        ? "Orta"
        : "Yoğun";
  const concentrationColor =
    hhi < 0.15
      ? "rgb(4 120 87)"
      : hhi < 0.25
        ? "rgb(180 83 9)"
        : "rgb(159 18 57)";

  return (
    <BentoTile
      title="Koridor Konsantrasyonu"
      subtitle="LP→DP yoğunluğu"
      icon={Route01Icon}
      span={span}
      rowSpan={rowSpan}
    >
      <div className="flex flex-col gap-2 h-full">
        <div className="flex items-baseline gap-2">
          <span
            className="text-[24px] font-semibold leading-none tracking-tight tabular-nums"
            style={{ color: concentrationColor }}
          >
            {(hhi * 100).toFixed(0)}
          </span>
          <span
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: concentrationColor }}
          >
            {concentrationLabel}
          </span>
        </div>

        {top3.length > 0 ? (
          <div className="mt-auto flex flex-col gap-1">
            {top3.map((c, idx) => {
              const pct =
                totalRoutedProjects > 0
                  ? (c.count / totalRoutedProjects) * 100
                  : 0;
              return (
                <div
                  key={`${c.loadingPort}-${c.dischargePort}`}
                  className="flex items-baseline justify-between gap-2 text-[10.5px] min-w-0"
                >
                  <span className="truncate min-w-0 flex-1">
                    <span className="text-muted-foreground tabular-nums mr-1.5">
                      #{idx + 1}
                    </span>
                    <span className="text-foreground/85 font-medium">
                      {c.loadingPort}
                    </span>
                    <span className="text-muted-foreground"> → </span>
                    <span className="text-foreground/85 font-medium">
                      {c.dischargePort}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {c.count} · {pct.toFixed(0)}%
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-auto text-[10.5px] text-muted-foreground/70">
            Rota verisi yok
          </div>
        )}
      </div>
    </BentoTile>
  );
}
