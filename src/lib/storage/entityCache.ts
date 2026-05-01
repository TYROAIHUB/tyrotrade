/**
 * Persistent localStorage cache for Data Inspector entity rows.
 *
 * - One cache slot per entity set (key: `tyro:dv:<entitySet>`)
 * - Stores `{ fetchedAt, value, totalCount? }`
 * - "Verileri Güncelle" overwrites the slot
 * - Survives page reloads — user sees last-fetched data instantly on reopen
 * - 5MB browser quota limit per origin → graceful degradation on quota error
 *
 * After every successful write a same-tab `tyro:cache-updated` CustomEvent
 * fires (window-scoped) so subscribers (`useCacheFingerprint` etc.) can
 * re-derive without waiting for the next render. Cross-tab updates are
 * still covered by the native `storage` event.
 */

const KEY_PREFIX = "tyro:dv:";

/** Custom event fired on the window after a successful cache write.
 *  Same-tab `localStorage.setItem` does NOT fire the native `storage`
 *  event, so consumers listen to this instead. */
export const CACHE_UPDATED_EVENT = "tyro:cache-updated";

export interface CacheUpdatedDetail {
  entitySet: string;
}

function dispatchCacheUpdated(entitySet: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<CacheUpdatedDetail>(CACHE_UPDATED_EVENT, {
      detail: { entitySet },
    })
  );
}

export interface EntityCacheEntry<T = Record<string, unknown>> {
  /** ISO timestamp when this snapshot was captured */
  fetchedAt: string;
  /** Raw rows */
  value: T[];
  /** Server-reported total (may be undefined if `$count` wasn't requested) */
  totalCount?: number;
}

function key(entitySet: string): string {
  return `${KEY_PREFIX}${entitySet}`;
}

export function readCache<T = Record<string, unknown>>(
  entitySet: string
): EntityCacheEntry<T> | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(key(entitySet));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as EntityCacheEntry<T>;
    if (!parsed?.fetchedAt || !Array.isArray(parsed.value)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeCache<T = Record<string, unknown>>(
  entitySet: string,
  entry: EntityCacheEntry<T>
): { ok: boolean; reason?: string } {
  if (typeof localStorage === "undefined") {
    return { ok: false, reason: "no-localStorage" };
  }
  const k = key(entitySet);
  const payload = JSON.stringify(entry);
  try {
    localStorage.setItem(k, payload);
    dispatchCacheUpdated(entitySet);
    return { ok: true };
  } catch (err) {
    // QuotaExceededError handler — three escalating strategies:
    //   1. Remove the slot we're about to write (stale large payload?)
    //      and retry. Cheapest, no other-entity damage.
    //   2. If still full, evict OTHER `tyro:dv:*` entries one at a
    //      time, oldest `fetchedAt` first, retrying after each.
    //      Other entities will be re-fetched on the next refresh
    //      cycle so this is a worthwhile tradeoff against losing
    //      the entity we're trying to persist now.
    //   3. Give up; data lives only in the in-session React state
    //      via the cache-updated event listeners.
    const firstReason = err instanceof Error ? err.name : "unknown";
    try {
      localStorage.removeItem(k);
      localStorage.setItem(k, payload);
      dispatchCacheUpdated(entitySet);
      return { ok: true };
    } catch (err2) {
      // Still no room — try evicting other caches by age until the
      // payload fits. Stops when localStorage accepts the write OR
      // when there's nothing else left to evict.
      const evicted = evictOtherCachesUntilWriteFits(k, payload);
      if (evicted.ok) {
        dispatchCacheUpdated(entitySet);
        // eslint-disable-next-line no-console
        console.warn(
          `[entityCache] ${entitySet} took ${evicted.evictedKeys.length} cross-key evictions to fit. Evicted: ${evicted.evictedKeys.join(", ")}`
        );
        return { ok: true };
      }
      const reason2 = err2 instanceof Error ? err2.name : firstReason;
      // eslint-disable-next-line no-console
      console.warn(
        `[entityCache] localStorage write failed for ${entitySet}: ${reason2}. Data is in-session only.`
      );
      return { ok: false, reason: reason2 };
    }
  }
}

/**
 * Walk all other `tyro:dv:*` entries oldest-first (by `fetchedAt`)
 * and remove them one at a time, attempting the target write after
 * each removal. Returns ok=true the moment the write succeeds, with
 * the list of keys evicted. Stops when the localStorage accepts the
 * payload OR no more candidates remain.
 *
 * The projects header cache (`mserp_etgtryprojecttableentities`) is
 * the LAST candidate evicted — losing it would force a full
 * cold-start refresh on next page load, while losing any other
 * entity just costs a single re-fetch in the next refresh chain.
 */
function evictOtherCachesUntilWriteFits(
  targetKey: string,
  payload: string
): { ok: boolean; evictedKeys: string[] } {
  const PROJECTS_KEY = `${KEY_PREFIX}mserp_etgtryprojecttableentities`;
  const candidates: Array<{ key: string; fetchedAt: string }> = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith(KEY_PREFIX) || k === targetKey) continue;
    try {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as { fetchedAt?: string } | null;
      const fa = parsed?.fetchedAt ?? "";
      candidates.push({ key: k, fetchedAt: fa });
    } catch {
      candidates.push({ key: k, fetchedAt: "" });
    }
  }
  // Sort oldest first; push the projects header to the very end so
  // it's the last thing we'd ever evict.
  candidates.sort((a, b) => {
    if (a.key === PROJECTS_KEY) return 1;
    if (b.key === PROJECTS_KEY) return -1;
    return a.fetchedAt.localeCompare(b.fetchedAt);
  });
  const evictedKeys: string[] = [];
  for (const c of candidates) {
    localStorage.removeItem(c.key);
    evictedKeys.push(c.key.slice(KEY_PREFIX.length));
    try {
      localStorage.setItem(targetKey, payload);
      return { ok: true, evictedKeys };
    } catch {
      // keep evicting
    }
  }
  return { ok: false, evictedKeys };
}

export function clearCache(entitySet: string): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(key(entitySet));
}

export function clearAllCaches(): void {
  if (typeof localStorage === "undefined") return;
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(KEY_PREFIX)) keysToRemove.push(k);
  }
  for (const k of keysToRemove) localStorage.removeItem(k);
}

/** All cached entity sets and their `fetchedAt` timestamps — for diagnostics. */
export function listCacheSnapshots(): Array<{
  entitySet: string;
  fetchedAt: string;
  count: number;
}> {
  if (typeof localStorage === "undefined") return [];
  const out: Array<{ entitySet: string; fetchedAt: string; count: number }> = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith(KEY_PREFIX)) continue;
    try {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as EntityCacheEntry;
      out.push({
        entitySet: k.slice(KEY_PREFIX.length),
        fetchedAt: parsed.fetchedAt,
        count: parsed.value?.length ?? 0,
      });
    } catch {
      // skip
    }
  }
  return out.sort((a, b) => b.fetchedAt.localeCompare(a.fetchedAt));
}
