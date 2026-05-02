import { getDataverseClient, type DataverseClient } from "@/lib/dataverse";
import type { ODataQuery } from "@/lib/dataverse/odata";
import { readCache, writeCache } from "@/lib/storage/entityCache";
import {
  PROJECT_COLUMNS,
  PROJECT_LINE_COLUMNS,
  SHIP_COLUMNS,
  EXPENSE_COLUMNS,
  // ACTUAL_EXPENSE_COLUMNS intentionally not imported — actualExpense
  // is fetched per-project on-demand from the inspector hook (see
  // DataManagementPage's `actualExpense` useEntityRows query). The
  // global refresh chain skips it to keep the localStorage cache
  // under quota.
  PURCHASE_COLUMNS,
  VESSEL_TABLE_COLUMNS,
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

/** Server-side filter for the Projects header fetch — sea-mode
 *  projects with a non-empty segment. Single source of truth for both
 *  the auto-refresh chain and the Veri Yönetimi inspector tab. */
const PROJECTS_FILTER =
  "mserp_dlvmode eq 'Gemi' and mserp_tryprojectsegment ne null";

/** Human-readable summary of the active project scope — surfaced in
 *  the RefreshAllButton tooltip so users know exactly which slice of
 *  F&O they're pulling. */
export function describeProjectFilter(): string {
  return [
    "• Teslimat şekli (mserp_dlvmode) = Gemi",
    "• Segment (mserp_tryprojectsegment) dolu (boş olmayan)",
  ].join("\n");
}

const ENTITY_SETS = {
  projects: "mserp_etgtryprojecttableentities",
  ship: "mserp_tryaiprojectshiprelationentities",
  lines: "mserp_tryaiprojectlineentities",
  expense: "mserp_tryaiotherexpenseentities",
  /** Realised expense distribution — what actually got booked against
   *  each project (vs. `expense` which is the upfront estimate). FK is
   *  `mserp_etgtryprojid`, same as the estimate table. */
  actualExpense: "mserp_tryaifrtexpenselinedistlineentities",
  /** Realised project purchases — vendor invoice transactions linked
   *  via the parent purchase table's project field
   *  `mserp_purchtable_etgtryprojid`. Counterpart of the customer-side
   *  sales `mserp_tryaicustinvoicetransentities`. */
  purchase: "mserp_tryaivendinvoicetransentities",
  /** Vessel master table — looked up by `mserp_vesseltable_recid`
   *  to enrich each ship-relation row with its real
   *  `mserp_vesselname` + `mserp_imonumber`. The ship entity itself
   *  carries only the numeric `mserp_vessel` RecID. */
  vesselTable: "mserp_tryvlxvesseltableentities",
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

/* ─────────── Vessel master enrichment ─────────── */

/**
 * Fetch the vessel-master entity tenant-wide AND enrich the cached
 * ship-relation rows with the looked-up `mserp_vesselname` +
 * `mserp_imonumber`. The vessel-master table is small (one row per
 * chartered vessel, ~hundreds), so a single tenant-wide list is
 * cheaper than per-row lookups during compose.
 *
 * Join key: ship row's `mserp_vessel` (numeric RecID) ===
 *           vessel master's `mserp_vesseltable_recid` (numeric RecID).
 *
 * After enrichment, the ship cache rows carry the friendly fields
 * directly — composer reads them as plain row keys and the Veri
 * Yönetimi inspector renders them via `SHIP_DISPLAY_COLUMNS`. Both
 * the post-login auto-refresh and the manual "Verileri Güncelle"
 * chain call this helper so the two paths stay aligned.
 */
export async function fetchVesselMasterAndEnrichShipCache(
  client: DataverseClient
): Promise<{ vesselCount: number; enrichedShipCount: number }> {
  // Fetch vessel master (tenant-wide, locked to 3 columns).
  const masterResult = await client.listAll<Record<string, unknown>>(
    ENTITY_SETS.vesselTable,
    {
      $select: VESSEL_TABLE_COLUMNS.join(","),
      $count: true,
    }
  );
  // Cache the master so the inspector can show it later if we add
  // a tab for it; also makes the data inspectable via DevTools.
  writeCache(ENTITY_SETS.vesselTable, {
    fetchedAt: new Date().toISOString(),
    value: masterResult.value,
    totalCount: masterResult.totalCount,
  });

  // Build recid → {vesselname, imonumber} index. Numeric RecIDs.
  const byRecid = new Map<
    number,
    { vesselname: string; imonumber: string }
  >();
  for (const v of masterResult.value) {
    const recid = Number(v["mserp_vesseltable_recid"]);
    if (!Number.isFinite(recid)) continue;
    byRecid.set(recid, {
      vesselname: String(v["mserp_vesselname"] ?? "").trim(),
      imonumber: String(v["mserp_imonumber"] ?? "").trim(),
    });
  }

  // Enrich the ship cache in place. If the cache hasn't been
  // populated yet (Gemi Planı step skipped or failed), bail —
  // there's nothing to enrich.
  const shipCache = readCache<Record<string, unknown>>(ENTITY_SETS.ship);
  if (!shipCache) {
    return { vesselCount: byRecid.size, enrichedShipCount: 0 };
  }
  let enrichedCount = 0;
  const enrichedRows = shipCache.value.map((r) => {
    const vesselRecid = Number(r["mserp_vessel"]);
    if (!Number.isFinite(vesselRecid)) return r;
    const match = byRecid.get(vesselRecid);
    if (!match) return r;
    enrichedCount++;
    return {
      ...r,
      mserp_vesselname: match.vesselname,
      mserp_imonumber: match.imonumber,
    };
  });
  writeCache(ENTITY_SETS.ship, {
    fetchedAt: shipCache.fetchedAt,
    value: enrichedRows,
    totalCount: shipCache.totalCount,
  });
  return { vesselCount: byRecid.size, enrichedShipCount: enrichedCount };
}

/* ─────────── Filter helpers ─────────── */

/**
 * OData filter clause that excludes intercompany invoice rows from
 * sales + purchase fetches. We never want intercompany trans rows in
 * the inspector or the calculations — they're internal transfers,
 * not realised customer/vendor activity. Single source of truth so
 * the same wording is used in every call site (auto-refresh, manual
 * refresh, per-project hooks, dashboard rollups).
 *
 * `eq null` is the OData v4 standard for "field unset"; F&O virtual
 * entities accept it on string columns. If a tenant ever surfaces
 * empty-string sentinels instead, widen this to
 * `(mserp_intercompanyinventtransid eq null or mserp_intercompanyinventtransid eq '')`.
 */
export const NON_INTERCOMPANY_FILTER =
  "mserp_intercompanyinventtransid eq null";

/** Maximum project IDs per `Microsoft.Dynamics.CRM.In(...)` clause.
 *
 *  At ~12 chars per project ID + URL-encoded quotes/commas (~22 chars
 *  per encoded ID), a single batch fits comfortably under Dataverse's
 *  ~16KB URL ceiling AND under the smaller proxy/CDN limits some
 *  enterprise networks impose between the browser and Dataverse.
 *
 *  Originally sized at 100; reduced to 50 after a follow-up 400 still
 *  hit the Gemi Planı step on `mserp_tryaiprojectshiprelationentities`
 *  with full chunks. F&O virtual entities can be touchier with large
 *  `In(...)` lists than regular Dataverse tables — 50 keeps each URL
 *  under ~1.5KB and gives the server a smaller working set per
 *  request. 440 projects → 9 sequential fetches, still fast. */
const PROJID_CHUNK_SIZE = 50;

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

/**
 * Run `client.listAll` once per chunk of project IDs and concatenate
 * the results. Drops a request URL of ~10KB+ down to ~2.5KB per call,
 * which keeps Dataverse + any proxy in the path happy. Returns the
 * combined value list and a summed `totalCount` for the success toast.
 *
 * Use this for any `mserp_*` child entity that's filtered by an IN
 * clause over the projects-cache project IDs (lines, ship, expense).
 */
export async function listAllByInChunked<T>(
  client: DataverseClient,
  entitySet: string,
  field: string,
  projids: string[],
  baseQuery: Omit<ODataQuery, "$filter">,
  chunkSize: number = PROJID_CHUNK_SIZE,
  /** Optional clause AND-ed onto the IN filter for every chunk —
   *  e.g. `mserp_intercompanyinventtransid eq null` for the sales /
   *  purchase fetches. Wrapped in parens so OR-chains at the caller
   *  side still bind correctly. */
  extraFilter?: string
): Promise<{ value: T[]; totalCount?: number }> {
  if (projids.length === 0) {
    // Empty list → no fetch (server would otherwise scan the entire entity).
    return { value: [], totalCount: 0 };
  }
  const all: T[] = [];
  let totalCount: number | undefined;
  for (let i = 0; i < projids.length; i += chunkSize) {
    const chunk = projids.slice(i, i + chunkSize);
    const inClause = buildInFilter(field, chunk);
    const $filter = extraFilter
      ? `${inClause} and (${extraFilter})`
      : inClause;
    const result = await client.listAll<T>(entitySet, {
      ...baseQuery,
      $filter,
    });
    all.push(...result.value);
    if (typeof result.totalCount === "number") {
      totalCount = (totalCount ?? 0) + result.totalCount;
    }
  }
  return { value: all, totalCount };
}

/**
 * Same chunking pattern but for `$apply` aggregates. Each chunk runs an
 * independent groupby so the (projid, currencycode) pairs can simply
 * be concatenated — they don't overlap across chunks since each project
 * lives in exactly one chunk.
 */
export async function applyByInChunked<T>(
  client: DataverseClient,
  entitySet: string,
  field: string,
  projids: string[],
  buildApply: (inClause: string) => string,
  chunkSize: number = PROJID_CHUNK_SIZE
): Promise<{ value: T[] }> {
  if (projids.length === 0) return { value: [] };
  const all: T[] = [];
  for (let i = 0; i < projids.length; i += chunkSize) {
    const chunk = projids.slice(i, i + chunkSize);
    const inClause = buildInFilter(field, chunk);
    const apply = buildApply(inClause);
    const result = await client.list<T>(entitySet, { $apply: apply });
    all.push(...result.value);
  }
  return { value: all };
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
            $filter: PROJECTS_FILTER,
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
        const result = await listAllByInChunked<Record<string, unknown>>(
          client,
          ENTITY_SETS.lines,
          "mserp_projid",
          projids,
          {
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
        // $select includes the full SHIP_COLUMNS list, with the
        // `_bigint` shadow lookups kept paired with their friendly
        // counterparts. F&O virtual entities resolve these as pairs
        // — separating them caused a "property not found" 400. Don't
        // re-touch the lookup section without re-testing.
        const projids = readProjids();
        const result = await listAllByInChunked<Record<string, unknown>>(
          client,
          ENTITY_SETS.ship,
          "mserp_tryshipprojid",
          projids,
          {
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
      // Vessel master lookup — runs RIGHT AFTER Gemi Planı so the
      // ship cache that the helper enriches is the freshly-written
      // one. Order matters; if Gemi Planı failed earlier in the
      // chain, this step has nothing to enrich and bails gracefully.
      label: "Gemi Bilgileri",
      run: async () => {
        await fetchVesselMasterAndEnrichShipCache(client);
      },
    },
    {
      label: "Tahmini Gider",
      run: async () => {
        const projids = readProjids();
        const result = await listAllByInChunked<Record<string, unknown>>(
          client,
          ENTITY_SETS.expense,
          "mserp_etgtryprojid",
          projids,
          {
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
    // NOTE: "Gerçekleşen Gider" intentionally OUT of the global
    // refresh chain. The entity is granular distribution lines and
    // its payload (~5-10 MB depending on tenant scope) blew the
    // browser localStorage quota when bundled alongside lines, ship,
    // expense, sales, etc. Inspector tab fetches per-project on
    // demand instead (same pattern as `sales` invoices). When the
    // dashboard later needs cross-project actual-expense rollups
    // we'll add a server-side `$apply=groupby` aggregate step here
    // — small per-project totals only.
    {
      label: "Gerçekleşen Satınalma",
      run: async () => {
        // Realised project purchases — vendor invoice transactions
        // joined via the parent purchase table's project FK
        // (`mserp_purchtable_etgtryprojid`). Narrowed to 12 columns the
        // inspector renders, chunked the same way as siblings so a
        // 440-project IN list never blows past the URL limit.
        // Intercompany rows excluded — see NON_INTERCOMPANY_FILTER.
        const projids = readProjids();
        const result = await listAllByInChunked<Record<string, unknown>>(
          client,
          ENTITY_SETS.purchase,
          "mserp_purchtable_etgtryprojid",
          projids,
          {
            $select: PURCHASE_COLUMNS.join(","),
            $count: true,
          },
          undefined,
          NON_INTERCOMPANY_FILTER
        );
        writeCache(ENTITY_SETS.purchase, {
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
        // Sales aggregate scopes to the project IDs already pulled in
        // the first step (which themselves come from the dlvmode/segment
        // filter). Chunked so the `$apply=filter(IN(...))` URL stays
        // small even when the project list is large.
        // Intercompany rows excluded — see NON_INTERCOMPANY_FILTER.
        const projids = readProjids();
        const result = await applyByInChunked<Record<string, unknown>>(
          client,
          SALES_ENTITY,
          "mserp_etgtryprojid",
          projids,
          (inClause) =>
            `filter((${inClause}) and (${NON_INTERCOMPANY_FILTER}))/groupby((mserp_etgtryprojid,mserp_currencycode),aggregate(mserp_lineamount with sum as total,$count as cnt))`
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
        // Per-project per-currency raw rows for the monthly USD timeline.
        // We can't push the `currencycode eq 'USD'` term into the chunked
        // helper's $filter directly because it builds the IN clause and
        // returns it as the entire $filter — so we layer the currency
        // gate by chunking ourselves and AND-ing the IN clause with it.
        const projids = readProjids();
        if (projids.length === 0) {
          writeCache("salesByProjectMonth", {
            fetchedAt: new Date().toISOString(),
            value: [],
            totalCount: 0,
          });
          return;
        }
        const all: Record<string, unknown>[] = [];
        let totalCount: number | undefined;
        for (let i = 0; i < projids.length; i += 100) {
          const chunk = projids.slice(i, i + 100);
          const inClause = buildInFilter("mserp_etgtryprojid", chunk);
          const result = await client.listAll<Record<string, unknown>>(
            SALES_ENTITY,
            {
              $filter: `${inClause} and mserp_currencycode eq 'USD' and (${NON_INTERCOMPANY_FILTER})`,
              $select:
                "mserp_etgtryprojid,mserp_invoicedate,mserp_lineamount",
              $count: true,
            }
          );
          all.push(...result.value);
          if (typeof result.totalCount === "number") {
            totalCount = (totalCount ?? 0) + result.totalCount;
          }
        }
        writeCache("salesByProjectMonth", {
          fetchedAt: new Date().toISOString(),
          value: all,
          totalCount,
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
