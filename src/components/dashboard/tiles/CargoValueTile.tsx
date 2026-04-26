import { motion, useReducedMotion } from "framer-motion";
import { CoinsDollarIcon } from "@hugeicons/core-free-icons";
import { BentoTile } from "../BentoTile";
import { AnimatedNumber } from "../AnimatedNumber";
import { aggregateCargoValueUsd } from "@/lib/selectors/aggregate";
import type { Project } from "@/lib/dataverse/entities";

interface CargoValueTileProps {
  projects: Project[];
  span?: string;
  rowSpan?: string;
}

export function CargoValueTile({
  projects,
  span,
  rowSpan,
}: CargoValueTileProps) {
  const reduceMotion = useReducedMotion();
  const totalUsd = aggregateCargoValueUsd(projects);

  return (
    <BentoTile
      title="Toplam Ürün Bedeli"
      subtitle={`${projects.length} proje toplamı`}
      icon={CoinsDollarIcon}
      iconColor="#c8922a"
      span={span}
      rowSpan={rowSpan}
    >
      <div className="relative flex items-end h-full overflow-hidden">
        {/* Subtle gradient sweep behind the number */}
        {!reduceMotion && (
          <motion.div
            aria-hidden
            className="absolute inset-0 pointer-events-none rounded-md"
            initial={{ opacity: 0, x: "-30%" }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
            style={{
              background:
                "linear-gradient(120deg, transparent 30%, rgba(224,173,62,0.10) 55%, transparent 80%)",
            }}
          />
        )}
        <div className="relative flex items-baseline gap-1">
          <span className="text-[32px] font-semibold leading-none tracking-tight text-amber-700">
            <AnimatedNumber value={totalUsd} preset="currency" currency="USD" />
          </span>
        </div>
      </div>
    </BentoTile>
  );
}
