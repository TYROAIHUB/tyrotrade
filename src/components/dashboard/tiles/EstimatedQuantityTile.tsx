import * as React from "react";
import { CubeIcon } from "@hugeicons/core-free-icons";
import { BentoTile } from "../BentoTile";
import { AnimatedNumber } from "../AnimatedNumber";
import { selectTotalKg, selectTotalTons } from "@/lib/selectors/project";
import type { Project } from "@/lib/dataverse/entities";

interface EstimatedQuantityTileProps {
  projects: Project[];
  span?: string;
  rowSpan?: string;
}

/**
 * Tahmini Miktar tile — period-scoped tonnage (sum of `lines.quantityKg`
 * / 1000 across the filtered project set). Surfaces the top-3 product
 * groups (level1) by tonnage as inline mini-bars so the user knows where
 * the bulk sits.
 *
 * Domain colour: emerald (production / volume).
 */
export function EstimatedQuantityTile({
  projects,
  span,
  rowSpan,
}: EstimatedQuantityTileProps) {
  const totalTons = React.useMemo(
    () => projects.reduce((sum, p) => sum + selectTotalTons(p), 0),
    [projects]
  );

  const topProducts = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const p of projects) {
      const totalKg = selectTotalKg(p);
      if (totalKg <= 0) continue;
      // Use the dominant level1 of the project's lines (first non-empty).
      const lvl =
        p.lines.find((l) => l.level1?.trim())?.level1?.trim() || "Diğer";
      map.set(lvl, (map.get(lvl) ?? 0) + totalKg);
    }
    const rows = [...map.entries()]
      .map(([name, kg]) => ({ name, tons: kg / 1000 }))
      .sort((a, b) => b.tons - a.tons)
      .slice(0, 3);
    return rows;
  }, [projects]);

  const maxTons = topProducts[0]?.tons ?? 1;

  return (
    <BentoTile
      title="Tahmini Miktar"
      subtitle="Toplam tonaj · ürün dağılımı"
      icon={CubeIcon}
      iconColor="rgb(16 185 129)"
      span={span}
      rowSpan={rowSpan}
    >
      <div className="flex flex-col gap-2.5 h-full">
        <div className="flex items-baseline gap-1">
          <span className="text-[28px] font-semibold leading-none tracking-tight text-emerald-700">
            <AnimatedNumber value={totalTons} preset="tons" />
          </span>
        </div>

        {topProducts.length > 0 ? (
          <div className="mt-auto flex flex-col gap-1.5">
            {topProducts.map((row) => {
              const pct = (row.tons / maxTons) * 100;
              return (
                <div key={row.name} className="min-w-0">
                  <div className="flex items-baseline justify-between gap-2 text-[10.5px] mb-0.5">
                    <span className="truncate text-foreground/85 font-medium">
                      {row.name}
                    </span>
                    <span className="tabular-nums text-muted-foreground shrink-0">
                      {row.tons >= 1000
                        ? `${(row.tons / 1000).toFixed(1)} bin t`
                        : `${row.tons.toFixed(0)} t`}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-foreground/[0.06] overflow-hidden">
                    <span
                      className="block h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        background:
                          "linear-gradient(90deg, #10b981, #34d399)",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-auto text-[10.5px] text-muted-foreground/70">
            Veri yok
          </div>
        )}
      </div>
    </BentoTile>
  );
}
