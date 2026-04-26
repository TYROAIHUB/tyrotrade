import { shouldUseMock } from "@/lib/dataverse";
import { mockProjects } from "@/mocks/projects";
import { useRealProjects } from "./useRealProjects";
import type { Project } from "@/lib/dataverse/entities";

export interface UseProjectsResult {
  projects: Project[];
  /** True only in real-mode when the project header cache slot is missing. */
  isEmpty: boolean;
  /** Most recent project header fetch timestamp (real mode only). */
  fetchedAt: string | null;
}

/**
 * 🔒 Read-only hook: returns the active project list.
 *
 * - Mock mode (`VITE_USE_MOCK=true`): returns the synthetic `mockProjects`
 *   array as-is. `isEmpty` is always false.
 * - Real mode: hydrates the 5 cached Dataverse entity arrays from
 *   localStorage (populated by Data Management page) and runs the
 *   `composeProjects` derivation. `isEmpty=true` when the project header
 *   cache hasn't been fetched yet — UI should show ProjectsEmptyState.
 */
export function useProjects(): UseProjectsResult {
  // Hooks must be called unconditionally per React rules.
  const real = useRealProjects();

  if (shouldUseMock()) {
    return { projects: mockProjects, isEmpty: false, fetchedAt: null };
  }
  return {
    projects: real.projects,
    isEmpty: real.isEmpty,
    fetchedAt: real.fetchedAt.projects,
  };
}
