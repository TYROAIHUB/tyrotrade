import type { Project } from "@/lib/dataverse/entities";
import {
  selectActualBooked,
  selectCargoValueUsd,
  selectEstimateTotal,
  selectStage,
  selectTotalKg,
  type RouteStage,
} from "./project";
import { selectProjectPL } from "./profitLoss";

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

/* ─────────── Estimated P&L (cross-project) ─────────── */

export interface EstimatedPLAggregate {
  /** USD-denominated rollup. Non-USD projects skipped (currency-safety). */
  salesTotalUsd: number;
  purchaseTotalUsd: number;
  expenseTotalUsd: number;
  pl: number;
  marginPct: number;
  /** Projects that contributed to the USD rollup (currency === "USD"). */
  contributingCount: number;
  /** Projects skipped because non-USD pricing (kept for transparency). */
  nonUsdCount: number;
}

/**
 * Roll up estimated P&L across projects. Currency-safe: only projects
 * priced in USD contribute to the global numbers; non-USD projects are
 * counted separately so the UI can disclose "X projeler USD dışı, dönüşüm
 * uygulanmadı" without silently mis-summing.
 */
export function aggregateEstimatedPL(projects: Project[]): EstimatedPLAggregate {
  let salesTotalUsd = 0;
  let purchaseTotalUsd = 0;
  let expenseTotalUsd = 0;
  let contributingCount = 0;
  let nonUsdCount = 0;
  for (const p of projects) {
    const pl = selectProjectPL(p);
    if (pl.salesTotal <= 0 && pl.purchaseTotal <= 0) continue;
    if (pl.currency === "USD") {
      salesTotalUsd += pl.salesTotal;
      purchaseTotalUsd += pl.purchaseTotal;
      expenseTotalUsd += pl.expenseTotal;
      contributingCount++;
    } else {
      nonUsdCount++;
    }
  }
  const pl = salesTotalUsd - purchaseTotalUsd - expenseTotalUsd;
  const marginPct = salesTotalUsd > 0 ? (pl / salesTotalUsd) * 100 : 0;
  return {
    salesTotalUsd,
    purchaseTotalUsd,
    expenseTotalUsd,
    pl,
    marginPct,
    contributingCount,
    nonUsdCount,
  };
}

/* ─────────── Margin distribution ─────────── */

export interface MarginBuckets {
  /** marginPct > 5% — healthy */
  positive: number;
  /** -5% ≤ marginPct ≤ 5% — borderline */
  marginal: number;
  /** marginPct < -5% — at-risk / loss */
  negative: number;
  /** No margin reference (salesTotal ≤ 0) */
  unknown: number;
}

export function aggregateMarginDistribution(projects: Project[]): MarginBuckets {
  const out: MarginBuckets = {
    positive: 0,
    marginal: 0,
    negative: 0,
    unknown: 0,
  };
  for (const p of projects) {
    const pl = selectProjectPL(p);
    if (pl.marginPct == null) {
      out.unknown++;
      continue;
    }
    if (pl.marginPct > 5) out.positive++;
    else if (pl.marginPct >= -5) out.marginal++;
    else out.negative++;
  }
  return out;
}

/* ─────────── Currency exposure ─────────── */

export type CurrencyCode = "USD" | "EUR" | "TRY" | "OTHER";

export interface CurrencyBreakdown {
  /** Project count in this currency */
  count: number;
  /** Sum of cargo value in the native currency (NOT FX-converted) */
  totalNative: number;
}

export interface CurrencyExposure {
  byCurrency: Record<CurrencyCode, CurrencyBreakdown>;
  /** Currency with the most projects */
  dominant: CurrencyCode;
  /** Concentration index — Σ(share²); 1 = single currency, 1/n = perfect mix */
  hhi: number;
  totalProjects: number;
}

export function aggregateCurrencyExposure(projects: Project[]): CurrencyExposure {
  const byCurrency: Record<CurrencyCode, CurrencyBreakdown> = {
    USD: { count: 0, totalNative: 0 },
    EUR: { count: 0, totalNative: 0 },
    TRY: { count: 0, totalNative: 0 },
    OTHER: { count: 0, totalNative: 0 },
  };
  for (const p of projects) {
    const c = (p.lines[0]?.currency ?? p.currency ?? "OTHER") as string;
    const key: CurrencyCode =
      c === "USD" || c === "EUR" || c === "TRY" ? c : "OTHER";
    byCurrency[key].count++;
    // Native-currency sum: lines × unitPrice
    let total = 0;
    for (const l of p.lines) {
      if (l.unitPrice > 0 && l.quantityKg > 0) {
        total += (l.quantityKg / 1000) * l.unitPrice;
      }
    }
    byCurrency[key].totalNative += total;
  }
  const totalProjects = projects.length;
  let hhi = 0;
  let dominant: CurrencyCode = "USD";
  let dominantCount = -1;
  for (const k of ["USD", "EUR", "TRY", "OTHER"] as CurrencyCode[]) {
    const cnt = byCurrency[k].count;
    if (totalProjects > 0) {
      const share = cnt / totalProjects;
      hhi += share * share;
    }
    if (cnt > dominantCount) {
      dominantCount = cnt;
      dominant = k;
    }
  }
  return { byCurrency, dominant, hhi, totalProjects };
}

/* ─────────── Velocity (transit days) ─────────── */

export interface VelocityStats {
  avgDays: number;
  minDays: number;
  maxDays: number;
  /** Projects that contributed (have both endpoints). */
  sampleSize: number;
}

/**
 * Average transit time, in days, between the loading-end milestone (lpEd
 * preferred, blDate fallback) and the discharge-arrival milestone (dpEta
 * preferred, dpNorAccepted fallback). Projects missing either endpoint
 * are skipped.
 */
export function aggregateAvgTransitDays(projects: Project[]): VelocityStats {
  let sum = 0;
  let min = Infinity;
  let max = -Infinity;
  let sampleSize = 0;
  for (const p of projects) {
    const ms = p.vesselPlan?.milestones;
    if (!ms) continue;
    const startIso = ms.lpEd ?? ms.blDate ?? null;
    const endIso = ms.dpEta ?? ms.dpNorAccepted ?? null;
    if (!startIso || !endIso) continue;
    const start = new Date(startIso).getTime();
    const end = new Date(endIso).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
    const days = (end - start) / (1000 * 60 * 60 * 24);
    sum += days;
    if (days < min) min = days;
    if (days > max) max = days;
    sampleSize++;
  }
  return {
    avgDays: sampleSize > 0 ? sum / sampleSize : 0,
    minDays: sampleSize > 0 ? min : 0,
    maxDays: sampleSize > 0 ? max : 0,
    sampleSize,
  };
}

/* ─────────── Counterparty mix ─────────── */

export interface CounterpartyRow {
  name: string;
  role: "supplier" | "buyer";
  count: number;
  totalCargoValueUsd: number;
}

export interface CounterpartyMix {
  suppliers: CounterpartyRow[];
  buyers: CounterpartyRow[];
  /** Concentration index: Σ(share²) of supplier counts. Higher = riskier. */
  supplierHHI: number;
  /** Concentration index: Σ(share²) of buyer counts. Higher = riskier. */
  buyerHHI: number;
}

function buildCounterpartyTable(
  projects: Project[],
  pickName: (p: Project) => string | undefined,
  role: "supplier" | "buyer"
): { rows: CounterpartyRow[]; hhi: number } {
  const map = new Map<string, CounterpartyRow>();
  let total = 0;
  for (const p of projects) {
    const name = (pickName(p) ?? "").trim();
    if (!name) continue;
    total++;
    const existing = map.get(name);
    const cv = selectCargoValueUsd(p);
    if (existing) {
      existing.count++;
      existing.totalCargoValueUsd += cv;
    } else {
      map.set(name, { name, role, count: 1, totalCargoValueUsd: cv });
    }
  }
  let hhi = 0;
  if (total > 0) {
    for (const r of map.values()) {
      const share = r.count / total;
      hhi += share * share;
    }
  }
  return {
    rows: [...map.values()].sort((a, b) => b.count - a.count),
    hhi,
  };
}

export function aggregateCounterpartyMix(projects: Project[]): CounterpartyMix {
  const sup = buildCounterpartyTable(
    projects,
    (p) => p.vesselPlan?.supplier,
    "supplier"
  );
  const buy = buildCounterpartyTable(
    projects,
    (p) => p.vesselPlan?.buyer,
    "buyer"
  );
  return {
    suppliers: sup.rows,
    buyers: buy.rows,
    supplierHHI: sup.hhi,
    buyerHHI: buy.hhi,
  };
}

/* ─────────── Top-N by various metrics ─────────── */

/** Top N by `salesActualUsd` (realised invoiced sales). */
export function topBySalesActual<T extends Project>(
  projects: T[],
  n: number
): Array<T & { salesActualUsd: number }> {
  return projects
    .map((p) => ({ ...p, salesActualUsd: p.salesActualUsd ?? 0 }))
    .filter((r) => r.salesActualUsd > 0)
    .sort((a, b) => b.salesActualUsd - a.salesActualUsd)
    .slice(0, n);
}

/** Top N by estimated total expense (highest cost = "El Yakan"). */
export function topByExpense<T extends Project>(
  projects: T[],
  n: number
): Array<T & { expenseTotalUsd: number }> {
  return projects
    .map((p) => ({ ...p, expenseTotalUsd: selectEstimateTotal(p) }))
    .filter((r) => r.expenseTotalUsd > 0)
    .sort((a, b) => b.expenseTotalUsd - a.expenseTotalUsd)
    .slice(0, n);
}

/** Top N by P&L margin %. `dir="asc"` = lowest (worst) first; "desc" = highest. */
export function topByMargin<T extends Project>(
  projects: T[],
  n: number,
  dir: "asc" | "desc"
): Array<T & { marginPct: number; pl: number; salesTotal: number }> {
  const enriched = projects
    .map((p) => {
      const pl = selectProjectPL(p);
      return { ...p, marginPct: pl.marginPct ?? 0, pl: pl.pl, salesTotal: pl.salesTotal };
    })
    // Need a sales reference for margin to be meaningful
    .filter((r) => r.salesTotal > 0);
  enriched.sort((a, b) =>
    dir === "asc" ? a.marginPct - b.marginPct : b.marginPct - a.marginPct
  );
  return enriched.slice(0, n);
}
