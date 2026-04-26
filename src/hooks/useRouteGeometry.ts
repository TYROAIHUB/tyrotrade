import * as React from "react";
import length from "@turf/length";
import along from "@turf/along";
import bbox from "@turf/bbox";
import type { Feature, LineString, Position } from "geojson";
import { buildSeaRoute } from "@/lib/routing/seaRoute";
import type { Project } from "@/lib/dataverse/entities";

export interface RouteGeometry {
  line: Feature<LineString>;
  totalKm: number;
  bbox: [number, number, number, number];
  positionAt: (progress: number) => Position;
}

/**
 * Compute and cache route geometry for a project.
 *
 * Two-stage strategy:
 *
 * 1. **Initial render** — synchronously build a fallback line from the
 *    corridor waypoints in `vesselPlan.waypoints` (computed by the composer
 *    via `selectCorridor`). The map shows immediately, no flicker.
 *
 * 2. **Background upgrade** — lazy-import `searoute-ts` on first call and
 *    compute the proper Dijkstra-shortest sea route over a maritime network
 *    graph. When it resolves, replace the line with the accurate one. The
 *    library bundles a ~few-MB graph so dynamic-import keeps it out of the
 *    initial chunk.
 *
 * Results are cached in a module-level Map keyed by the port-pair string
 * so switching between projects with the same loading/discharge ports is
 * instant after the first compute.
 */

type SeaRouteFn = (
  origin: Feature<{ type: "Point"; coordinates: Position }>,
  destination: Feature<{ type: "Point"; coordinates: Position }>,
  units?: "kilometers" | "miles" | "nauticalmiles" | "degrees" | "radians"
) => Feature<LineString>;

let searouteFn: SeaRouteFn | null = null;
let searouteLoadPromise: Promise<SeaRouteFn> | null = null;

async function loadSearoute(): Promise<SeaRouteFn> {
  if (searouteFn) return searouteFn;
  if (searouteLoadPromise) return searouteLoadPromise;
  searouteLoadPromise = import("searoute-ts").then((m) => {
    // Module export shape: `seaRoute` named export OR default export.
    // Cast through `unknown` because searoute-ts upstream types don't
    // line up with the runtime function signature (returns geojson
    // Feature, but its types claim something else).
    const mod = m as unknown as {
      seaRoute?: SeaRouteFn;
      default?: SeaRouteFn;
    };
    const fn = mod.seaRoute ?? mod.default;
    if (!fn) throw new Error("searoute-ts: seaRoute export not found");
    searouteFn = fn;
    return fn;
  });
  return searouteLoadPromise;
}

const lineCache: Map<string, Feature<LineString>> = new Map();

function makeKey(
  lpLon: number,
  lpLat: number,
  dpLon: number,
  dpLat: number
): string {
  // Round to 4 decimals (~11m precision) so trivially-different rounding
  // doesn't fragment the cache.
  const r = (n: number) => n.toFixed(4);
  return `${r(lpLon)},${r(lpLat)}|${r(dpLon)},${r(dpLat)}`;
}

function makePoint(
  lon: number,
  lat: number
): Feature<{ type: "Point"; coordinates: Position }> {
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "Point", coordinates: [lon, lat] },
  };
}

function deriveGeometry(line: Feature<LineString>): RouteGeometry {
  const totalKm = length(line, { units: "kilometers" });
  const bb = bbox(line) as [number, number, number, number];
  // Pad the bbox a bit for visual breathing room.
  const pad = 5;
  const padded: [number, number, number, number] = [
    bb[0] - pad,
    bb[1] - pad,
    bb[2] + pad,
    bb[3] + pad,
  ];
  return {
    line,
    totalKm,
    bbox: padded,
    positionAt: (progress: number): Position => {
      const clamped = Math.max(0, Math.min(1, progress));
      const km = totalKm * clamped;
      const pt = along(line, km, { units: "kilometers" });
      return pt.geometry.coordinates;
    },
  };
}

export function useRouteGeometry(
  project: Project | null
): RouteGeometry | null {
  const lp = project?.vesselPlan?.loadingPort;
  const dp = project?.vesselPlan?.dischargePort;
  const waypoints = project?.vesselPlan?.waypoints;

  // Skip if ports are missing or have unknown coordinates (lat=0, lon=0
  // means the port name didn't resolve in `lookupPort`).
  const portsValid =
    !!lp &&
    !!dp &&
    !(lp.lat === 0 && lp.lon === 0) &&
    !(dp.lat === 0 && dp.lon === 0);

  const cacheKey = portsValid
    ? makeKey(lp.lon, lp.lat, dp.lon, dp.lat)
    : null;

  // Initial state: cache hit OR synchronous fallback corridor line.
  const [line, setLine] = React.useState<Feature<LineString> | null>(() => {
    if (!portsValid || !cacheKey) return null;
    const cached = lineCache.get(cacheKey);
    if (cached) return cached;
    // Compute corridor fallback synchronously so the map renders without
    // a blank frame while searoute-ts is loading.
    return buildSeaRoute(lp, dp, waypoints);
  });

  React.useEffect(() => {
    if (!portsValid || !cacheKey) {
      setLine(null);
      return;
    }
    const cached = lineCache.get(cacheKey);
    if (cached) {
      setLine(cached);
      return;
    }
    // Fallback line first (covers initial render of new project)
    setLine(buildSeaRoute(lp, dp, waypoints));

    // Then upgrade to searoute-ts result
    let cancelled = false;
    loadSearoute()
      .then((seaRoute) => {
        if (cancelled) return;
        try {
          const origin = makePoint(lp.lon, lp.lat);
          const destination = makePoint(dp.lon, dp.lat);
          const route = seaRoute(origin, destination, "kilometers");
          // Validate
          const coords = route?.geometry?.coordinates;
          if (!coords || coords.length < 2) return;
          lineCache.set(cacheKey, route);
          setLine(route);
        } catch (err) {
          // searoute-ts can throw if the points are deep inland or in a
          // disconnected region. Keep the fallback corridor line.
          // eslint-disable-next-line no-console
          console.warn(
            `[useRouteGeometry] searoute-ts failed for ${cacheKey}, using corridor fallback:`,
            err
          );
        }
      })
      .catch((err) => {
        // Module load failure (network / chunk error). Fallback already shown.
        // eslint-disable-next-line no-console
        console.warn("[useRouteGeometry] searoute-ts module load failed:", err);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  return React.useMemo(() => {
    if (!line) return null;
    return deriveGeometry(line);
  }, [line]);
}
