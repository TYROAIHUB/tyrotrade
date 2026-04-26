import type { Project } from "./entities";
import { mockProjects } from "@/mocks/projects";
import type { ODataQuery } from "./odata";
import {
  DataverseError,
  DataverseNotFoundError,
  type DataverseClient,
  type DataverseListResponse,
} from "./client";

/**
 * 🔒 Read-only mock Dataverse client.
 *
 * Wraps `src/mocks/projects.ts` array as if it came from Dataverse, supporting
 * the read-only subset of OData query params:
 *   - `$top`, `$skip` — pagination
 *   - `$filter` — minimal regex parser for common operators
 *   - `$orderby` — single-field asc/desc
 *   - `$select` — projection (returns shallow copy with subset of fields)
 *   - `$count` — total count alongside `value[]`
 *   - `$expand` — no-op (mock data is already inlined)
 *
 * Entity set name → mock data source mapping lives in `ENTITY_SOURCES`.
 *
 * Mutation methods are bilinçli olarak yok — interface buna izin vermiyor.
 */

const ENTITY_SOURCES: Record<string, () => unknown[]> = {
  tryk_projects: () => mockProjects,
  // Future entity sets (read-only) will plug in here:
  // tryk_vesselplans: () => mockProjects.flatMap(p => p.vesselPlan ? [{ ...p.vesselPlan, projectNo: p.projectNo }] : []),
  // tryk_projectlines: () => mockProjects.flatMap(p => p.lines.map((l, i) => ({ ...l, id: `${p.projectNo}-${i}`, projectNo: p.projectNo }))),
  // tryk_segmentbudgets: () => mockSegmentBudgets,
};

const PRIMARY_KEYS: Record<string, string> = {
  tryk_projects: "projectNo",
};

/* ─────────── $filter parser ─────────── */

type FilterPredicate = (record: Record<string, unknown>) => boolean;

const COMPARISON_OPS: Record<
  string,
  (a: unknown, b: unknown) => boolean
> = {
  eq: (a, b) => a === b,
  ne: (a, b) => a !== b,
  gt: (a, b) =>
    typeof a === "number" && typeof b === "number" ? a > b : String(a) > String(b),
  ge: (a, b) =>
    typeof a === "number" && typeof b === "number" ? a >= b : String(a) >= String(b),
  lt: (a, b) =>
    typeof a === "number" && typeof b === "number" ? a < b : String(a) < String(b),
  le: (a, b) =>
    typeof a === "number" && typeof b === "number" ? a <= b : String(a) <= String(b),
};

function parseValue(raw: string): unknown {
  raw = raw.trim();
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw === "null") return null;
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
  // String literal: 'text' (OData uses single quotes)
  if (raw.startsWith("'") && raw.endsWith("'")) {
    return raw.slice(1, -1).replace(/''/g, "'");
  }
  return raw;
}

/**
 * Mini OData `$filter` parser — handles:
 *   `field eq value`
 *   `field eq value and field2 eq value2`  (nested via parens)
 *   `contains(field, 'text')`
 *   `startswith(field, 'text')`
 *
 * For complex filters falling outside this subset, the mock client falls
 * back to in-memory `Array.filter` after the parser bails.
 */
function compileFilter(expr: string): FilterPredicate {
  const trimmed = expr.trim();

  // Handle `and` / `or` at top level (split on whitespace-bounded keywords,
  // ignoring those inside parens/quotes — naive but works for our patterns)
  const splitTop = (input: string, op: " and " | " or "): string[] | null => {
    const parts: string[] = [];
    let depth = 0;
    let inQuote = false;
    let buf = "";
    for (let i = 0; i < input.length; i++) {
      const ch = input[i];
      if (ch === "'") inQuote = !inQuote;
      if (!inQuote) {
        if (ch === "(") depth++;
        else if (ch === ")") depth--;
        if (depth === 0 && input.slice(i, i + op.length) === op) {
          parts.push(buf);
          buf = "";
          i += op.length - 1;
          continue;
        }
      }
      buf += ch;
    }
    parts.push(buf);
    return parts.length > 1 ? parts : null;
  };

  const andParts = splitTop(trimmed, " and ");
  if (andParts) {
    const preds = andParts.map(compileFilter);
    return (r) => preds.every((p) => p(r));
  }
  const orParts = splitTop(trimmed, " or ");
  if (orParts) {
    const preds = orParts.map(compileFilter);
    return (r) => preds.some((p) => p(r));
  }

  // Strip outer parens
  if (trimmed.startsWith("(") && trimmed.endsWith(")")) {
    return compileFilter(trimmed.slice(1, -1));
  }

  // Function-style: contains(field, 'text') / startswith(field, 'text')
  const fnMatch = trimmed.match(
    /^(contains|startswith|endswith)\(\s*([\w/]+)\s*,\s*'([^']*)'\s*\)$/i
  );
  if (fnMatch) {
    const [, fn, field, val] = fnMatch;
    return (r) => {
      const fieldVal = String(r[field] ?? "").toLowerCase();
      const search = val.toLowerCase();
      if (fn === "contains") return fieldVal.includes(search);
      if (fn === "startswith") return fieldVal.startsWith(search);
      if (fn === "endswith") return fieldVal.endsWith(search);
      return false;
    };
  }

  // Comparison: `field op value`
  const opMatch = trimmed.match(/^([\w/]+)\s+(eq|ne|gt|ge|lt|le)\s+(.+)$/);
  if (opMatch) {
    const [, field, op, rawValue] = opMatch;
    const value = parseValue(rawValue);
    const compare = COMPARISON_OPS[op];
    return (r) => compare(r[field], value);
  }

  // Unsupported — return tautology (matches everything) and warn
  // eslint-disable-next-line no-console
  console.warn(`[mockClient] Unsupported $filter expression: ${trimmed}`);
  return () => true;
}

/* ─────────── $orderby ─────────── */

function compileOrderBy(
  expr: string
): (a: Record<string, unknown>, b: Record<string, unknown>) => number {
  const m = expr.trim().match(/^([\w/]+)(?:\s+(asc|desc))?$/i);
  if (!m) return () => 0;
  const [, field, dirRaw] = m;
  const dir = (dirRaw ?? "asc").toLowerCase() === "desc" ? -1 : 1;
  return (a, b) => {
    const av = a[field];
    const bv = b[field];
    if (av === bv) return 0;
    if (av == null) return 1 * dir;
    if (bv == null) return -1 * dir;
    if (typeof av === "number" && typeof bv === "number") {
      return (av - bv) * dir;
    }
    return String(av).localeCompare(String(bv), "tr") * dir;
  };
}

/* ─────────── Client ─────────── */

class MockDataverseClient implements DataverseClient {
  /** Simulate network latency for a more realistic dev experience. */
  private readonly delayMs = 0;

  private async simulate<T>(producer: () => T): Promise<T> {
    if (this.delayMs > 0) {
      await new Promise((r) => setTimeout(r, this.delayMs));
    }
    return producer();
  }

  async list<T>(
    entitySet: string,
    query?: ODataQuery
  ): Promise<DataverseListResponse<T>> {
    const source = ENTITY_SOURCES[entitySet];
    if (!source) {
      throw new DataverseError(
        `Mock client bilinmeyen entity set: ${entitySet}`,
        400
      );
    }

    return this.simulate(() => {
      let rows = [...(source() as Record<string, unknown>[])];

      // $filter
      if (query?.$filter) {
        const predicate = compileFilter(query.$filter);
        rows = rows.filter(predicate);
      }

      const totalCount = rows.length;

      // $orderby
      if (query?.$orderby) {
        const sorter = compileOrderBy(query.$orderby);
        rows.sort(sorter);
      }

      // $skip / $top
      if (query?.$skip) rows = rows.slice(query.$skip);
      if (query?.$top !== undefined) rows = rows.slice(0, query.$top);

      // $select — shallow projection
      let projected: unknown[] = rows;
      if (query?.$select) {
        const fields = query.$select.split(",").map((f) => f.trim());
        projected = rows.map((r) => {
          const obj: Record<string, unknown> = {};
          for (const f of fields) {
            if (f in r) obj[f] = r[f];
          }
          return obj;
        });
      }

      return {
        value: projected as T[],
        totalCount: query?.$count ? totalCount : undefined,
      };
    });
  }

  async listAll<T>(
    entitySet: string,
    query?: ODataQuery,
    _onProgress?: (loaded: number) => void
  ): Promise<DataverseListResponse<T>> {
    // Mock has no real pagination — single call returns everything.
    // Strip any `$top`/`$skip` so the user gets the full dataset.
    const cleanQuery = { ...(query ?? {}) };
    delete cleanQuery.$top;
    delete cleanQuery.$skip;
    const result = await this.list<T>(entitySet, cleanQuery);
    _onProgress?.(result.value.length);
    return result;
  }

  async get<T>(
    entitySet: string,
    id: string,
    query?: ODataQuery
  ): Promise<T> {
    const source = ENTITY_SOURCES[entitySet];
    if (!source) {
      throw new DataverseError(
        `Mock client bilinmeyen entity set: ${entitySet}`,
        400
      );
    }

    return this.simulate(() => {
      const pk = PRIMARY_KEYS[entitySet] ?? "id";
      const rows = source() as Record<string, unknown>[];
      const found = rows.find((r) => r[pk] === id);
      if (!found) throw new DataverseNotFoundError(entitySet, id);

      // $select
      if (query?.$select) {
        const fields = query.$select.split(",").map((f) => f.trim());
        const obj: Record<string, unknown> = {};
        for (const f of fields) {
          if (f in found) obj[f] = found[f];
        }
        return obj as T;
      }

      // $expand — no-op (mock data is already inlined)
      return found as T;
    });
  }
}

export const mockDataverseClient: DataverseClient = new MockDataverseClient();

// Project type re-export for convenience (mockClient is the canonical source)
export type { Project };
