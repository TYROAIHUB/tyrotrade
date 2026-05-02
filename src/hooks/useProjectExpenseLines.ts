import * as React from "react";
import { getDataverseClient } from "@/lib/dataverse";
import { EXPENSE_LINE_COLUMNS } from "@/lib/dataverse/columnOrder";

/** Inventory-dimension entity — maps a project number (carried in
 *  `mserp_inventdimension2`) to the set of `mserp_inventdimid` keys
 *  that the distribution lines are stamped with. The distribution
 *  entity has no `mserp_etgtryprojid` we can rely on; the project
 *  link goes through this dim table. */
const INVENTDIMB_ENTITY = "mserp_inventdimbientities";

/** Distribution-line entity — used purely as a "is this expense
 *  linked to this project?" filter via `mserp_inventdimid`. Its own
 *  column data isn't shown anywhere; we only read `mserp_expensenum`
 *  from each row to drive the final lookup against the authoritative
 *  entity. */
const DIST_ENTITY = "mserp_tryaifrtexpenselinedistlineentities";

/** Authoritative expense-line entity carrying the correct amounts
 *  and descriptions. Joined to the distribution entity via
 *  `mserp_expensenum`. */
const EXPENSE_ENTITY = "mserp_tryaiexpenselineentities";

/** Same chunk size as the global IN filter helpers — keeps each
 *  request URL safely under proxy/CDN limits. Used for both the
 *  inventdimid → distribution lookup and the expensenum → expense
 *  lookup. */
const IN_CHUNK_SIZE = 50;

export interface UseProjectExpenseLinesReturn {
  /** Authoritative expense-line rows for the current project. */
  rows: Record<string, unknown>[];
  /** True while ANY of the three async steps is in flight. */
  isFetching: boolean;
  /** ISO timestamp of the most recent successful chain completion. */
  fetchedAt: string | null;
  /** Number of distinct inventory dimension IDs the project's
   *  inventdimb rows pointed to (Step 0 result). Useful for
   *  diagnostics ("project resolved to 3 inventdimid keys"). */
  inventDimIdCount: number;
  /** Number of distinct expense numbers the project's distribution
   *  rows pointed to (Step 1 result). */
  expenseNumCount: number;
  /** Last error message, when the chain failed. */
  error: string | null;
}

/**
 * 🔒 Read-only — fetch realised-expense LINES for one project via a
 * three-step chain:
 *
 *   0. List inventory-dimension rows from `mserp_inventdimbientities`
 *      filtered by `mserp_inventdimension2 eq '<projectNo>'`. Pull
 *      only `mserp_inventdimid`. This step exists because the
 *      distribution entity (Step 1) is not directly indexed by
 *      project number — the project link lives in the inventdim
 *      table.
 *   1. De-duplicate the inventdimids, then list distribution rows
 *      from `mserp_tryaifrtexpenselinedistlineentities` using a
 *      chunked `In(mserp_inventdimid, …)` filter. Pull only
 *      `mserp_expensenum`.
 *   2. De-duplicate the expense numbers, then fetch the matching
 *      rows from `mserp_tryaiexpenselineentities` using a chunked
 *      `In(mserp_expensenum, …)` filter so the URL stays under
 *      proxy limits even when a project touches hundreds of expense
 *      vouchers.
 *
 * Returns the step-2 rows. The inventdimb + distribution entities
 * act as filter intermediaries only — their data isn't surfaced
 * anywhere.
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
  const [inventDimIdCount, setInventDimIdCount] = React.useState(0);
  const [expenseNumCount, setExpenseNumCount] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!projectNo) {
      setRows([]);
      setInventDimIdCount(0);
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

        // Step 0: inventory-dimension rows for the project → distinct inventdimids
        const dimResult = await client.listAll<Record<string, unknown>>(
          INVENTDIMB_ENTITY,
          {
            $filter: `mserp_inventdimension2 eq '${projectNo}'`,
            $select: "mserp_inventdimid",
          }
        );
        if (cancelled) return;

        const inventDimIds = [
          ...new Set(
            dimResult.value
              .map((r) => String(r.mserp_inventdimid ?? "").trim())
              .filter((s): s is string => s.length > 0)
          ),
        ];
        setInventDimIdCount(inventDimIds.length);

        if (inventDimIds.length === 0) {
          // No inventdim link → no distribution rows → no expenses.
          setRows([]);
          setExpenseNumCount(0);
          setFetchedAt(new Date().toISOString());
          return;
        }

        // Step 1: distribution rows for those inventdimids → distinct expensenums.
        // Chunked IN to keep each URL under enterprise-proxy limits.
        const distRows: Record<string, unknown>[] = [];
        for (let i = 0; i < inventDimIds.length; i += IN_CHUNK_SIZE) {
          const chunk = inventDimIds.slice(i, i + IN_CHUNK_SIZE);
          const inFilter = `Microsoft.Dynamics.CRM.In(PropertyName='mserp_inventdimid',PropertyValues=[${chunk
            .map((id) => `'${id}'`)
            .join(",")}])`;
          const distResult = await client.listAll<Record<string, unknown>>(
            DIST_ENTITY,
            {
              $filter: inFilter,
              $select: "mserp_expensenum",
            }
          );
          if (cancelled) return;
          distRows.push(...distResult.value);
        }

        const expensenums = [
          ...new Set(
            distRows
              .map((r) => String(r.mserp_expensenum ?? "").trim())
              .filter((s): s is string => s.length > 0)
          ),
        ];
        setExpenseNumCount(expensenums.length);

        if (expensenums.length === 0) {
          // Distribution rows existed but carried no expensenums.
          setRows([]);
          setFetchedAt(new Date().toISOString());
          return;
        }

        // Step 2: fetch authoritative expense-line rows for those expensenums.
        const all: Record<string, unknown>[] = [];
        for (let i = 0; i < expensenums.length; i += IN_CHUNK_SIZE) {
          const chunk = expensenums.slice(i, i + IN_CHUNK_SIZE);
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

  return {
    rows,
    isFetching,
    fetchedAt,
    inventDimIdCount,
    expenseNumCount,
    error,
  };
}
