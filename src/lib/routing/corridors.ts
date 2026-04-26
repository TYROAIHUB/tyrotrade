/**
 * Sea-route waypoint corridors. Lifted from `scripts/build-mocks.py:42-119`.
 *
 * Real Dataverse data has no waypoint columns — sea routes are inferred
 * from the (origin, destination) port pair. Each corridor is a list of
 * intermediate waypoints (strait crossings, canal entrances, etc.) that
 * keep the route on water — a pure great-circle line would slice through
 * Brazil/Africa/Saudi Arabia for an Argentina → Iraq voyage.
 *
 * Match the build-mocks.py `route()` selector exactly so mock + real
 * projects render identical geometry through the same corridors.
 */

import type { Waypoint } from "@/lib/dataverse/entities";

const wp = (lon: number, lat: number, name?: string): Waypoint =>
  name ? { lon, lat, name } : { lon, lat };

export const ARG_TO_GIB: Waypoint[] = [
  wp(-58.5, -34.6, "Río de la Plata"),
  wp(-55.0, -36.0),
  wp(-45.0, -28.0),
  wp(-30.0, -15.0),
  wp(-22.0, 0.0),
  wp(-22.0, 15.0),
  wp(-18.0, 22.0),
  wp(-10.0, 33.0),
  wp(-5.5, 36.0, "Strait of Gibraltar"),
];

export const BRAZIL_TO_GIB: Waypoint[] = [
  wp(-50.0, -0.5, "Amazon Mouth"),
  wp(-40.0, 2.0),
  wp(-28.0, 8.0),
  wp(-18.0, 22.0),
  wp(-10.0, 35.0),
  wp(-5.5, 36.0, "Strait of Gibraltar"),
];

export const MED_TO_SUEZ: Waypoint[] = [
  wp(5.0, 38.0),
  wp(18.0, 35.5),
  wp(32.3, 31.25, "Port Said (Suez N)"),
];

export const SUEZ_TO_GULF: Waypoint[] = [
  wp(32.55, 29.95, "Suez (Canal S)"),
  wp(35.5, 27.0),
  wp(39.5, 18.0),
  wp(43.4, 12.6, "Bab-el-Mandeb"),
  wp(51.0, 12.5, "Gulf of Aden"),
  wp(58.0, 16.0),
  wp(56.5, 26.5, "Strait of Hormuz"),
  wp(51.0, 28.0),
  wp(49.0, 29.6),
];

export const BLACK_SEA_TO_MED: Waypoint[] = [
  wp(31.5, 45.5),
  wp(30.5, 43.5),
  wp(29.5, 41.5),
  wp(28.97, 41.0, "Bosphorus"),
  wp(28.0, 40.7, "Sea of Marmara"),
  wp(26.5, 40.05, "Dardanelles"),
  wp(25.5, 38.5),
];

export const TURKEY_TO_EGYPT: Waypoint[] = [
  wp(33.5, 35.5),
  wp(32.0, 33.5),
  wp(30.5, 31.7),
];

const ARG_PORTS = new Set(["rosario", "bahiablanca"]);
const BRAZIL_PORTS = new Set(["santarem", "paranagua", "santos"]);
const BLACK_SEA_PORTS = new Set([
  "mykolaiv",
  "odessa",
  "novorossiysk",
  "mariupol",
  "varna",
  "constanta",
]);
const TURKEY_MED_PORTS = new Set([
  "iskenderun",
  "mersin",
  "izmir",
  "istanbul",
  "ambarli",
  "derince",
  "gemlik",
  "bandirma",
  "tekirdag",
]);
const ITALY_PORTS = new Set(["genoa", "trieste", "ravenna"]);
const TURKEY_MED_DEST = new Set(["mersin", "iskenderun", "alexandria"]);

/**
 * Pick a corridor between two ports. Branching mirrors `build-mocks.py:route()`.
 * Falls back to a single midpoint waypoint when no corridor matches. Origin
 * and destination ports themselves are NOT included — caller adds them.
 */
export function selectCorridor(
  originKey: string,
  destKey: string,
  originLonLat: [number, number],
  destLonLat: [number, number]
): Waypoint[] {
  const o = originKey;
  const d = destKey;

  if (ARG_PORTS.has(o) && d === "ummqasr") {
    return [...ARG_TO_GIB, ...MED_TO_SUEZ, ...SUEZ_TO_GULF];
  }
  if (ARG_PORTS.has(o) && ITALY_PORTS.has(d)) {
    return [...ARG_TO_GIB, wp(5.0, 38.0), wp(9.0, 42.5)];
  }
  if (ARG_PORTS.has(o) && TURKEY_MED_DEST.has(d)) {
    return [...ARG_TO_GIB, ...MED_TO_SUEZ.slice(0, 2)];
  }
  if (BRAZIL_PORTS.has(o) && d === "ummqasr") {
    return [...BRAZIL_TO_GIB, ...MED_TO_SUEZ, ...SUEZ_TO_GULF];
  }
  if (BRAZIL_PORTS.has(o) && (d === "mersin" || d === "iskenderun")) {
    return [...BRAZIL_TO_GIB, ...MED_TO_SUEZ.slice(0, 2)];
  }
  if (BLACK_SEA_PORTS.has(o) && d === "ummqasr") {
    return [...BLACK_SEA_TO_MED, ...MED_TO_SUEZ, ...SUEZ_TO_GULF];
  }
  if (BLACK_SEA_PORTS.has(o) && TURKEY_MED_DEST.has(d)) {
    return [...BLACK_SEA_TO_MED, wp(28.0, 36.0), wp(32.0, 35.5)];
  }
  if (TURKEY_MED_PORTS.has(o) && d === "alexandria") {
    return [...TURKEY_TO_EGYPT];
  }
  if (TURKEY_MED_PORTS.has(o) && d === "ummqasr") {
    return [
      ...TURKEY_TO_EGYPT,
      wp(33.0, 31.5),
      ...SUEZ_TO_GULF.slice(2),
    ];
  }

  // Fallback — single midpoint between origin and destination.
  const [ox, oy] = originLonLat;
  const [dx, dy] = destLonLat;
  if (!Number.isFinite(ox) || !Number.isFinite(dx)) return [];
  return [wp((ox + dx) / 2, (oy + dy) / 2)];
}
