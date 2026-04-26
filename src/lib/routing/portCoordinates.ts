/**
 * Port name → {lat, lon, country} lookup, lifted from `scripts/build-mocks.py`
 * and extended for the real Dataverse data set.
 *
 * Real Dataverse rows expose only port **text names** (`mserp_tryloadingport`,
 * `mserp_trydischargeport`) — no coordinate columns. The map needs lat/lon to
 * draw routes and animate the vessel marker, so we maintain this static
 * dictionary as the source of truth for ports Tiryaki ships through.
 *
 * When the dictionary doesn't know a port, `lookupPort` returns null and the
 * raw name is recorded via `noteUnresolvedPort` so we can grow the dictionary
 * during smoke tests.
 */

import type { Port } from "@/lib/dataverse/entities";

interface PortRecord {
  name: string;
  country: string;
  lon: number;
  lat: number;
  /** Normalised aliases that map to this record. Lowercase, diacritic-stripped,
   *  non-alphanumerics removed. The canonical key (Record key) is also a valid
   *  alias automatically. */
  aliases: string[];
}

/** Canonical port records keyed by normalised name. */
export const PORT_RECORDS: Record<string, PortRecord> = {
  // ── South America (build-mocks.py PORTS) ─────────────────────────────────
  santarem: {
    name: "Santarem",
    country: "Brazil",
    lon: -54.7081,
    lat: -2.4431,
    aliases: ["santarem"],
  },
  paranagua: {
    name: "Paranaguá",
    country: "Brazil",
    lon: -48.5117,
    lat: -25.5161,
    aliases: ["paranagua"],
  },
  santos: {
    name: "Santos",
    country: "Brazil",
    lon: -46.3322,
    lat: -23.9619,
    aliases: ["santos"],
  },
  rosario: {
    name: "Rosario",
    country: "Argentina",
    lon: -60.6505,
    lat: -33.0084,
    aliases: ["rosario", "rosarioar", "rosario (ar)"],
  },
  bahiablanca: {
    name: "Bahia Blanca",
    country: "Argentina",
    lon: -62.27,
    lat: -38.78,
    aliases: ["bahia", "bahiablanca", "bahía blanca", "bahiablanca,rosarioar", "bahiablanca,rosario"],
  },

  // ── Black Sea + Ukraine + Russia ─────────────────────────────────────────
  mykolaiv: {
    name: "Mykolaiv",
    country: "Ukraine",
    lon: 31.9946,
    lat: 46.9659,
    aliases: ["mykolaiv", "nikolaev"],
  },
  odessa: {
    name: "Odesa",
    country: "Ukraine",
    lon: 30.7233,
    lat: 46.4825,
    aliases: ["odessa", "odesa"],
  },
  novorossiysk: {
    name: "Novorossiysk",
    country: "Russia",
    lon: 37.7656,
    lat: 44.7225,
    aliases: ["novorossiysk", "novorossisk"],
  },
  mariupol: {
    name: "Mariupol",
    country: "Ukraine",
    lon: 37.5407,
    lat: 47.0971,
    aliases: ["mariupol"],
  },
  varna: {
    name: "Varna",
    country: "Bulgaria",
    lon: 27.9147,
    lat: 43.2141,
    aliases: ["varna"],
  },
  constanta: {
    name: "Constanța",
    country: "Romania",
    lon: 28.6348,
    lat: 44.1733,
    aliases: ["constanta", "constanța"],
  },

  // ── Middle East / Gulf ───────────────────────────────────────────────────
  ummqasr: {
    name: "Umm Qasr",
    country: "Iraq",
    lon: 47.9333,
    lat: 30.0297,
    aliases: ["ummqasr", "um qasr", "ummkasr", "ummalqasr", "umm al qasr"],
  },
  jeddah: {
    name: "Jeddah",
    country: "Saudi Arabia",
    lon: 39.201,
    lat: 21.4858,
    aliases: ["jeddah", "jiddah"],
  },
  aqaba: {
    name: "Aqaba",
    country: "Jordan",
    lon: 35.0083,
    lat: 29.5267,
    aliases: ["aqaba", "akaba"],
  },
  beirut: {
    name: "Beirut",
    country: "Lebanon",
    lon: 35.5018,
    lat: 33.9008,
    aliases: ["beirut", "beyrut"],
  },
  tartous: {
    name: "Tartous",
    country: "Syria",
    lon: 35.8867,
    lat: 34.8921,
    aliases: ["tartous", "tartus"],
  },
  latakia: {
    name: "Latakia",
    country: "Syria",
    lon: 35.7805,
    lat: 35.5138,
    aliases: ["latakia", "lazkiye"],
  },

  // ── Türkiye ──────────────────────────────────────────────────────────────
  iskenderun: {
    name: "İskenderun",
    country: "Türkiye",
    lon: 36.1631,
    lat: 36.5862,
    aliases: ["iskenderun", "iskendrun"],
  },
  mersin: {
    name: "Mersin",
    country: "Türkiye",
    lon: 34.6418,
    lat: 36.7967,
    aliases: ["mersin", "icel", "içel"],
  },
  izmir: {
    name: "İzmir",
    country: "Türkiye",
    lon: 27.1428,
    lat: 38.4237,
    aliases: ["izmir", "smyrna"],
  },
  istanbul: {
    name: "İstanbul",
    country: "Türkiye",
    lon: 28.9784,
    lat: 41.0082,
    aliases: ["istanbul"],
  },
  ambarli: {
    name: "Ambarlı",
    country: "Türkiye",
    lon: 28.6936,
    lat: 40.9755,
    aliases: ["ambarli"],
  },
  derince: {
    name: "Derince",
    country: "Türkiye",
    lon: 29.8126,
    lat: 40.7492,
    aliases: ["derince"],
  },
  gemlik: {
    name: "Gemlik",
    country: "Türkiye",
    lon: 29.1502,
    lat: 40.4304,
    aliases: ["gemlik"],
  },
  bandirma: {
    name: "Bandırma",
    country: "Türkiye",
    lon: 27.969,
    lat: 40.3505,
    aliases: ["bandirma", "bandırma"],
  },
  tekirdag: {
    name: "Tekirdağ",
    country: "Türkiye",
    lon: 27.5113,
    lat: 40.9833,
    aliases: ["tekirdag", "tekirdağ"],
  },
  karasu: {
    name: "Karasu",
    country: "Türkiye",
    lon: 30.6884,
    lat: 41.0911,
    aliases: ["karasu"],
  },
  samsun: {
    name: "Samsun",
    country: "Türkiye",
    lon: 36.33,
    lat: 41.2867,
    aliases: ["samsun"],
  },
  giresun: {
    name: "Giresun",
    country: "Türkiye",
    lon: 38.3899,
    lat: 40.9128,
    aliases: ["giresun"],
  },
  trabzon: {
    name: "Trabzon",
    country: "Türkiye",
    lon: 39.7239,
    lat: 41.0053,
    aliases: ["trabzon"],
  },

  // ── Mediterranean / Europe ───────────────────────────────────────────────
  alexandria: {
    name: "Alexandria",
    country: "Egypt",
    lon: 29.9187,
    lat: 31.2001,
    aliases: ["alexandria", "iskenderiye"],
  },
  damietta: {
    name: "Damietta",
    country: "Egypt",
    lon: 31.7917,
    lat: 31.4178,
    aliases: ["damietta", "dumyat"],
  },
  portsaid: {
    name: "Port Said",
    country: "Egypt",
    lon: 32.2841,
    lat: 31.2653,
    aliases: ["portsaid", "port said"],
  },
  sokhna: {
    name: "Sokhna",
    country: "Egypt",
    lon: 32.3433,
    lat: 29.6,
    aliases: ["sokhna", "ainsokhna", "ain sokhna"],
  },
  trieste: {
    name: "Trieste",
    country: "Italy",
    lon: 13.7768,
    lat: 45.6495,
    aliases: ["trieste"],
  },
  genoa: {
    name: "Genoa",
    country: "Italy",
    lon: 8.9319,
    lat: 44.4056,
    aliases: ["genoa", "genova"],
  },
  ravenna: {
    name: "Ravenna",
    country: "Italy",
    lon: 12.2839,
    lat: 44.4928,
    aliases: ["ravenna"],
  },
  piraeus: {
    name: "Piraeus",
    country: "Greece",
    lon: 23.6395,
    lat: 37.9484,
    aliases: ["piraeus", "pire"],
  },
  algeciras: {
    name: "Algeciras",
    country: "Spain",
    lon: -5.4477,
    lat: 36.1408,
    aliases: ["algeciras"],
  },
  split: {
    name: "Split",
    country: "Croatia",
    lon: 16.4402,
    lat: 43.5081,
    aliases: ["split"],
  },
  koper: {
    name: "Koper",
    country: "Slovenia",
    lon: 13.7345,
    lat: 45.5469,
    aliases: ["koper"],
  },

  // ── South America (continued) ────────────────────────────────────────────
  sanlorenzo: {
    name: "San Lorenzo",
    country: "Argentina",
    lon: -60.7395,
    lat: -32.7531,
    aliases: ["sanlorenzo", "san lorenzo", "sanlorenzoar"],
  },
  recalada: {
    name: "Recalada",
    country: "Argentina",
    lon: -57.5,
    lat: -39.0,
    aliases: ["recalada"],
  },
  timbues: {
    name: "Timbúes",
    country: "Argentina",
    lon: -60.7136,
    lat: -32.6628,
    aliases: ["timbues", "timbúes"],
  },
  riogrande: {
    name: "Rio Grande",
    country: "Brazil",
    lon: -52.099,
    lat: -32.035,
    aliases: ["riogrande", "rio grande"],
  },
  saofranciscodosul: {
    name: "São Francisco do Sul",
    country: "Brazil",
    lon: -48.6388,
    lat: -26.2434,
    aliases: ["saofranciscodosul", "sao francisco do sul", "são francisco do sul"],
  },
  itacoatiara: {
    name: "Itacoatiara",
    country: "Brazil",
    lon: -58.4424,
    lat: -3.1421,
    aliases: ["itacoatiara"],
  },
  barcarena: {
    name: "Barcarena",
    country: "Brazil",
    lon: -48.6383,
    lat: -1.506,
    aliases: ["barcarena"],
  },
  viladoconde: {
    name: "Vila do Conde",
    country: "Brazil",
    lon: -48.7415,
    lat: -1.4884,
    aliases: ["viladoconde", "vila do conde"],
  },
  recife: {
    name: "Recife",
    country: "Brazil",
    lon: -34.8819,
    lat: -8.0631,
    aliases: ["recife"],
  },
  maceio: {
    name: "Maceió",
    country: "Brazil",
    lon: -35.7406,
    lat: -9.6498,
    aliases: ["maceio", "maceió"],
  },
  saosebastiao: {
    name: "São Sebastião",
    country: "Brazil",
    lon: -45.401,
    lat: -23.7902,
    aliases: ["saosebastiao", "sao sebastiao", "são sebastião"],
  },
  puertocabello: {
    name: "Puerto Cabello",
    country: "Venezuela",
    lon: -68.0,
    lat: 10.48,
    aliases: ["puertocabello", "puerto cabello", "cabello"],
  },

  // ── More Black Sea / Russia / Ukraine ────────────────────────────────────
  yeisk: {
    name: "Yeisk",
    country: "Russia",
    lon: 38.272,
    lat: 46.706,
    aliases: ["yeisk", "yeysk"],
  },
  rostov: {
    name: "Rostov-on-Don",
    country: "Russia",
    lon: 39.7188,
    lat: 47.2225,
    aliases: ["rostov", "rostovondon", "rostov-on-don"],
  },
  taman: {
    name: "Taman",
    country: "Russia",
    lon: 36.7136,
    lat: 45.2086,
    aliases: ["taman"],
  },
  azov: {
    name: "Azov",
    country: "Russia",
    lon: 39.4226,
    lat: 47.1119,
    aliases: ["azov"],
  },
  kavkaz: {
    name: "Kavkaz",
    country: "Russia",
    lon: 36.6661,
    lat: 45.3597,
    aliases: ["kavkaz"],
  },
  kaliningrad: {
    name: "Kaliningrad",
    country: "Russia",
    lon: 20.5118,
    lat: 54.7104,
    aliases: ["kaliningrad"],
  },
  pivdennyi: {
    name: "Pivdennyi",
    country: "Ukraine",
    lon: 31.027,
    lat: 46.624,
    aliases: ["pivdennyi", "yuzhny"],
  },
  chornomorsk: {
    name: "Chornomorsk",
    country: "Ukraine",
    lon: 30.6473,
    lat: 46.301,
    aliases: ["chornomorsk", "illichivsk"],
  },

  // ── Mediterranean / Europe (continued) ───────────────────────────────────
  thessaloniki: {
    name: "Thessaloniki",
    country: "Greece",
    lon: 22.9329,
    lat: 40.6403,
    aliases: ["thessaloniki", "selanik"],
  },
  volos: {
    name: "Volos",
    country: "Greece",
    lon: 22.9419,
    lat: 39.3622,
    aliases: ["volos"],
  },
  tarragona: {
    name: "Tarragona",
    country: "Spain",
    lon: 1.2554,
    lat: 41.1167,
    aliases: ["tarragona"],
  },
  pozzallo: {
    name: "Pozzallo",
    country: "Italy",
    lon: 14.8478,
    lat: 36.7295,
    aliases: ["pozzallo"],
  },
  rostock: {
    name: "Rostock",
    country: "Germany",
    lon: 12.131,
    lat: 54.0887,
    aliases: ["rostock"],
  },
  rouen: {
    name: "Rouen",
    country: "France",
    lon: 1.0993,
    lat: 49.4432,
    aliases: ["rouen"],
  },
  tripoli_lb: {
    name: "Tripoli",
    country: "Lebanon",
    lon: 35.8425,
    lat: 34.4332,
    aliases: ["tripolilb", "tripoli (lb)", "tripoli"],
  },

  // ── Middle East / Gulf (continued) ───────────────────────────────────────
  bandarimamkhomeini: {
    name: "Bandar Imam Khomeini",
    country: "Iran",
    lon: 49.0768,
    lat: 30.4341,
    aliases: ["bandarimamkhomeini", "bandar imam khomeini", "bandarimam"],
  },
  abudhabi: {
    name: "Abu Dhabi",
    country: "UAE",
    lon: 54.3705,
    lat: 24.4539,
    aliases: ["abudhabi", "abu dhabi"],
  },

  // ── Africa ───────────────────────────────────────────────────────────────
  djibouti: {
    name: "Djibouti",
    country: "Djibouti",
    lon: 43.1456,
    lat: 11.5886,
    aliases: ["djibouti"],
  },
  massawa: {
    name: "Massawa",
    country: "Eritrea",
    lon: 39.453,
    lat: 15.6088,
    aliases: ["massawa"],
  },
  daressalaam: {
    name: "Dar es Salaam",
    country: "Tanzania",
    lon: 39.301,
    lat: -6.8161,
    aliases: ["daressalaam", "dar-es-salaam", "dar es salaam"],
  },
  tema: {
    name: "Tema",
    country: "Ghana",
    lon: 0.0166,
    lat: 5.6364,
    aliases: ["tema"],
  },
  apapa: {
    name: "Apapa",
    country: "Nigeria",
    lon: 3.358,
    lat: 6.4494,
    aliases: ["apapa"],
  },
  abukammash: {
    name: "Abu Kammash",
    country: "Libya",
    lon: 11.5894,
    lat: 33.0625,
    aliases: ["abukammash", "abu kammash"],
  },

  // ── India / South Asia ───────────────────────────────────────────────────
  kandla: {
    name: "Kandla",
    country: "India",
    lon: 70.2177,
    lat: 23.0334,
    aliases: ["kandla"],
  },

  // ── Australia ────────────────────────────────────────────────────────────
  newcastle_au: {
    name: "Newcastle",
    country: "Australia",
    lon: 151.7878,
    lat: -32.9283,
    aliases: ["newcastleau", "newcastle (au)", "newcastle"],
  },

  // ── Americas ─────────────────────────────────────────────────────────────
  neworleans: {
    name: "New Orleans",
    country: "USA",
    lon: -90.0715,
    lat: 29.9511,
    aliases: ["neworleans", "new orleans"],
  },
  darrow: {
    name: "Darrow",
    country: "USA",
    lon: -90.9683,
    lat: 30.1346,
    aliases: ["darrow"],
  },
  allen_la: {
    name: "Port Allen",
    country: "USA",
    lon: -91.2094,
    lat: 30.4505,
    aliases: ["allenla", "allenlouisiana", "allen (louisiana)", "portallen"],
  },
  mobile: {
    name: "Mobile",
    country: "USA",
    lon: -88.0399,
    lat: 30.6944,
    aliases: ["mobile"],
  },
  houston: {
    name: "Houston",
    country: "USA",
    lon: -95.3007,
    lat: 29.7372,
    aliases: ["houston"],
  },
  portland_or: {
    name: "Portland",
    country: "USA",
    lon: -122.6784,
    lat: 45.5152,
    aliases: ["portlandor", "portlandoregon", "portland (oregon)", "portland"],
  },
  vancouver_us: {
    name: "Vancouver",
    country: "USA",
    lon: -122.6615,
    lat: 45.6387,
    aliases: ["vancouverus", "vancouver (us)", "vancouverwa"],
  },
};

/** Normalisation: lowercase → strip Turkish diacritics → strip non-alphanumerics.
 *  Must match `canonKey()` in the composer for corridor key consistency. */
export function normalisePortKey(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .toLowerCase()
    .replace(/i̇/g, "i")
    .replace(/[ıİ]/g, "i")
    .replace(/[şŞ]/g, "s")
    .replace(/[ğĞ]/g, "g")
    .replace(/[öÖ]/g, "o")
    .replace(/[üÜ]/g, "u")
    .replace(/[çÇ]/g, "c")
    .replace(/[áàâãä]/g, "a")
    .replace(/[éèêë]/g, "e")
    .replace(/[íìîï]/g, "i")
    .replace(/[óòôõö]/g, "o")
    .replace(/[úùûü]/g, "u")
    .replace(/[ñ]/g, "n")
    .replace(/[^a-z0-9]/g, "");
}

// Build alias → canonical key index once at module init.
const ALIAS_INDEX: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const [canon, rec] of Object.entries(PORT_RECORDS)) {
    m.set(canon, canon);
    m.set(normalisePortKey(rec.name), canon);
    for (const a of rec.aliases) {
      const k = normalisePortKey(a);
      if (k) m.set(k, canon);
    }
  }
  return m;
})();

const unresolvedPorts: Set<string> = new Set();

function noteUnresolvedPort(raw: string): void {
  if (!raw) return;
  unresolvedPorts.add(raw);
}

/** Lookup by free-form Dataverse port string. Returns null when no match.
 *
 *  Resolution order:
 *   1. Exact normalised match — e.g. `"Bahia Blanca"` → `bahiablanca`.
 *   2. Strip the first parenthetical / comma-separated segment and retry.
 *      Handles common Dataverse formatting like `"Rosario (AR)"` (country
 *      code in parens) and `"BAHIA BLANCA,Rosario (AR)"` (multi-port lists).
 *   3. Give up — record the raw string for diagnostics.
 */
export function lookupPort(rawName: string | null | undefined): Port | null {
  const k = normalisePortKey(rawName);
  if (!k) return null;
  let canon = ALIAS_INDEX.get(k);
  if (!canon && rawName) {
    // Try the first segment before space, paren, or comma — covers
    // "Rosario (AR)", "Allen (Louisiana)", "BAHIA BLANCA,Rosario", etc.
    const head = rawName.split(/[\s(,]/)[0];
    if (head) {
      const k2 = normalisePortKey(head);
      if (k2 && k2 !== k) canon = ALIAS_INDEX.get(k2);
    }
  }
  if (!canon) {
    if (rawName) noteUnresolvedPort(rawName);
    return null;
  }
  const rec = PORT_RECORDS[canon];
  return { name: rec.name, country: rec.country, lon: rec.lon, lat: rec.lat };
}

/** Same lookup but also accepts a country hint (currently unused for
 *  disambiguation since no port name collides across countries in our set,
 *  but kept as an API hook for future growth). */
export function lookupPortWithCountry(
  rawName: string | null | undefined,
  _countryHint?: string | null
): Port | null {
  return lookupPort(rawName);
}

/** Diagnostic: list raw port strings encountered at runtime that didn't match. */
export function getUnresolvedPorts(): string[] {
  return [...unresolvedPorts].sort();
}

/** Reset the unresolved set — used by tests / hot reloads. */
export function resetUnresolvedPorts(): void {
  unresolvedPorts.clear();
}

/** Resolve a port to its canonical key (for corridor selection). Returns
 *  empty string when no match. */
export function canonicalPortKey(rawName: string | null | undefined): string {
  const k = normalisePortKey(rawName);
  if (!k) return "";
  return ALIAS_INDEX.get(k) ?? "";
}
