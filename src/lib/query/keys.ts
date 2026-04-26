import type { ProjectListFilters } from "@/lib/dataverse/repos/projectRepo";

/**
 * Central TanStack Query key factory.
 *
 * Use this everywhere instead of hand-rolled string arrays so cache
 * invalidation lookups stay type-safe and consistent.
 *
 *   queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
 *   queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail("PRJ...") });
 */
export const queryKeys = {
  projects: {
    all: ["projects"] as const,
    list: (filters?: ProjectListFilters) =>
      ["projects", "list", filters ?? {}] as const,
    detail: (projectNo: string) => ["projects", "detail", projectNo] as const,
    full: (projectNo: string) => ["projects", "full", projectNo] as const,
  },
  // Future entity keys (read-only) plug in here as they're added:
  // segmentBudgets: { byPeriod: (year: number) => ["segmentBudgets", year] as const, ... },
  // entityRows:     { list: (entity: string, filter?: object) => ["entityRows", entity, filter ?? {}] as const, ... },
} as const;
