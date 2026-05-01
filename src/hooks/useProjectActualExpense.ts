import * as React from "react";
import { getDataverseClient } from "@/lib/dataverse";
import { readCache, writeCache } from "@/lib/storage/entityCache";
import { ACTUAL_EXPENSE_COLUMNS } from "@/lib/dataverse/columnOrder";

const ENTITY_SET = "mserp_tryaifrtexpenselinedistlineentities";

export interface UseProjectActualExpenseReturn {
  /** Realised expense distribution rows for the current project. */
  rows: Record<string, unknown>[];
  /** True while a fresh fetch is in flight. */
  isFetching: boolean;
  /** ISO timestamp of the most recent fetch (or null on first mount). */
  fetchedAt: string | null;
}

/**
 * 🔒 Read-only — fetch realised-expense distribution lines for one
 * project on demand.
 *
 * Mirrors `useProjectInvoices` exactly:
 *   - Triggers a `listAll` with `mserp_etgtryprojid eq '<projectNo>'`
 *     whenever `projectNo` changes.
 *   - Writes results into the shared
 *     `tyro:dv:mserp_tryaifrtexpenselinedistlineentities` cache slot.
 *     Defensive client-side filter on `mserp_etgtryprojid` ensures we
 *     only return rows for the requested project even if a different
 *     consumer (Veri Yönetimi inspector) overwrote the cache for
 *     another project.
 *   - Server-orderby on `mserp_datefinancial desc` so the most recent
 *     postings render first.
 *
 * Why per-project on-demand instead of a global tenant-wide cache:
 * the tenant-wide payload (~1.8 MB on first measurement) plus the
 * existing global caches pushed the browser localStorage past its
 * 5-10 MB quota, knocking out other entities. Per-project fetches
 * stay tiny (a few KB each) and only one project's data lives in
 * cache at a time.
 */
export function useProjectActualExpense(
  projectNo: string | null | undefined
): UseProjectActualExpenseReturn {
  const [isFetching, setIsFetching] = React.useState(false);
  // Bumped counter forces the `useMemo` to re-read the cache once
  // the fetch completes (same-tab cache writes don't fire the native
  // `storage` event).
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
            $filter: `mserp_etgtryprojid eq '${projectNo}'`,
            $select: ACTUAL_EXPENSE_COLUMNS.join(","),
            $orderby: "mserp_datefinancial desc",
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
          `[useProjectActualExpense] fetch failed for ${projectNo}:`,
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
      rows: filtered,
      isFetching,
      fetchedAt: cached?.fetchedAt ?? null,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectNo, isFetching, refreshTick]);
}
