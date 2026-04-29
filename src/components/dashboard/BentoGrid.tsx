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
import type { KpiId } from "./KpiDetailDrawer";
import type { Project } from "@/lib/dataverse/entities";

interface BentoGridProps {
  projects: Project[];
  now?: Date;
  /** Tile click handler — opens the KPI detail drawer. Each tile
   *  fires this with its identifier; DashboardPage uses it to render
   *  the appropriate breakdown view. */
  onSelectKpi?: (id: KpiId) => void;
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
 *   Row 2: [EstimatedExpense 3]       [ActivePipeline 9]
 *   Row 3: [CurrencyExp 3] [Corridor 3] [Velocity 3] [Counterparty 3]
 *
 * Each tile fires `onSelectKpi(id)` on click — the parent renders a
 * `KpiDetailDrawer` with the matching breakdown component.
 */
export function BentoGrid({ projects, now = new Date(), onSelectKpi }: BentoGridProps) {
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
        onClick={onSelectKpi ? () => onSelectKpi("period") : undefined}
      />
      <EstimatedPLTile
        projects={projects}
        now={now}
        span="col-span-12 sm:col-span-6 lg:col-span-3"
        onClick={onSelectKpi ? () => onSelectKpi("pl") : undefined}
      />
      <EstimatedQuantityTile
        projects={projects}
        now={now}
        span="col-span-12 sm:col-span-6 lg:col-span-3"
        onClick={onSelectKpi ? () => onSelectKpi("quantity") : undefined}
      />

      {/* Row 2 — Expense breakdown + pipeline */}
      <EstimatedExpenseTile
        projects={projects}
        span="col-span-12 sm:col-span-6 lg:col-span-3"
        onClick={onSelectKpi ? () => onSelectKpi("expense") : undefined}
      />
      <ActivePipelineTile
        projects={projects}
        now={now}
        span="col-span-12 sm:col-span-6 lg:col-span-9"
        onClick={onSelectKpi ? () => onSelectKpi("pipeline") : undefined}
      />

      {/* Row 3 — Risk / portfolio composition KPIs */}
      <CurrencyExposureTile
        projects={projects}
        span="col-span-12 sm:col-span-6 lg:col-span-3"
        onClick={onSelectKpi ? () => onSelectKpi("currency") : undefined}
      />
      <CorridorConcentrationTile
        projects={projects}
        span="col-span-12 sm:col-span-6 lg:col-span-3"
        onClick={onSelectKpi ? () => onSelectKpi("corridor") : undefined}
      />
      <VelocityTile
        projects={projects}
        span="col-span-12 sm:col-span-6 lg:col-span-3"
        onClick={onSelectKpi ? () => onSelectKpi("velocity") : undefined}
      />
      <CounterpartyMixTile
        projects={projects}
        span="col-span-12 sm:col-span-6 lg:col-span-3"
        onClick={onSelectKpi ? () => onSelectKpi("counterparty") : undefined}
      />
    </motion.section>
  );
}
