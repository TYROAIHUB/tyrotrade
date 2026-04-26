import { motion, useReducedMotion, type Variants } from "framer-motion";
import { ActivePipelineTile } from "./tiles/ActivePipelineTile";
import { TonnageInTransitTile } from "./tiles/TonnageInTransitTile";
import { CargoValueTile } from "./tiles/CargoValueTile";
import { BudgetPulseTile } from "./tiles/BudgetPulseTile";
import type { Project } from "@/lib/dataverse/entities";

interface BentoGridProps {
  projects: Project[];
  now?: Date;
}

const containerVariants: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.06, delayChildren: 0.05 },
  },
};

/**
 * Bento Grid 2.0 — premium dashboard tile arrangement.
 *
 * Phase 1 layout (asymmetric, 12-col responsive):
 *
 *   <640px:  single column stack
 *   640-1023:  3+3 / 6 layout (2 rows)
 *   ≥1024:    [ActivePipeline 6×1] [Tonnage 3×1] [CargoVal 3×1]
 *             [BudgetPulse 12×1                                 ]
 *
 * Phase 2 will prepend a hero row (FleetAtGlance + NextArrival)
 * and shift ActivePipeline to col-span-3 row-span-2.
 *
 * The container `motion.div` orchestrates a staggered fade-up-blur
 * reveal on mount. Tiles inherit `tileVariants` from BentoTile.
 */
export function BentoGrid({ projects, now = new Date() }: BentoGridProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      variants={reduceMotion ? undefined : containerVariants}
      initial="hidden"
      animate="show"
      className="grid grid-cols-12 grid-rows-[auto_auto] gap-3"
      aria-label="Operasyon özeti"
    >
      <ActivePipelineTile
        projects={projects}
        now={now}
        span="col-span-12 sm:col-span-12 md:col-span-6 lg:col-span-6"
      />
      <TonnageInTransitTile
        projects={projects}
        now={now}
        span="col-span-12 sm:col-span-6 md:col-span-3 lg:col-span-3"
      />
      <CargoValueTile
        projects={projects}
        span="col-span-12 sm:col-span-6 md:col-span-3 lg:col-span-3"
      />
      <BudgetPulseTile
        projects={projects}
        span="col-span-12"
      />
    </motion.section>
  );
}
