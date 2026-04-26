import { CubeIcon } from "@hugeicons/core-free-icons";
import { BentoTile } from "../BentoTile";
import { AnimatedNumber } from "../AnimatedNumber";
import { selectTotalKg } from "@/lib/selectors/project";
import type { Project } from "@/lib/dataverse/entities";

interface TonnageInTransitTileProps {
  projects: Project[];
  now?: Date;
  span?: string;
  rowSpan?: string;
}

/**
 * Total tonnage across every project in scope (no in-transit filter). Sums
 * `lines.quantityKg` so the dashboard headline reflects the full scale of
 * what we're moving, not just what's currently afloat.
 */
export function TonnageInTransitTile({
  projects,
  span,
  rowSpan,
}: TonnageInTransitTileProps) {
  const totalKg = projects.reduce((s, p) => s + selectTotalKg(p), 0);
  const tons = totalKg / 1000;

  return (
    <BentoTile
      title="Toplam Tonaj"
      subtitle={`${projects.length} proje toplamı`}
      icon={CubeIcon}
      iconColor="#10b981"
      span={span}
      rowSpan={rowSpan}
    >
      <div className="flex items-end gap-2 h-full">
        <div className="flex items-baseline gap-1">
          <span className="text-[32px] font-semibold leading-none tracking-tight text-emerald-700">
            <AnimatedNumber value={tons} preset="kilo" />
          </span>
          <span className="text-[12px] font-medium text-muted-foreground">
            t
          </span>
        </div>
      </div>
    </BentoTile>
  );
}
