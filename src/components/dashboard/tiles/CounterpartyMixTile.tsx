import * as React from "react";
import { UserGroupIcon } from "@hugeicons/core-free-icons";
import { BentoTile } from "../BentoTile";
import { TONE_COUNTERPARTY } from "@/components/details/AccentIconBadge";
import { useThemeAccent } from "@/components/layout/theme-accent";
import { aggregateCounterpartyMix } from "@/lib/selectors/aggregate";
import type { Project } from "@/lib/dataverse/entities";

interface CounterpartyMixTileProps {
  projects: Project[];
  span?: string;
  rowSpan?: string;
  onClick?: () => void;
}

/**
 * Counterparty mix — top suppliers + top buyers with concentration HHI.
 * Trading houses watch this metric to flag credit/payment exposure on a
 * single name; HHI > 0.25 = single-counterparty critical.
 */
export function CounterpartyMixTile({
  projects,
  span,
  rowSpan,
  onClick,
}: CounterpartyMixTileProps) {
  const accent = useThemeAccent();
  const mix = React.useMemo(
    () => aggregateCounterpartyMix(projects),
    [projects]
  );
  const topSupplier = mix.suppliers[0];
  const topBuyer = mix.buyers[0];
  const totalSup = mix.suppliers.reduce((s, r) => s + r.count, 0);
  const totalBuy = mix.buyers.reduce((s, r) => s + r.count, 0);
  const supShare =
    totalSup > 0 && topSupplier ? topSupplier.count / totalSup : 0;
  const buyShare = totalBuy > 0 && topBuyer ? topBuyer.count / totalBuy : 0;

  return (
    <BentoTile
      title="Karşı Taraf Dağılımı"
      subtitle="Tedarikçi + alıcı konsantrasyonu"
      icon={UserGroupIcon}
      iconTone={TONE_COUNTERPARTY}
      span={span}
      rowSpan={rowSpan}
      onClick={onClick}
    >
      <div className="flex flex-col gap-2 h-full text-[10.5px]">
        {/* Top supplier row */}
        <div
          className="flex flex-col gap-0.5 min-w-0"
          title={
            topSupplier
              ? `En büyük tedarikçi — ${topSupplier.name}: ${topSupplier.count} proje (%${(supShare * 100).toFixed(1)}). HHI ${(mix.supplierHHI * 100).toFixed(0)} — < 15: çeşitli, 15-25: orta, > 25: yoğun.`
              : "Tedarikçi verisi yok"
          }
        >
          <div
            className="text-[9.5px] uppercase tracking-wider font-semibold"
            style={{ color: accent.stops[2], opacity: 0.75 }}
          >
            Tedarikçi
          </div>
          <div className="flex items-baseline justify-between gap-2 min-w-0">
            <span className="truncate font-semibold text-foreground/95">
              {topSupplier?.name ?? "—"}
            </span>
            <span
              className="shrink-0 tabular-nums font-bold"
              style={{ color: accent.solid }}
            >
              {(supShare * 100).toFixed(0)}%
            </span>
          </div>
          <div className="tabular-nums text-foreground/65 font-medium">
            HHI {(mix.supplierHHI * 100).toFixed(0)} ·{" "}
            {mix.suppliers.length} taraf
          </div>
        </div>

        <div className="border-t border-border/40 my-0.5" />

        {/* Top buyer row */}
        <div
          className="flex flex-col gap-0.5 min-w-0"
          title={
            topBuyer
              ? `En büyük alıcı — ${topBuyer.name}: ${topBuyer.count} proje (%${(buyShare * 100).toFixed(1)}). HHI ${(mix.buyerHHI * 100).toFixed(0)} — < 15: çeşitli, 15-25: orta, > 25: yoğun.`
              : "Alıcı verisi yok"
          }
        >
          <div
            className="text-[9.5px] uppercase tracking-wider font-semibold"
            style={{ color: accent.stops[2], opacity: 0.75 }}
          >
            Alıcı
          </div>
          <div className="flex items-baseline justify-between gap-2 min-w-0">
            <span className="truncate font-semibold text-foreground/95">
              {topBuyer?.name ?? "—"}
            </span>
            <span
              className="shrink-0 tabular-nums font-bold"
              style={{ color: accent.solid }}
            >
              {(buyShare * 100).toFixed(0)}%
            </span>
          </div>
          <div className="tabular-nums text-foreground/65 font-medium">
            HHI {(mix.buyerHHI * 100).toFixed(0)} · {mix.buyers.length} taraf
          </div>
        </div>
      </div>
    </BentoTile>
  );
}
