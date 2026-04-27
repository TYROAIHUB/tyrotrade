import { motion, useReducedMotion, type Variants } from "framer-motion";
import { ActivePipelineTile } from "./tiles/ActivePipelineTile";
import { PeriodPerformanceTile } from "./tiles/PeriodPerformanceTile";
import { EstimatedPLTile } from "./tiles/EstimatedPLTile";
import { EstimatedQuantityTile } from "./tiles/EstimatedQuantityTile";
import { EstimatedExpenseTile } from "./tiles/EstimatedExpenseTile";
import { CurrencyExposureTile } from "./tiles/CurrencyExposureTile";
import { CorridorConcentrationTile } from "./tiles/CorridorConcentrationTile";
import { VelocityTile } from "./tiles/VelocityTile";
import { CounterpartyMixTile } from "./tiles/CounterpartyMixTile";
import type { Project } from "@/lib/dataverse/entities";

interface BentoGridProps {
  projects: Project[];
  now?: Date;
}

const containerVariants: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.05, delayChildren: 0.05 },
  },
};

/**
 * Executive Bento Grid — premium 9-tile dashboard.
 *
 * Layout (12-col responsive, 3 rows on lg+):
 *
 *   Row 1: [PeriodPerformance HERO 6] [EstimatedPL 3] [EstimatedQuantity 3]
 *   Row 2: [EstimatedExpense 4]       [ActivePipeline 8]
 *   Row 3: [CurrencyExp 3] [Corridor 3] [Velocity 3] [Counterparty 3]
 *
 * Breakpoints:
 *   <sm   single column stack
 *   sm    2-up grid, hero 2-col
 *   md    same 2-up but compacter
 *   lg+   full 12-col bento
 *
 * Container `motion.div` orchestrates a staggered fade-up-blur reveal.
 * All tiles consume the same period-filtered `projects` array — no
 * separate state — so a filter change ripples uniformly.
 */
export function BentoGrid({ projects, now = new Date() }: BentoGridProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      variants={reduceMotion ? undefined : containerVariants}
      initial="hidden"
      animate="show"
      className="grid grid-cols-12 auto-rows-min gap-3"
      aria-label="Yönetici özeti"
    >
      {/* Row 1 — Hero + headline P&L + tonnage */}
      <PeriodPerformanceTile
        projects={projects}
        now={now}
        span="col-span-12 sm:col-span-12 lg:col-span-6"
      />
      <EstimatedPLTile
        projects={projects}
        span="col-span-12 sm:col-span-6 lg:col-span-3"
      />
      <EstimatedQuantityTile
        projects={projects}
        now={now}
        span="col-span-12 sm:col-span-6 lg:col-span-3"
      />

      {/* Row 2 — Expense breakdown + pipeline */}
      <EstimatedExpenseTile
        projects={projects}
        span="col-span-12 sm:col-span-12 lg:col-span-4"
      />
      <ActivePipelineTile
        projects={projects}
        now={now}
        span="col-span-12 sm:col-span-12 lg:col-span-8"
      />

      {/* Row 3 — Risk / portfolio composition KPIs */}
      <CurrencyExposureTile
        projects={projects}
        span="col-span-12 sm:col-span-6 lg:col-span-3"
      />
      <CorridorConcentrationTile
        projects={projects}
        span="col-span-12 sm:col-span-6 lg:col-span-3"
      />
      <VelocityTile
        projects={projects}
        span="col-span-12 sm:col-span-6 lg:col-span-3"
      />
      <CounterpartyMixTile
        projects={projects}
        span="col-span-12 sm:col-span-6 lg:col-span-3"
      />
    </motion.section>
  );
}
