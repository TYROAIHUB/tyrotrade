import { useQuery } from "@tanstack/react-query";
import { getProjectFull } from "@/lib/dataverse/repos/projectRepo";
import { queryKeys } from "@/lib/query/keys";

/**
 * 🔒 Read-only hook: fetch a single project with all child entities resolved
 * (vesselPlan, lines, costEstimate, actualCost) in a single round-trip.
 *
 * **Use this — not separate `useProject` + `useProjectLines` + ... — to avoid
 * N+1 against Dataverse.** The real client issues `$expand` server-side; the
 * mock returns the inlined record as-is.
 *
 * `enabled` is wired to `!!projectNo` so passing `null`/`undefined` no-ops.
 */
export function useProjectFull(projectNo: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.projects.full(projectNo ?? ""),
    queryFn: () => getProjectFull(projectNo as string),
    enabled: !!projectNo,
  });
}
