import { getDataverseClient, OData } from "../index";
import type { Project, ProjectFull } from "../entities";

/**
 * 🔒 Read-only Project repository.
 *
 * All methods are GET-only. Mutation methods are bilinçli olarak yok —
 * the app never writes to Dataverse. Higher layers (hooks, components)
 * never bypass this repo to talk to the client directly.
 */

const ENTITY_SET = "tryk_projects";

export interface ProjectListFilters {
  /** ProjectStatus.eq filter */
  statuses?: string[];
  groups?: string[];
  segments?: string[];
  deliveryModes?: string[];
  incoterms?: string[];
  /** projectDate >= this ISO date */
  projectDateFrom?: string;
  /** projectDate <= this ISO date */
  projectDateTo?: string;
  /** Free-text search across projectNo, projectName */
  search?: string;
}

function buildFilterExpr(f?: ProjectListFilters): string | undefined {
  if (!f) return undefined;
  const parts: string[] = [];

  const inFilter = (field: string, values?: string[]) => {
    if (!values || values.length === 0) return;
    const ors = values.map((v) => `${field} eq '${v.replace(/'/g, "''")}'`);
    parts.push(`(${ors.join(" or ")})`);
  };

  inFilter("status", f.statuses);
  inFilter("projectGroup", f.groups);
  inFilter("segment", f.segments);
  inFilter("deliveryMode", f.deliveryModes);
  inFilter("incoterm", f.incoterms);

  if (f.projectDateFrom) {
    parts.push(`projectDate ge '${f.projectDateFrom}'`);
  }
  if (f.projectDateTo) {
    parts.push(`projectDate le '${f.projectDateTo}'`);
  }
  if (f.search?.trim()) {
    const q = f.search.trim().replace(/'/g, "''");
    parts.push(`(contains(projectName, '${q}') or contains(projectNo, '${q}'))`);
  }

  return parts.length > 0 ? parts.join(" and ") : undefined;
}

/* ─────────── Read methods ─────────── */

/** List projects (header view). */
export async function listProjects(
  filters?: ProjectListFilters,
  options?: { top?: number; skip?: number; orderby?: string }
): Promise<Project[]> {
  const client = getDataverseClient();
  let qb = OData.empty();

  const filterExpr = buildFilterExpr(filters);
  if (filterExpr) qb = qb.filter(filterExpr);
  if (options?.orderby) qb = qb.orderby(options.orderby);
  if (options?.top !== undefined) qb = qb.top(options.top);
  if (options?.skip !== undefined) qb = qb.skip(options.skip);

  const { value } = await client.list<Project>(ENTITY_SET, qb.build());
  return value;
}

/** Get a single project header by projectNo. */
export async function getProject(projectNo: string): Promise<Project> {
  const client = getDataverseClient();
  return client.get<Project>(ENTITY_SET, projectNo);
}

/**
 * Get a project with all child entities resolved in a single round-trip.
 *
 * In the real Dataverse client this issues `$expand=tryk_lines,tryk_vesselplan,
 * tryk_costestimate,tryk_actualcost`. The mock client returns the project as-is
 * (children are already inlined).
 */
export async function getProjectFull(projectNo: string): Promise<ProjectFull> {
  const client = getDataverseClient();
  const q = OData.expand(
    "tryk_lines,tryk_vesselplan,tryk_costestimate,tryk_actualcost"
  ).build();
  const project = await client.get<Project>(ENTITY_SET, projectNo, q);
  // Today Project === ProjectFull. The cast is a documentation hint that the
  // real client must hydrate child collections via $expand.
  return project as ProjectFull;
}
