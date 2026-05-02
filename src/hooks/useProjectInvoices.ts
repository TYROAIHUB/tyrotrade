import * as React from "react";
import { getDataverseClient } from "@/lib/dataverse";
import { readCache, writeCache } from "@/lib/storage/entityCache";
import { SALES_COLUMNS } from "@/lib/dataverse/columnOrder";
import { NON_INTERCOMPANY_FILTER } from "@/lib/dataverse/refreshAll";

const ENTITY_SET = "mserp_tryaicustinvoicetransentities";

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
        const result = await client.listAll<Record<string, unknown>>(
          ENTITY_SET,
          {
            $filter: `mserp_etgtryprojid eq '${projectNo}' and (${NON_INTERCOMPANY_FILTER})`,
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
