import * as React from "react";
import { MoneyExchange01Icon } from "@hugeicons/core-free-icons";
import { BentoTile } from "../BentoTile";
import { useThemeAccent } from "@/components/layout/theme-accent";
import {
  aggregateCurrencyExposure,
  type CurrencyCode,
} from "@/lib/selectors/aggregate";
import type { Project } from "@/lib/dataverse/entities";

interface CurrencyExposureTileProps {
  projects: Project[];
  span?: string;
  rowSpan?: string;
}

const ORDER: CurrencyCode[] = ["USD", "EUR", "TRY", "OTHER"];
const COLORS: Record<CurrencyCode, string> = {
  USD: "#10b981",
  EUR: "#3b82f6",
  TRY: "#f59e0b",
  OTHER: "#94a3b8",
};

/**
 * Currency exposure tile — counts of projects per pricing currency
 * (USD/EUR/TRY/OTHER), with a concentration index (HHI) so the user
 * sees how diversified the FX-risk portfolio is.
 *
 * No FX conversion — sums are kept in their native currency to avoid
 * introducing fake precision (Tiryaki has no in-app rate table yet).
 */
export function CurrencyExposureTile({
  projects,
  span,
  rowSpan,
}: CurrencyExposureTileProps) {
  const accent = useThemeAccent();
  const exposure = React.useMemo(
    () => aggregateCurrencyExposure(projects),
    [projects]
  );

  // Convert HHI 0..1 to a "diversification score" — closer to 1/n is
  // healthier (n=4 here → ideal HHI = 0.25). We display the raw
  // concentration index for reading, but flag any single-currency
  // dominance > 70%.
  const dominantShare =
    exposure.totalProjects > 0
      ? exposure.byCurrency[exposure.dominant].count / exposure.totalProjects
      : 0;

  return (
    <BentoTile
      title="Para Birimi Maruziyeti"
      subtitle="FX riski yoğunluğu"
      icon={MoneyExchange01Icon}
      iconColor={accent.solid}
      span={span}
      rowSpan={rowSpan}
    >
      <div className="flex flex-col gap-2 h-full">
        {/* Dominant currency callout */}
        <div className="flex items-baseline gap-2">
          <span
            className="text-[24px] font-semibold leading-none tracking-tight tabular-nums"
            style={{ color: COLORS[exposure.dominant] }}
          >
            {exposure.dominant}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {(dominantShare * 100).toFixed(0)}% dominant
          </span>
        </div>

        {/* Per-currency breakdown bars */}
        <div className="mt-auto flex flex-col gap-1.5">
          {ORDER.map((c) => {
            const cnt = exposure.byCurrency[c].count;
            if (cnt === 0) return null;
            const pct =
              exposure.totalProjects > 0
                ? (cnt / exposure.totalProjects) * 100
                : 0;
            return (
              <div key={c} className="min-w-0">
                <div className="flex items-baseline justify-between gap-2 text-[10.5px] mb-0.5">
                  <span className="font-semibold tabular-nums text-foreground/85">
                    {c}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {cnt} proje · {pct.toFixed(0)}%
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-foreground/[0.06] overflow-hidden">
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: COLORS[c],
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Concentration warning when HHI is high */}
        {dominantShare > 0.7 && (
          <div className="text-[9.5px] text-amber-700 italic mt-1">
            Yoğunlaşma yüksek — {(dominantShare * 100).toFixed(0)}% tek para
            birimi
          </div>
        )}
      </div>
    </BentoTile>
  );
}
