import * as React from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GlassPanel } from "@/components/glass/GlassPanel";
import { cn } from "@/lib/utils";
import { useEntityRows } from "@/hooks/useEntityRows";
import { getDataverseClient } from "@/lib/dataverse";
import { readCache, writeCache } from "@/lib/storage/entityCache";
import {
  EntityRowsTable,
  sortRows,
  type SortState,
} from "@/components/data-management/EntityRowsTable";
import { RefreshAllButton } from "@/components/data-management/RefreshAllButton";
import { TabStrip, type TabItem } from "@/components/data-management/TabStrip";
import { AdvancedFilter } from "@/components/filters/AdvancedFilter";
import {
  applyProjectFilter,
  makeEmptyFilters,
  type ProjectFilterState,
} from "@/lib/filters/projectFilters";
import { useProjects } from "@/hooks/useProjects";
import {
  PROJECT_COLUMNS,
  PROJECT_LINE_COLUMNS,
  SHIP_COLUMNS,
  EXPENSE_COLUMNS,
  SALES_COLUMNS,
  BUDGET_COLUMNS,
} from "@/lib/dataverse/columnOrder";

/* ─────────── Entity sets + filters ─────────── */

const TRADER = import.meta.env.VITE_PROJECT_TRADER_FILTER ?? "";

const ENTITY_SETS = {
  projects: "mserp_etgtryprojecttableentities",
  ship: "mserp_tryaiprojectshiprelationentities",
  lines: "mserp_tryaiprojectlineentities",
  // Switched April 2026 from `mserp_tryaiotherexpenseprojectlineentities`
  // (project-line variant) to this direct expense entity. Project FK is now
  // `mserp_etgtryprojid` instead of `mserp_tryplanprojectid`.
  expense: "mserp_tryaiotherexpenseentities",
  // Customer invoice transactions (posted invoices), filtered per-project.
  // Replaced earlier salesline entity which mostly carried the same data
  // but in unposted form; invoice trans are the realised "actual" sales.
  sales: "mserp_tryaicustinvoicetransentities",
  budget: "mserp_tryaiprojectbudgetlineentities",
} as const;

/* ─────────── Page ─────────── */

type TopTabKey = "projects" | "budget";
type ChildTabKey = "lines" | "ship" | "expense" | "sales";

export function DataManagementPage() {
  const [topTab, setTopTab] = React.useState<TopTabKey>("projects");
  const [childTab, setChildTab] = React.useState<ChildTabKey>("lines");

  // Unified Advanced Filter state — same shape as Dashboard / Vessel
  // Projects. Veri Yönetimi defaults to "all projects in" since the
  // page is for raw-row inspection, not operational triage.
  const [projectFilters, setProjectFilters] = React.useState<ProjectFilterState>(
    () => makeEmptyFilters({ includeWithoutShipPlan: true })
  );

  // Domain Project[] (already-composed) — used to derive the allowed
  // projectNo set after applying the unified filter, then narrow the
  // raw `projects.rows` accordingly. Keeps the Dataverse Inspector's
  // raw-row display unchanged while reusing the page-agnostic filter UI.
  const { projects: domainProjects } = useProjects();
  // Default sort: contractdate desc (newest first)
  const [projectSort, setProjectSort] = React.useState<SortState | null>({
    field: "mserp_contractdate",
    direction: "desc",
  });
  // Selection by stable project ID — survives filter/sort/tab changes so the
  // child panels + budget filter keep working when user explores other tabs.
  const [selectedProjId, setSelectedProjId] = React.useState<string | null>(
    null
  );

  // 🔒 5 entity hooks — read-only, manual trigger via "Verileri Güncelle"
  const projects = useEntityRows<Record<string, unknown>>({
    entitySet: ENTITY_SETS.projects,
    query: {
      ...(TRADER ? { $filter: `mserp_maintraderid eq '${TRADER}'` } : {}),
      // Only fetch the columns we display — drops mserp_isorganic and below
      // (sub-contract flags, financial dimensions, payment specs, etc.)
      $select: PROJECT_COLUMNS.join(","),
      $count: true,
    },
  });
  // $select on each child entity — only priority columns + their formatted-value
  // annotations come back. Reduces fetch payload + localStorage cache size so we
  // don't blow past the 5–10 MB browser quota (lines table alone has ~3000 rows).
  const ship = useEntityRows<Record<string, unknown>>({
    entitySet: ENTITY_SETS.ship,
    query: { $select: SHIP_COLUMNS.join(","), $count: true },
  });
  const lines = useEntityRows<Record<string, unknown>>({
    entitySet: ENTITY_SETS.lines,
    query: { $select: PROJECT_LINE_COLUMNS.join(","), $count: true },
  });
  const expense = useEntityRows<Record<string, unknown>>({
    entitySet: ENTITY_SETS.expense,
    query: { $select: EXPENSE_COLUMNS.join(","), $count: true },
  });
  // Customer invoice transactions — per-PROJECT server-side fetch. Entity
  // is huge tenant-wide (~2.4K invoiced rows for TRD-FTB alone, single
  // project can have 600+), so we filter to the selected project and pull
  // every matching invoice. No row cap — `listAll` paginates as needed.
  // Sorted by invoice date desc so the table reads newest-first.
  // Effect below auto-refetches when the user picks a different project.
  const sales = useEntityRows<Record<string, unknown>>({
    entitySet: ENTITY_SETS.sales,
    query: selectedProjId
      ? {
          $filter: `mserp_etgtryprojid eq '${selectedProjId}'`,
          $select: SALES_COLUMNS.join(","),
          $orderby: "mserp_invoicedate desc",
          $count: true,
        }
      : { $top: 0 },
  });

  // Auto-fetch sales when the selected project changes. The hook memoises
  // `refetch` by entitySet + JSON(query) so the latest closure is invoked.
  React.useEffect(() => {
    if (selectedProjId) {
      void sales.refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjId]);
  const budget = useEntityRows<Record<string, unknown>>({
    entitySet: ENTITY_SETS.budget,
    query: { $select: BUDGET_COLUMNS.join(","), $count: true },
  });

  /* Sequential refresh steps — RefreshAllButton fires these in order.
   *
   * Strategy:
   *   1. Projeler — server filter `maintraderid='TRD-FTB'` → 440 rows.
   *   2. Read fresh project IDs from the just-written cache.
   *   3. Lines / Ship / Expense — `Microsoft.Dynamics.CRM.In(...)` filter
   *      built from those IDs (~7.5KB URL, well under Dataverse limits).
   *      Reduces tenant-wide payloads (3.3K + 0.4K + 0.65K = ~4.3K rows)
   *      to only the ~550 rows actually linked to TRD-FTB projects.
   *   4. Tahmini Bütçe — segment-based, no project filter (1267 rows).
   *
   * Sales (invoices) intentionally OUT — fetched per selected project via
   * the effect above; can hit hundreds of rows for a single big project. */
  const refreshSteps = React.useMemo(() => {
    const buildInFilter = (field: string, projids: string[]): string =>
      projids.length === 0
        ? `${field} eq null` // empty list — return nothing rather than blowing up
        : `Microsoft.Dynamics.CRM.In(PropertyName='${field}',PropertyValues=[${projids.map((p) => `'${p}'`).join(",")}])`;
    const readProjids = (): string[] => {
      const cached = readCache<Record<string, unknown>>(ENTITY_SETS.projects);
      return (cached?.value ?? [])
        .map((p) => p.mserp_projid as string | undefined)
        .filter((s): s is string => !!s);
    };
    return [
      { label: "Projeler", refetch: projects.refetch },
      {
        label: "Proje Satırları",
        refetch: async () => {
          const projids = readProjids();
          await lines.refetch({
            $filter: buildInFilter("mserp_projid", projids),
            $select: PROJECT_LINE_COLUMNS.join(","),
            $count: true,
          });
        },
      },
      {
        label: "Gemi Planı",
        refetch: async () => {
          const projids = readProjids();
          await ship.refetch({
            $filter: buildInFilter("mserp_tryshipprojid", projids),
            $select: SHIP_COLUMNS.join(","),
            $count: true,
          });
        },
      },
      {
        label: "Tahmini Gider",
        refetch: async () => {
          const projids = readProjids();
          await expense.refetch({
            $filter: buildInFilter("mserp_etgtryprojid", projids),
            $select: EXPENSE_COLUMNS.join(","),
            $count: true,
          });
        },
      },
      { label: "Tahmini Bütçe", refetch: budget.refetch },
      {
        // Per-project invoiced sales totals (segmented by currency) — single
        // server-side aggregation. Drives KingProjects ranking and the
        // BudgetVsActual card. Result is small (~340 rows for 320 projects).
        label: "Satış Toplamları",
        refetch: async () => {
          const client = getDataverseClient();
          const traderClause = TRADER
            ? `mserp_etgmaintraderid eq '${TRADER}' and `
            : "";
          const apply = `filter(${traderClause}mserp_etgtryprojid ne null)/groupby((mserp_etgtryprojid,mserp_currencycode),aggregate(mserp_lineamount with sum as total,$count as cnt))`;
          const result = await client.list<Record<string, unknown>>(
            "mserp_tryaicustinvoicetransentities",
            { $apply: apply }
          );
          writeCache("salesAggregateByProject", {
            fetchedAt: new Date().toISOString(),
            value: result.value,
          });
        },
      },
      {
        // Raw USD invoice rows (per project × per date) for the tenant's
        // TRD-FTB scope. Feeds the "Satış Bütçesi Nabzı" tile, which buckets
        // them client-side into year-month per project.
        //
        // Dataverse's $apply rejects both `groupby((..., datetime))` and
        // `year()/month()` functions, so we drop down to raw rows. With
        // $select limited to 4 fields × ~1.9K rows the payload stays tiny.
        label: "Proje × Ay Satış",
        refetch: async () => {
          const client = getDataverseClient();
          const traderClause = TRADER
            ? `mserp_etgmaintraderid eq '${TRADER}' and `
            : "";
          // Note: `mserp_invoicedate ne null` is rejected by Dataverse
          // (datetime null comparisons cause a string-to-date conversion
          // error). The client filters out date-less rows when bucketing.
          const result = await client.listAll<Record<string, unknown>>(
            "mserp_tryaicustinvoicetransentities",
            {
              $filter: `${traderClause}mserp_currencycode eq 'USD' and mserp_etgtryprojid ne null`,
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
  }, [
    projects.refetch,
    lines.refetch,
    ship.refetch,
    expense.refetch,
    budget.refetch,
  ]);

  // Apply unified filter (period + categorical) on the domain Project
  // list, derive the allowed projectNo set, then narrow the raw rows
  // by `mserp_projid` membership. Sort at the end.
  const allowedProjectNos = React.useMemo(() => {
    const filtered = applyProjectFilter(domainProjects, projectFilters);
    return new Set(filtered.map((p) => p.projectNo));
  }, [domainProjects, projectFilters]);

  const visibleProjects = React.useMemo(() => {
    const filtered = projects.rows.filter((r) =>
      allowedProjectNos.has(String(r.mserp_projid ?? ""))
    );
    return sortRows(filtered, projectSort);
  }, [projects.rows, allowedProjectNos, projectSort]);

  // Resolve selected project from the FULL projects.rows (not filtered) so it
  // survives if the project is filtered out of the visible list.
  const selectedProject = React.useMemo(() => {
    if (!selectedProjId) return null;
    return (
      projects.rows.find((r) => r.mserp_projid === selectedProjId) ?? null
    );
  }, [projects.rows, selectedProjId]);

  // Selected row index within `visibleProjects` (for table highlight only).
  // null when project is filtered out of the visible list.
  const selectedVisibleIndex = React.useMemo(() => {
    if (!selectedProjId) return null;
    const i = visibleProjects.findIndex(
      (r) => r.mserp_projid === selectedProjId
    );
    return i >= 0 ? i : null;
  }, [visibleProjects, selectedProjId]);

  // Selected project's segment — used by Tahmini Bütçe tab to filter rows
  const selectedSegment =
    (selectedProject?.["mserp_tryprojectsegment"] as string | undefined) ??
    null;

  /* Filter children to selected project. */
  const childLines = React.useMemo(
    () =>
      selectedProjId
        ? lines.rows.filter((r) => r["mserp_projid"] === selectedProjId)
        : [],
    [lines.rows, selectedProjId]
  );
  const childShip = React.useMemo(
    () =>
      selectedProjId
        ? ship.rows.filter((r) => r["mserp_tryshipprojid"] === selectedProjId)
        : [],
    [ship.rows, selectedProjId]
  );
  const childExpense = React.useMemo(
    () =>
      selectedProjId
        ? expense.rows.filter(
            // FK is `mserp_etgtryprojid` on the new
            // `mserp_tryaiotherexpenseentities` entity.
            (r) => r["mserp_etgtryprojid"] === selectedProjId
          )
        : [],
    [expense.rows, selectedProjId]
  );
  // Sales rows for the selected project — joined via mserp_etgtryprojid
  // (custom Tiryaki field on the sales line carrying the project ID).
  const childSales = React.useMemo(
    () =>
      selectedProjId
        ? sales.rows.filter((r) => r["mserp_etgtryprojid"] === selectedProjId)
        : [],
    [sales.rows, selectedProjId]
  );

  // Budget rows filtered to selected project's segment (when applicable).
  // Computed at page level so the tab badge can show the filtered count.
  const filteredBudgetRows = React.useMemo(() => {
    if (!selectedProjId || !selectedSegment || selectedSegment.length === 0) {
      return budget.rows;
    }
    return budget.rows.filter((r) => r.mserp_segment === selectedSegment);
  }, [budget.rows, selectedProjId, selectedSegment]);

  // Top tabs — counts reflect active filter (visible projects + filtered budget)
  const topTabs: TabItem[] = [
    {
      key: "projects",
      label: "Projeler",
      count: visibleProjects.length || projects.rows.length || undefined,
    },
    {
      key: "budget",
      label: "Tahmini Bütçe (Segment)",
      count: filteredBudgetRows.length || undefined,
    },
  ];

  // Bottom panel tabs (only shown when "projects" top tab + project selected)
  const childTabs: TabItem[] = [
    { key: "lines", label: "Proje Satırları", count: childLines.length },
    { key: "ship", label: "Proje-Gemi Planı", count: childShip.length },
    {
      key: "expense",
      label: "Tahmini Gider Satırları",
      count: childExpense.length,
    },
    {
      key: "sales",
      label: "Proje Satış Satırları",
      count: childSales.length,
    },
  ];

  return (
    <ScrollArea className="h-full">
      <div className="space-y-3 pb-3">
        {/* ── Top tabs (Projeler / Tahmini Bütçe) + page actions on the right ── */}
        <GlassPanel tone="default" className="rounded-2xl">
          <div className="px-3 py-2 flex items-center gap-3 flex-wrap">
            <div className="min-w-0 flex-1">
              <TabStrip
                tabs={topTabs}
                activeKey={topTab}
                onChange={(k) => setTopTab(k as TopTabKey)}
              />
            </div>
            {topTab === "projects" && (
              <AdvancedFilter
                projects={domainProjects}
                filters={projectFilters}
                onChange={setProjectFilters}
                shipPlanDefault={true}
                resultCount={visibleProjects.length}
                totalCount={projects.rows.length}
                tone="muted"
              />
            )}
            <RefreshAllButton steps={refreshSteps} />
          </div>
        </GlassPanel>

        {/* ── Top body: master table ── */}
        {topTab === "projects" ? (
          <GlassPanel tone="default" className="rounded-2xl overflow-hidden">
            <CacheBanner
              fetchedAt={projects.fetchedAt}
              isFetching={projects.isFetching}
              loaded={projects.loaded}
              count={visibleProjects.length}
              totalCount={
                projects.rows.length !== visibleProjects.length
                  ? projects.rows.length
                  : projects.totalCount
              }
              error={projects.error}
            />
            {/* Search + Advanced Filter live in the Dataverse Inspector header
             *  now (alongside Güncelle), so no toolbar row needed here. */}
            {/* All-columns sortable table — horizontal scroll for wide schemas.
             *  Compact height so bottom child panel gets more breathing room. */}
            <EntityRowsTable
              rows={visibleProjects}
              // Explicit columns (not just priority) — only these are shown.
              // mserp_isorganic and everything after is hidden + not fetched.
              columns={[...PROJECT_COLUMNS]}
              onRowClick={(row) => {
                const id = row.mserp_projid as string | undefined;
                // Toggle off if clicking the already-selected row
                setSelectedProjId((prev) => (prev === id ? null : id ?? null));
              }}
              selectedIndex={selectedVisibleIndex}
              sort={projectSort}
              onSortChange={setProjectSort}
              emptyText={
                projects.rows.length === 0
                  ? "Henüz çekilmedi — üstten Verileri Güncelle"
                  : "Filtreyle eşleşen proje yok"
              }
              maxHeight="34vh"
            />
          </GlassPanel>
        ) : (
          <BudgetsMaster
            query={budget}
            filteredRows={filteredBudgetRows}
            filterSegment={selectedSegment}
            selectedProjectName={
              selectedProject?.["mserp_projname"] as string | undefined
            }
            selectedProjId={selectedProjId}
            onClearFilter={() => setSelectedProjId(null)}
          />
        )}

        {/* ── Bottom panel: single full-width, 3 tabs (Lines / Ship / Expense) ── */}
        {topTab === "projects" && (
          <GlassPanel tone="default" className="rounded-2xl overflow-hidden">
            <div className="px-3 py-2 border-b border-foreground/[0.04]">
              <TabStrip
                tabs={childTabs}
                activeKey={childTab}
                onChange={(k) => setChildTab(k as ChildTabKey)}
              />
            </div>
            <SelectedProjectInfo selectedProject={selectedProject} />
            {childTab === "lines" && (
              <EntityRowsTable
                rows={childLines}
                // Explicit columns (not priorityColumns) → cached rows with
                // legacy fields (linenum, overdelivery, inventdimid, …) are
                // filtered out on render, even before the next "Güncelle".
                columns={[...PROJECT_LINE_COLUMNS]}
                emptyText={
                  selectedProjId
                    ? "Bu projeye ait satır yok"
                    : "Üstten bir proje seç"
                }
                maxHeight="55vh"
              />
            )}
            {childTab === "ship" && (
              <EntityRowsTable
                rows={childShip}
                priorityColumns={SHIP_COLUMNS}
                emptyText={
                  selectedProjId
                    ? "Bu projeye ait gemi planı yok"
                    : "Üstten bir proje seç"
                }
                maxHeight="55vh"
              />
            )}
            {childTab === "expense" && (
              <EntityRowsTable
                rows={childExpense}
                // Explicit columns → hide cached fob/cif/export/import/…
                // fields immediately, even before re-fetching.
                columns={[...EXPENSE_COLUMNS]}
                emptyText={
                  selectedProjId
                    ? "Bu projeye ait gider satırı yok"
                    : "Üstten bir proje seç"
                }
                maxHeight="55vh"
              />
            )}
            {childTab === "sales" && (
              <EntityRowsTable
                rows={childSales}
                columns={[...SALES_COLUMNS]}
                emptyText={
                  selectedProjId
                    ? sales.rows.length === 0
                      ? "Henüz çekilmedi — üstten Güncelle"
                      : "Bu projeye ait fatura kesilmiş satış satırı yok"
                    : "Üstten bir proje seç"
                }
                maxHeight="55vh"
              />
            )}
          </GlassPanel>
        )}
      </div>
    </ScrollArea>
  );
}

/* ─────────── Sub-views ─────────── */

function BudgetsMaster({
  query,
  filteredRows,
  filterSegment,
  selectedProjectName,
  selectedProjId,
  onClearFilter,
}: {
  query: ReturnType<typeof useEntityRows<Record<string, unknown>>>;
  /** Already-filtered rows from page (matches the tab-badge count). */
  filteredRows: Record<string, unknown>[];
  /** Selected project's segment — non-empty when filter is active. */
  filterSegment: string | null;
  selectedProjectName?: string | null;
  selectedProjId: string | null;
  onClearFilter: () => void;
}) {
  // Distinguish: filter active (segment non-empty) vs. project picked but segment blank
  const projectSelected = !!selectedProjId;
  const filterActive = projectSelected && !!filterSegment && filterSegment.length > 0;

  // Default sort: mserp_year desc (newest budget periods first)
  const [budgetSort, setBudgetSort] = React.useState<SortState | null>({
    field: "mserp_year",
    direction: "desc",
  });
  const sortedRows = React.useMemo(
    () => sortRows(filteredRows, budgetSort),
    [filteredRows, budgetSort]
  );

  return (
    <GlassPanel tone="default" className="rounded-2xl overflow-hidden">
      <CacheBanner
        fetchedAt={query.fetchedAt}
        isFetching={query.isFetching}
        loaded={query.loaded}
        count={filteredRows.length}
        totalCount={
          query.rows.length !== filteredRows.length
            ? query.rows.length
            : query.totalCount
        }
        error={query.error}
      />
      {projectSelected && (
        <div className="px-4 py-2 bg-foreground/[0.025] border-b border-foreground/[0.04] flex items-center gap-2 text-[11px] flex-wrap">
          {filterActive ? (
            <>
              <span className="text-muted-foreground">Segment filtresi:</span>
              <code className="font-mono font-semibold text-foreground">
                {filterSegment}
              </code>
            </>
          ) : (
            <>
              <span className="text-amber-700 font-medium">
                ⚠ Seçili projenin segmenti boş — filtre uygulanmadı, tüm
                bütçeler gösteriliyor
              </span>
            </>
          )}
          {selectedProjectName && (
            <span className="text-muted-foreground truncate min-w-0">
              · {selectedProjectName}
            </span>
          )}
          <button
            type="button"
            onClick={onClearFilter}
            className="ml-auto h-6 px-2 rounded-md text-[10.5px] font-medium text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06] transition-colors shrink-0"
          >
            Seçimi kaldır
          </button>
        </div>
      )}
      <EntityRowsTable
        rows={sortedRows}
        // Explicit columns → hide cached itemid/accountnum/namealias/custname/
        // primaryfield/entityid fields right away, even before re-fetching.
        columns={[...BUDGET_COLUMNS]}
        sort={budgetSort}
        onSortChange={setBudgetSort}
        emptyText={
          query.rows.length === 0
            ? "Henüz çekilmedi — üstten Verileri Güncelle"
            : filterActive
            ? `'${filterSegment}' segmentine ait bütçe satırı yok`
            : "Veri yok"
        }
        maxHeight="60vh"
      />
    </GlassPanel>
  );
}

function CacheBanner({
  fetchedAt,
  isFetching,
  loaded,
  count,
  totalCount,
  error,
}: {
  fetchedAt: string | null;
  isFetching: boolean;
  loaded: number | null;
  count: number;
  totalCount?: number;
  error: Error | null;
}) {
  if (error) {
    return (
      <div className="px-4 py-2.5 border-b border-rose-200 bg-rose-50 text-rose-700 text-[11.5px]">
        Hata: {error.message}
      </div>
    );
  }
  if (!fetchedAt && !isFetching) return null;
  const ago = fetchedAt ? humanAgo(new Date(fetchedAt)) : null;
  return (
    <div className="px-4 py-2 border-b border-foreground/[0.04] flex items-center gap-2 text-[10.5px] text-muted-foreground">
      <span
        className={cn(
          "size-1.5 rounded-full",
          isFetching ? "bg-amber-500 animate-pulse" : "bg-emerald-500"
        )}
      />
      {isFetching ? (
        loaded !== null ? (
          <>Yükleniyor… <span className="tabular-nums font-semibold text-foreground">{loaded.toLocaleString("tr-TR")}</span> kayıt</>
        ) : (
          "Bağlanıyor…"
        )
      ) : (
        <>
          <span>Son güncelleme: <span className="font-semibold text-foreground">{ago}</span></span>
          <span>·</span>
          <span>
            <span className="font-semibold text-foreground tabular-nums">
              {count.toLocaleString("tr-TR")}
            </span>
            {totalCount !== undefined && totalCount > count && (
              <> / {totalCount.toLocaleString("tr-TR")}</>
            )}
            {" "}kayıt
          </span>
        </>
      )}
    </div>
  );
}

function SelectedProjectInfo({
  selectedProject,
}: {
  selectedProject: Record<string, unknown> | null;
}) {
  if (!selectedProject) return null;
  return (
    <div className="px-4 py-1.5 bg-foreground/[0.025] border-b border-foreground/[0.04] text-[10.5px] flex items-center gap-2 flex-wrap">
      <span className="text-muted-foreground">Filtre:</span>
      <code className="font-mono font-semibold text-foreground">
        {String(selectedProject["mserp_projid"] ?? "—")}
      </code>
      <span className="text-muted-foreground truncate flex-1 min-w-0">
        {String(selectedProject["mserp_projname"] ?? "")}
      </span>
    </div>
  );
}

function humanAgo(d: Date): string {
  const diffMs = Date.now() - d.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "şimdi";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} dk önce`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} saat önce`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} gün önce`;
  return d.toLocaleDateString("tr-TR");
}
