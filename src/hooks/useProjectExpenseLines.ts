import * as React from "react";
import { getDataverseClient } from "@/lib/dataverse";
import { EXPENSE_LINE_COLUMNS } from "@/lib/dataverse/columnOrder";

/** Distribution-line entity — used purely as a "is this expense
 *  linked to this project?" filter. Its own column data isn't shown
 *  anywhere now; we only read `mserp_expensenum` from each row to
 *  drive the second-step lookup against the authoritative entity. */
const DIST_ENTITY = "mserp_tryaifrtexpenselinedistlineentities";

/** Authoritative expense-line entity carrying the correct amounts
 *  and descriptions. Joined to the distribution entity via
 *  `mserp_expensenum`. */
const EXPENSE_ENTITY = "mserp_tryaiexpenselineentities";

/** Same chunk size as the global IN filter helpers — keeps each
 *  request URL safely under proxy/CDN limits. */
const EXPENSENUM_CHUNK_SIZE = 50;

export interface UseProjectExpenseLinesReturn {
  /** Authoritative expense-line rows for the current project. */
  rows: Record<string, unknown>[];
  /** True while either the distribution lookup OR the expense-line
   *  fetch is in flight. */
  isFetching: boolean;
  /** ISO timestamp of the most recent successful chain completion. */
  fetchedAt: string | null;
  /** Number of distinct expense numbers the project's distribution
   *  rows pointed to. Useful for diagnostics ("project has 6
   *  expense lines spread across 14 distribution rows"). */
  expenseNumCount: number;
  /** Last error message, when the chain failed. */
  error: string | null;
}

/**
 * 🔒 Read-only — fetch realised-expense LINES for one project via a
 * two-step chain:
 *
 *   1. List distribution rows from `mserp_tryaifrtexpenselinedistlineentities`
 *      filtered by `mserp_etgtryprojid eq '<projectNo>'`. Pull only
 *      the `mserp_expensenum` column — we don't need the rest of
 *      the dist data.
 *   2. De-duplicate the expense numbers, then fetch the matching
 *      rows from `mserp_tryaiexpenselineentities` using a chunked
 *      `Microsoft.Dynamics.CRM.In(mserp_expensenum, …)` filter so
 *      the URL stays under proxy limits even when a project
 *      touches hundreds of expense vouchers.
 *
 * Returns the step-2 rows. The dist entity acts as a filter
 * intermediary only — its data isn't surfaced anywhere.
 *
 * In-memory state only (no localStorage cache). The hook re-fetches
 * on every project change; same-project re-renders use cached state.
 */
export function useProjectExpenseLines(
  projectNo: string | null | undefined
): UseProjectExpenseLinesReturn {
  const [rows, setRows] = React.useState<Record<string, unknown>[]>([]);
  const [isFetching, setIsFetching] = React.useState(false);
  const [fetchedAt, setFetchedAt] = React.useState<string | null>(null);
  const [expenseNumCount, setExpenseNumCount] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!projectNo) {
      setRows([]);
      setExpenseNumCount(0);
      setError(null);
      return;
    }
    let cancelled = false;
    setIsFetching(true);
    setError(null);
    (async () => {
      try {
        const client = getDataverseClient();

        // Step 1: distribution rows for the project → distinct expensenums
        const distResult = await client.listAll<Record<string, unknown>>(
          DIST_ENTITY,
          {
            $filter: `mserp_etgtryprojid eq '${projectNo}'`,
            $select: "mserp_expensenum",
          }
        );
        if (cancelled) return;

        const expensenums = [
          ...new Set(
            distResult.value
              .map((r) => String(r.mserp_expensenum ?? "").trim())
              .filter((s): s is string => s.length > 0)
          ),
        ];
        setExpenseNumCount(expensenums.length);

        if (expensenums.length === 0) {
          // No distribution rows → no expenses. Mark as fetched so
          // the UI can distinguish "haven't loaded yet" from "loaded,
          // 0 results".
          setRows([]);
          setFetchedAt(new Date().toISOString());
          return;
        }

        // Step 2: fetch expense-line rows for those expensenums.
        // Chunked IN to keep the URL under enterprise-proxy limits
        // (same dialect as `listAllByInChunked` in refreshAll.ts).
        const all: Record<string, unknown>[] = [];
        for (let i = 0; i < expensenums.length; i += EXPENSENUM_CHUNK_SIZE) {
          const chunk = expensenums.slice(i, i + EXPENSENUM_CHUNK_SIZE);
          const inFilter = `Microsoft.Dynamics.CRM.In(PropertyName='mserp_expensenum',PropertyValues=[${chunk
            .map((n) => `'${n}'`)
            .join(",")}])`;
          const expResult = await client.listAll<Record<string, unknown>>(
            EXPENSE_ENTITY,
            {
              $filter: inFilter,
              $select: EXPENSE_LINE_COLUMNS.join(","),
              $count: true,
            }
          );
          if (cancelled) return;
          all.push(...expResult.value);
        }

        setRows(all);
        setFetchedAt(new Date().toISOString());
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        // eslint-disable-next-line no-console
        console.warn(
          `[useProjectExpenseLines] fetch failed for ${projectNo}:`,
          err
        );
        setError(message);
      } finally {
        if (!cancelled) setIsFetching(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectNo]);

  return { rows, isFetching, fetchedAt, expenseNumCount, error };
}
