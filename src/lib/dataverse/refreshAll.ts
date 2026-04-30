import { getDataverseClient } from "@/lib/dataverse";
import { readCache, writeCache } from "@/lib/storage/entityCache";
import {
  PROJECT_COLUMNS,
  PROJECT_LINE_COLUMNS,
  SHIP_COLUMNS,
  EXPENSE_COLUMNS,
  BUDGET_COLUMNS,
} from "@/lib/dataverse/columnOrder";

/**
 * Standalone Dataverse refresh — fetches the 6 cached entity sets +
 * the 2 sales aggregates and writes each result to localStorage.
 *
 * Mirrors the `refreshSteps` logic inside `DataManagementPage` but
 * without depending on the per-entity `useEntityRows` hooks, so it
 * can be invoked from anywhere (e.g. the post-login auto-refresh
 * mounted in `AppShell`).
 *
 * Each successful `writeCache` dispatches the `tyro:cache-updated`
 * event, which `useRealProjects.useCacheFingerprint` listens for —
 * so views currently on screen (Dashboard, Vessel Projects) re-derive
 * automatically once the relevant slot lands.
 *
 * 🔒 READ-ONLY — only GET via `client.list` / `client.listAll`.
 */

const TRADER = (import.meta.env.VITE_PROJECT_TRADER_FILTER as string | undefined) ?? "";

/**
 * Server-side filter for the Projects header fetch. Reads "all
 * sea-mode projects with a non-empty segment", which is the operational
 * scope the dashboard cares about. The optional `TRADER` env var is
 * still honoured (when set, narrows further to that trader's books)
 * but is no longer the primary axis — production runs leave it empty.
 */
function buildProjectsFilter(): string {
  const clauses = [
    "mserp_dlvmode eq 'Gemi'",
    "mserp_tryprojectsegment ne null",
  ];
  if (TRADER) clauses.push(`mserp_maintraderid eq '${TRADER}'`);
  return clauses.join(" and ");
}

/** Human-readable summary of the active project scope — surfaced in
 *  the RefreshAllButton tooltip so users know exactly which slice of
 *  F&O they're pulling. */
export function describeProjectFilter(): string {
  const lines = [
    "• Teslimat şekli (mserp_dlvmode) = Gemi",
    "• Segment (mserp_tryprojectsegment) dolu (boş olmayan)",
  ];
  if (TRADER) lines.push(`• Trader (mserp_maintraderid) = ${TRADER}`);
  return lines.join("\n");
}

const ENTITY_SETS = {
  projects: "mserp_etgtryprojecttableentities",
  ship: "mserp_tryaiprojectshiprelationentities",
  lines: "mserp_tryaiprojectlineentities",
  expense: "mserp_tryaiotherexpenseentities",
  budget: "mserp_tryaiprojectbudgetlineentities",
} as const;

const SALES_ENTITY = "mserp_tryaicustinvoicetransentities";

export interface RefreshProgress {
  /** 1-based step index. */
  step: number;
  totalSteps: number;
  label: string;
}

export interface RefreshResult {
  ok: boolean;
  /** Step labels that completed successfully. */
  completedSteps: string[];
  /** Label of the step that failed (when `ok=false`). */
  failedStep?: string;
  /** Network or parse error message surfaced to the user. */
  errorMessage?: string;
  /** Wall-clock duration in milliseconds. */
  durationMs: number;
  /** Project header rows fetched in the first step — surfaced to the
   *  toast so the user sees "437 proje senkronlandı". `undefined`
   *  when the projects step never ran (very first failure). */
  projectCount?: number;
}

/* ─────────── Filter helper ─────────── */

function buildInFilter(field: string, projids: string[]): string {
  if (projids.length === 0) {
    // Empty list — return nothing rather than blowing up the server.
    return `${field} eq null`;
  }
  return `Microsoft.Dynamics.CRM.In(PropertyName='${field}',PropertyValues=[${projids
    .map((p) => `'${p}'`)
    .join(",")}])`;
}

function readProjids(): string[] {
  const cached = readCache<Record<string, unknown>>(ENTITY_SETS.projects);
  return (cached?.value ?? [])
    .map((p) => p.mserp_projid as string | undefined)
    .filter((s): s is string => !!s);
}

/* ─────────── Main entry ─────────── */

/**
 * Run the full sequential refresh. Returns when every step has either
 * succeeded or one has thrown. Caller fires the toast.
 *
 * On the first failure the loop stops and `RefreshResult.failedStep`
 * carries the offending step's label — partial caches written before
 * the failure stay in localStorage (so a partial refresh is still
 * useful to the user).
 */
export async function refreshAllEntities(
  onProgress?: (p: RefreshProgress) => void
): Promise<RefreshResult> {
  const startedAt = Date.now();
  const client = getDataverseClient();
  const completed: string[] = [];
  let projectCount: number | undefined;

  type Step = { label: string; run: () => Promise<void> };

  const steps: Step[] = [
    {
      label: "Projeler",
      run: async () => {
        const result = await client.listAll<Record<string, unknown>>(
          ENTITY_SETS.projects,
          {
            $filter: buildProjectsFilter(),
            $select: PROJECT_COLUMNS.join(","),
            $count: true,
          }
        );
        writeCache(ENTITY_SETS.projects, {
          fetchedAt: new Date().toISOString(),
          value: result.value,
          totalCount: result.totalCount,
        });
        // Capture for the success toast — prefer the server's `$count`
        // total when present, fall back to in-memory length otherwise.
        projectCount = result.totalCount ?? result.value.length;
      },
    },
    {
      label: "Proje Satırları",
      run: async () => {
        const projids = readProjids();
        const result = await client.listAll<Record<string, unknown>>(
          ENTITY_SETS.lines,
          {
            $filter: buildInFilter("mserp_projid", projids),
            $select: PROJECT_LINE_COLUMNS.join(","),
            $count: true,
          }
        );
        writeCache(ENTITY_SETS.lines, {
          fetchedAt: new Date().toISOString(),
          value: result.value,
          totalCount: result.totalCount,
        });
      },
    },
    {
      label: "Gemi Planı",
      run: async () => {
        const projids = readProjids();
        const result = await client.listAll<Record<string, unknown>>(
          ENTITY_SETS.ship,
          {
            $filter: buildInFilter("mserp_tryshipprojid", projids),
            $select: SHIP_COLUMNS.join(","),
            $count: true,
          }
        );
        writeCache(ENTITY_SETS.ship, {
          fetchedAt: new Date().toISOString(),
          value: result.value,
          totalCount: result.totalCount,
        });
      },
    },
    {
      label: "Tahmini Gider",
      run: async () => {
        const projids = readProjids();
        const result = await client.listAll<Record<string, unknown>>(
          ENTITY_SETS.expense,
          {
            $filter: buildInFilter("mserp_etgtryprojid", projids),
            $select: EXPENSE_COLUMNS.join(","),
            $count: true,
          }
        );
        writeCache(ENTITY_SETS.expense, {
          fetchedAt: new Date().toISOString(),
          value: result.value,
          totalCount: result.totalCount,
        });
      },
    },
    {
      label: "Tahmini Bütçe",
      run: async () => {
        const result = await client.listAll<Record<string, unknown>>(
          ENTITY_SETS.budget,
          {
            $select: BUDGET_COLUMNS.join(","),
            $count: true,
          }
        );
        writeCache(ENTITY_SETS.budget, {
          fetchedAt: new Date().toISOString(),
          value: result.value,
          totalCount: result.totalCount,
        });
      },
    },
    {
      label: "Satış Toplamları",
      run: async () => {
        // Sales aggregate now scopes to the project IDs already pulled
        // in the first step (which themselves come from the
        // dlvmode/segment filter). Drops the old trader-only narrow so
        // every project we display has its sales total available.
        const projids = readProjids();
        const inClause =
          projids.length > 0
            ? `Microsoft.Dynamics.CRM.In(PropertyName='mserp_etgtryprojid',PropertyValues=[${projids.map((p) => `'${p}'`).join(",")}])`
            : "mserp_etgtryprojid eq null";
        const apply = `filter(${inClause})/groupby((mserp_etgtryprojid,mserp_currencycode),aggregate(mserp_lineamount with sum as total,$count as cnt))`;
        const result = await client.list<Record<string, unknown>>(
          SALES_ENTITY,
          { $apply: apply }
        );
        writeCache("salesAggregateByProject", {
          fetchedAt: new Date().toISOString(),
          value: result.value,
        });
      },
    },
    {
      label: "Proje × Ay Satış",
      run: async () => {
        const projids = readProjids();
        const projidClause =
          projids.length > 0
            ? `Microsoft.Dynamics.CRM.In(PropertyName='mserp_etgtryprojid',PropertyValues=[${projids.map((p) => `'${p}'`).join(",")}])`
            : "mserp_etgtryprojid eq null";
        const result = await client.listAll<Record<string, unknown>>(
          SALES_ENTITY,
          {
            $filter: `${projidClause} and mserp_currencycode eq 'USD'`,
            $select:
              "mserp_etgtryprojid,mserp_invoicedate,mserp_lineamount",
            $count: true,
          }
        );
        writeCache("salesByProjectMonth", {
          fetchedAt: new Date().toISOString(),
          value: result.value,
          totalCount: result.totalCount,
        });
      },
    },
  ];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    onProgress?.({ step: i + 1, totalSteps: steps.length, label: step.label });
    try {
      await step.run();
      completed.push(step.label);
    } catch (err) {
      return {
        ok: false,
        completedSteps: completed,
        failedStep: step.label,
        errorMessage: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - startedAt,
        projectCount,
      };
    }
  }

  return {
    ok: true,
    completedSteps: completed,
    durationMs: Date.now() - startedAt,
    projectCount,
  };
}
