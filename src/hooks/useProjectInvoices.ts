import * as React from "react";
import { getDataverseClient } from "@/lib/dataverse";
import { readCache, writeCache } from "@/lib/storage/entityCache";
import { SALES_COLUMNS } from "@/lib/dataverse/columnOrder";
import {
  FINANCING_SALES_IDS_CACHE,
  NON_INTERCOMPANY_FILTER,
  readFinancingIds,
} from "@/lib/dataverse/refreshAll";

const ENTITY_SET = "mserp_tryaicustinvoicetransentities";

/** Same chunk size as the global IN-filter helpers — keeps URL length
 *  predictable when chaining multiple `not In(...)` clauses. */
const NOT_IN_CHUNK_SIZE = 50;

/** Build a chunked `not In(...)` clause for excluding financing-order
 *  sales IDs from the per-project invoice fetch. Mirrors the helper in
 *  `refreshAll.ts` so the per-project hook applies the same exclusion
 *  the global aggregate already applies — the two stay in sync as the
 *  financing list grows. Returns `null` when there's nothing to
 *  exclude (caller skips splicing). */
function buildNotInSalesIds(ids: string[]): string | null {
  if (ids.length === 0) return null;
  const chunks: string[] = [];
  for (let i = 0; i < ids.length; i += NOT_IN_CHUNK_SIZE) {
    const slice = ids.slice(i, i + NOT_IN_CHUNK_SIZE);
    chunks.push(
      `not Microsoft.Dynamics.CRM.In(PropertyName='mserp_salesid',PropertyValues=[${slice
        .map((id) => `'${id}'`)
        .join(",")}])`
    );
  }
  return `(${chunks.join(" and ")})`;
}

export interface UseProjectInvoicesReturn {
  /** Invoice rows for the current project. */
  invoices: Record<string, unknown>[];
  /** True while a fresh fetch is in flight. */
  isFetching: boolean;
  /** ISO timestamp of the most recent fetch (or null on first mount). */
  fetchedAt: string | null;
}

/**
 * 🔒 Read-only — fetch invoice transactions for one project on demand.
 *
 * Behaviour:
 *   - Triggers a fresh `listAll` server-side filter every time the
 *     `projectNo` changes.
 *   - Stores results into the shared `tyro:dv:mserp_tryaicustinvoicetrans…`
 *     cache slot. Defensive client-side filter on `mserp_etgtryprojid`
 *     ensures we only return rows for the current project even if the
 *     cache was just overwritten by a different project.
 *   - Returns the cached rows synchronously plus an `isFetching` flag the
 *     UI can use to show a spinner while a refresh is in flight.
 */
export function useProjectInvoices(
  projectNo: string | null | undefined
): UseProjectInvoicesReturn {
  const [isFetching, setIsFetching] = React.useState(false);
  // A bumped counter forces the `useMemo` below to re-read the cache once
  // the fetch completes (cache writes don't fire `storage` events for the
  // same tab that wrote them).
  const [refreshTick, setRefreshTick] = React.useState(0);

  React.useEffect(() => {
    if (!projectNo) return;
    let cancelled = false;
    setIsFetching(true);
    (async () => {
      try {
        const client = getDataverseClient();
        const financingSalesIds = readFinancingIds(FINANCING_SALES_IDS_CACHE);
        const notFinancing = buildNotInSalesIds(financingSalesIds);
        const baseFilter = `mserp_etgtryprojid eq '${projectNo}' and (${NON_INTERCOMPANY_FILTER})`;
        const $filter = notFinancing
          ? `${baseFilter} and ${notFinancing}`
          : baseFilter;
        const result = await client.listAll<Record<string, unknown>>(
          ENTITY_SET,
          {
            $filter,
            $select: SALES_COLUMNS.join(","),
            $orderby: "mserp_invoicedate desc",
            $count: true,
          }
        );
        if (cancelled) return;
        writeCache(ENTITY_SET, {
          fetchedAt: new Date().toISOString(),
          value: result.value,
          totalCount: result.totalCount,
        });
        setRefreshTick((n) => n + 1);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(
          `[useProjectInvoices] fetch failed for ${projectNo}:`,
          err
        );
      } finally {
        if (!cancelled) setIsFetching(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectNo]);

  return React.useMemo(() => {
    const cached = readCache<Record<string, unknown>>(ENTITY_SET);
    const all = cached?.value ?? [];
    const filtered = projectNo
      ? all.filter((r) => r["mserp_etgtryprojid"] === projectNo)
      : [];
    return {
      invoices: filtered,
      isFetching,
      fetchedAt: cached?.fetchedAt ?? null,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectNo, isFetching, refreshTick]);
}
