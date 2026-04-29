import * as React from "react";
import { MoneyExchange01Icon } from "@hugeicons/core-free-icons";
import { BentoTile } from "../BentoTile";
import { TONE_CURRENCY } from "@/components/details/AccentIconBadge";
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
  onClick?: () => void;
}

const ORDER: CurrencyCode[] = ["USD", "EUR", "TRY", "OTHER"];

/** Per-currency opacity stops — bars all use the live sidebar accent
 *  but step down through these alpha values so each currency reads as
 *  a distinct shade without leaving the accent palette. */
const SHADE_OPACITY: Record<CurrencyCode, number> = {
  USD: 1,
  EUR: 0.7,
  TRY: 0.45,
  OTHER: 0.25,
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
  onClick,
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
      iconTone={TONE_CURRENCY}
      span={span}
      rowSpan={rowSpan}
      onClick={onClick}
    >
      <div className="flex flex-col gap-2 h-full">
        {/* Dominant currency callout */}
        <div
          className="flex items-baseline gap-2"
          title={`Baskın para birimi — ${exposure.dominant}: ${exposure.byCurrency[exposure.dominant].count} proje (%${(dominantShare * 100).toFixed(1)}). Tek para birimine bağımlılık ne kadar yüksekse FX riski o kadar artar.`}
        >
          {/* Dominant code reads in the live sidebar accent so the
              tile's primary number tracks light/navy/black themes.
              Per-currency bars below keep their semantic palette so
              the user can still tell USD from EUR from TRY at a
              glance. */}
          <span
            className="text-[24px] font-semibold leading-none tracking-tight tabular-nums"
            style={{ color: accent.solid }}
          >
            {exposure.dominant}
          </span>
          <span
            className="text-[11px]"
            style={{ color: accent.solid, opacity: 0.6 }}
          >
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
              <div
                key={c}
                className="min-w-0"
                title={`${c} — ${cnt} proje · %${pct.toFixed(1)} pay`}
              >
                <div className="flex items-baseline justify-between gap-2 text-[10.5px] mb-0.5">
                  <span className="font-semibold tabular-nums text-foreground/85">
                    {c}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {cnt} proje · {pct.toFixed(0)}%
                  </span>
                </div>
                <div
                  className="h-2 w-full rounded-full overflow-hidden"
                  style={{
                    background: "rgba(15,23,42,0.06)",
                    boxShadow:
                      "inset 0 1px 1px 0 rgba(15,23,42,0.08), inset 0 -1px 0 0 rgba(255,255,255,0.6)",
                  }}
                >
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${pct}%`,
                      background: `linear-gradient(180deg, ${accent.solid} 0%, ${accent.solid} 55%, color-mix(in oklab, ${accent.solid} 75%, black 25%) 100%)`,
                      opacity: SHADE_OPACITY[c],
                      boxShadow:
                        "inset 0 1px 0 0 rgba(255,255,255,0.4), inset 0 -1px 0 0 rgba(0,0,0,0.08)",
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
