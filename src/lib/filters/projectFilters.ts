import {
  applyPeriodFilter,
  DEFAULT_PERIOD,
  type PeriodKey,
} from "@/lib/dashboard/periods";
import { getCurrentFyKey } from "@/lib/dashboard/financialPeriod";
import { hasUsableShipPlan } from "@/lib/selectors/project";
import type { Project } from "@/lib/dataverse/entities";

/**
 * Unified filter state used by Dashboard, Vessel Projects, and Veri
 * Yönetimi. Replaces three different per-page filter shapes with a
 * single source of truth so a) the same UI components can drive each
 * page and b) future fields land in one place.
 *
 * Read-only — apply only narrows the project set; no Dataverse
 * mutation flows through here.
 */
export interface ProjectFilterState {
  /** Time-window selector. `fy` (default) plus a `fyKey` is the
   *  Tiryaki-conventional view; rolling presets (monthly/quarterly/
   *  yearly) and `all` cover ad-hoc lookups. */
  period: PeriodKey;
  /** When `period === "fy"`, which financial year ("25-26"). Null →
   *  resolved at apply time to the current FY. */
  fyKey: string | null;

  // Categorical multi-selects — Sets are O(1) and JSON-safe via
  // [...].
  statuses: Set<string>;
  groups: Set<string>;
  incoterms: Set<string>;
  segments: Set<string>;
  voyageStatuses: Set<string>;
  traders: Set<string>;
  companies: Set<string>;
  suppliers: Set<string>;
  buyers: Set<string>;
  vessels: Set<string>;
  /** Specific project codes (PRJ.../TRK...). Lets the user narrow
   *  down to a hand-picked list when they know exactly which projects
   *  they care about. Independent of route-driven `selectedId` —
   *  navigation never auto-populates this set. */
  projectNos: Set<string>;

  /** When false, projects without `vesselPlan` are dropped. Default
   *  varies per page — the dashboard wants inclusive (true), the
   *  Vessel Projects list wants operationally-scoped (false). */
  includeWithoutShipPlan: boolean;
}

interface MakeEmptyOptions {
  /** Per-page default for the ship-plan toggle. */
  includeWithoutShipPlan?: boolean;
}

export function makeEmptyFilters(
  opts: MakeEmptyOptions = {}
): ProjectFilterState {
  return {
    period: DEFAULT_PERIOD,
    fyKey: getCurrentFyKey(),
    statuses: new Set(),
    groups: new Set(),
    incoterms: new Set(),
    segments: new Set(),
    voyageStatuses: new Set(),
    traders: new Set(),
    companies: new Set(),
    suppliers: new Set(),
    buyers: new Set(),
    vessels: new Set(),
    projectNos: new Set(),
    includeWithoutShipPlan: opts.includeWithoutShipPlan ?? true,
  };
}

/** Apply the filter state to a list of projects. Period filter runs
 *  first (cheapest cull), categorical filters layer on top, ship-plan
 *  toggle is the cheapest no-op. */
export function applyProjectFilter(
  projects: Project[],
  f: ProjectFilterState,
  now: Date = new Date()
): Project[] {
  const periodFiltered = applyPeriodFilter(projects, f.period, f.fyKey, now);
  return periodFiltered.filter((p) => {
    if (!f.includeWithoutShipPlan && !hasUsableShipPlan(p)) return false;
    if (f.voyageStatuses.size > 0) {
      const vs = p.vesselPlan?.vesselStatus ?? "";
      if (!f.voyageStatuses.has(vs)) return false;
    }
    if (f.statuses.size > 0 && !f.statuses.has(p.status)) return false;
    if (f.groups.size > 0 && !f.groups.has(p.projectGroup)) return false;
    if (f.incoterms.size > 0 && !f.incoterms.has(p.incoterm)) return false;
    if (f.segments.size > 0) {
      if (!p.segment || !f.segments.has(p.segment)) return false;
    }
    if (f.traders.size > 0 && !f.traders.has(p.traderNo)) return false;
    if (
      f.companies.size > 0 &&
      !f.companies.has(p.vesselPlan?.companyId ?? "")
    )
      return false;
    if (f.suppliers.size > 0) {
      const sup = (p.vesselPlan?.supplier ?? "").trim();
      if (!f.suppliers.has(sup)) return false;
    }
    if (f.buyers.size > 0) {
      const buy = (p.vesselPlan?.buyer ?? "").trim();
      if (!f.buyers.has(buy)) return false;
    }
    if (f.vessels.size > 0) {
      const ves = (p.vesselPlan?.vesselName ?? "").trim();
      if (!f.vessels.has(ves)) return false;
    }
    if (f.projectNos.size > 0 && !f.projectNos.has(p.projectNo)) return false;
    return true;
  });
}

/** Active-filter chip count. Period in default state (FY + current FY)
 *  doesn't count; any deviation does. ShipPlan toggle counts when set
 *  to its non-default value (depends on caller's default). */
export function projectFilterCount(
  f: ProjectFilterState,
  shipPlanDefault: boolean = true
): number {
  const periodActive =
    f.period !== DEFAULT_PERIOD ||
    (f.period === "fy" && f.fyKey !== null && f.fyKey !== getCurrentFyKey());
  return (
    f.statuses.size +
    f.groups.size +
    f.incoterms.size +
    f.segments.size +
    f.voyageStatuses.size +
    f.traders.size +
    f.companies.size +
    f.suppliers.size +
    f.buyers.size +
    f.vessels.size +
    f.projectNos.size +
    (f.includeWithoutShipPlan === shipPlanDefault ? 0 : 1) +
    (periodActive ? 1 : 0)
  );
}

/** Distinct sorted values per filter field. Computed once per project
 *  list reference and reused by the AdvancedFilter combobox sections. */
export interface AvailableOptions {
  statuses: string[];
  groups: string[];
  incoterms: string[];
  segments: string[];
  voyageStatuses: string[];
  traders: string[];
  companies: string[];
  suppliers: string[];
  buyers: string[];
  vessels: string[];
  /** Project options carry the full {value, label, keywords} shape so
   *  the combobox can show "PRJ000123 — 55KMT BRZ SOY" as the label
   *  while storing only the projectNo in the selection Set, and
   *  cmdk's search matches against both code and name keywords. */
  projects: Array<{ value: string; label: string; keywords: string[]; sub?: string }>;
}

export function extractAvailableOptions(
  projects: Project[]
): AvailableOptions {
  const s = new Set<string>();
  const g = new Set<string>();
  const i = new Set<string>();
  const seg = new Set<string>();
  const vs = new Set<string>();
  const tr = new Set<string>();
  const co = new Set<string>();
  const sup = new Set<string>();
  const buy = new Set<string>();
  const ves = new Set<string>();
  for (const p of projects) {
    if (p.status) s.add(p.status);
    if (p.projectGroup) g.add(p.projectGroup);
    if (p.incoterm) i.add(p.incoterm);
    if (p.segment) seg.add(p.segment);
    if (p.vesselPlan?.vesselStatus) vs.add(p.vesselPlan.vesselStatus);
    if (p.traderNo) tr.add(p.traderNo);
    if (p.vesselPlan?.companyId) co.add(p.vesselPlan.companyId);
    const supplier = p.vesselPlan?.supplier?.trim();
    if (supplier) sup.add(supplier);
    const buyer = p.vesselPlan?.buyer?.trim();
    if (buyer) buy.add(buyer);
    const vessel = p.vesselPlan?.vesselName?.trim();
    if (vessel && vessel !== "—") ves.add(vessel);
  }
  // Project options — sorted by projectNo descending (newest IDs
  // surface first; F&O assigns these monotonically). Keywords mix
  // projectNo + projectName + segment so a search for "soybean" or
  // "international" or "PRJ123" all hit.
  const projectOptions = projects
    .map((p) => ({
      value: p.projectNo,
      label: `${p.projectNo} — ${truncate(p.projectName, 60)}`,
      keywords: [
        p.projectNo,
        p.projectName,
        p.segment ?? "",
        p.projectGroup ?? "",
        p.vesselPlan?.vesselName ?? "",
      ].filter(Boolean),
      sub: p.vesselPlan?.vesselName
        ? `Gemi: ${p.vesselPlan.vesselName}`
        : undefined,
    }))
    .sort((a, b) => b.value.localeCompare(a.value));

  return {
    statuses: [...s].sort(),
    groups: [...g].sort(),
    incoterms: [...i].sort(),
    segments: [...seg].sort(),
    voyageStatuses: [...vs].sort(),
    traders: [...tr].sort(),
    companies: [...co].sort(),
    suppliers: [...sup].sort(),
    buyers: [...buy].sort(),
    vessels: [...ves].sort(),
    projects: projectOptions,
  };
}

function truncate(s: string, max: number): string {
  const t = (s ?? "").trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + "…";
}
