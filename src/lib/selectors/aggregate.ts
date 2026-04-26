import type { Project } from "@/lib/dataverse/entities";
import {
  selectActualBooked,
  selectCargoValueUsd,
  selectEstimateTotal,
  selectStage,
  selectTotalKg,
  type RouteStage,
} from "./project";

/**
 * Cross-project aggregations — pure, memoizable, reusable.
 *
 * These power the Dashboard bento tiles (ActivePipeline, TonnageInTransit,
 * CargoValue, BudgetPulse) and the future Data Inspector rollups.
 */

/* ─────────── Stage distribution ─────────── */

export type StageCounts = Record<RouteStage, number> & {
  /** Projects with no vesselPlan at all */
  unscheduled: number;
};

export function aggregateByStage(
  projects: Project[],
  now: Date = new Date()
): StageCounts {
  const counts: StageCounts = {
    "pre-loading": 0,
    "at-loading-port": 0,
    loading: 0,
    "in-transit": 0,
    "at-discharge-port": 0,
    discharged: 0,
    unscheduled: 0,
  };
  for (const p of projects) {
    const stage = selectStage(p, now);
    if (stage === null) counts.unscheduled++;
    else counts[stage]++;
  }
  return counts;
}

/** Bento tile-friendly grouping: loading | in-transit | at-discharge. */
export function aggregatePipelineBuckets(
  projects: Project[],
  now: Date = new Date()
): { loading: number; inTransit: number; atDischarge: number } {
  const c = aggregateByStage(projects, now);
  return {
    loading: c.loading + c["at-loading-port"],
    inTransit: c["in-transit"],
    atDischarge: c["at-discharge-port"],
  };
}

/* ─────────── In-transit tonnage ─────────── */

const IN_TRANSIT_STAGES = new Set<RouteStage>([
  "loading",
  "at-loading-port",
  "in-transit",
  "at-discharge-port",
]);

/** Sum of `lines.quantityKg` for projects whose vessels are actively moving. */
export function aggregateInTransitKg(
  projects: Project[],
  now: Date = new Date()
): { kg: number; projectCount: number } {
  let kg = 0;
  let projectCount = 0;
  for (const p of projects) {
    const stage = selectStage(p, now);
    if (stage && IN_TRANSIT_STAGES.has(stage)) {
      kg += selectTotalKg(p);
      projectCount++;
    }
  }
  return { kg, projectCount };
}

/* ─────────── Cargo value ─────────── */

/** Total cargo value (USD) across all given projects. */
export function aggregateCargoValueUsd(projects: Project[]): number {
  return projects.reduce((sum, p) => sum + selectCargoValueUsd(p), 0);
}

/* ─────────── Budget ─────────── */

export interface BudgetAggregate {
  estimate: number;
  actual: number;
  variance: number;
  variancePct: number;
  /** Projects that have BOTH costEstimate AND actualCost — used to scope */
  contributingCount: number;
}

export function aggregateBudget(projects: Project[]): BudgetAggregate {
  let estimate = 0;
  let actual = 0;
  let contributingCount = 0;
  for (const p of projects) {
    if (p.costEstimate || p.actualCost) {
      estimate += selectEstimateTotal(p);
      actual += selectActualBooked(p);
      contributingCount++;
    }
  }
  const variance = estimate - actual;
  const variancePct = estimate > 0 ? (variance / estimate) * 100 : 0;
  return { estimate, actual, variance, variancePct, contributingCount };
}

/* ─────────── Top by cargo value ─────────── */

/** Top N projects by cargo value (descending). */
export function topByCargoValue<T extends Project>(
  projects: T[],
  n: number
): Array<T & { cargoValueUsd: number }> {
  return projects
    .map((p) => ({ ...p, cargoValueUsd: selectCargoValueUsd(p) }))
    .sort((a, b) => b.cargoValueUsd - a.cargoValueUsd)
    .slice(0, n);
}

/* ─────────── Route corridor ─────────── */

export interface CorridorRow {
  loadingPort: string;
  dischargePort: string;
  count: number;
  totalCargoValueUsd: number;
}

/** Group projects by `loadingPort.name → dischargePort.name`. */
export function aggregateByCorridor(projects: Project[]): CorridorRow[] {
  const map = new Map<string, CorridorRow>();
  for (const p of projects) {
    const lp = p.vesselPlan?.loadingPort.name;
    const dp = p.vesselPlan?.dischargePort.name;
    if (!lp || !dp) continue;
    const key = `${lp}__${dp}`;
    const existing = map.get(key);
    if (existing) {
      existing.count++;
      existing.totalCargoValueUsd += selectCargoValueUsd(p);
    } else {
      map.set(key, {
        loadingPort: lp,
        dischargePort: dp,
        count: 1,
        totalCargoValueUsd: selectCargoValueUsd(p),
      });
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}
