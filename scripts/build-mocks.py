"""Parse the real TRYK Projeler Excel export and emit a TypeScript mock
dataset. Extracts vessel names, commodities, quantities, and infers plausible
loading/discharge ports so every row can render on the map."""

import json
import re
import sys
from datetime import datetime, timedelta
from pathlib import Path

import openpyxl  # type: ignore

EXCEL = Path(r"C:/Users/Cenk/Downloads/TRYK Projeler_639126704967068109.xlsx")
OUT = Path(__file__).resolve().parents[1] / "src" / "mocks" / "projects.ts"

# Reference date: match the app's "today" for realistic progress states
TODAY = datetime(2026, 4, 25)

# --- Ports -----------------------------------------------------------------
PORTS = {
    "santarem": ("Santarem", "Brazil", -54.7081, -2.4431),
    "paranagua": ("Paranaguá", "Brazil", -48.5117, -25.5161),
    "santos": ("Santos", "Brazil", -46.3322, -23.9619),
    "rosario": ("Rosario", "Argentina", -60.6505, -33.0084),
    "bahia": ("Bahia Blanca", "Argentina", -62.27, -38.78),
    "mykolaiv": ("Mykolaiv", "Ukraine", 31.9946, 46.9659),
    "odessa": ("Odesa", "Ukraine", 30.7233, 46.4825),
    "novorossiysk": ("Novorossiysk", "Russia", 37.7656, 44.7225),
    "ummqasr": ("Umm Qasr", "Iraq", 47.9333, 30.0297),
    "iskenderun": ("İskenderun", "Türkiye", 36.1631, 36.5862),
    "mersin": ("Mersin", "Türkiye", 34.6418, 36.7967),
    "izmir": ("İzmir", "Türkiye", 27.1428, 38.4237),
    "alexandria": ("Alexandria", "Egypt", 29.9187, 31.2001),
    "trieste": ("Trieste", "Italy", 13.7768, 45.6495),
    "genoa": ("Genoa", "Italy", 8.9319, 44.4056),
    "beirut": ("Beirut", "Lebanon", 35.5018, 33.9008),
    "jeddah": ("Jeddah", "Saudi Arabia", 39.2010, 21.4858),
    "aqaba": ("Aqaba", "Jordan", 35.0083, 29.5267),
    "newOrleans": ("New Orleans", "USA", -90.0715, 29.9511),
}

# --- Waypoint corridors ----------------------------------------------------
ARG_TO_GIB = [
    (-58.5, -34.6, "Río de la Plata"),
    (-55.0, -36.0, None),
    (-45.0, -28.0, None),
    (-30.0, -15.0, None),
    (-22.0, 0.0, None),
    (-22.0, 15.0, None),
    (-18.0, 22.0, None),
    (-10.0, 33.0, None),
    (-5.5, 36.0, "Strait of Gibraltar"),
]
BRAZIL_TO_GIB = [
    (-50.0, -0.5, "Amazon Mouth"),
    (-40.0, 2.0, None),
    (-28.0, 8.0, None),
    (-18.0, 22.0, None),
    (-10.0, 35.0, None),
    (-5.5, 36.0, "Strait of Gibraltar"),
]
MED_TO_SUEZ = [
    (5.0, 38.0, None),
    (18.0, 35.5, None),
    (32.3, 31.25, "Port Said (Suez N)"),
]
SUEZ_TO_GULF = [
    (32.55, 29.95, "Suez (Canal S)"),
    (35.5, 27.0, None),
    (39.5, 18.0, None),
    (43.4, 12.6, "Bab-el-Mandeb"),
    (51.0, 12.5, "Gulf of Aden"),
    (58.0, 16.0, None),
    (56.5, 26.5, "Strait of Hormuz"),
    (51.0, 28.0, None),
    (49.0, 29.6, None),
]
BLACK_SEA_TO_MED = [
    (31.5, 45.5, None),
    (30.5, 43.5, None),
    (29.5, 41.5, None),
    (28.97, 41.0, "Bosphorus"),
    (28.0, 40.7, "Sea of Marmara"),
    (26.5, 40.05, "Dardanelles"),
    (25.5, 38.5, None),
]
TURKEY_TO_EGYPT = [
    (33.5, 35.5, None),
    (32.0, 33.5, None),
    (30.5, 31.7, None),
]


def route(origin: str, dest: str):
    """Return list of (lon, lat, name?) waypoints between two port codes."""
    o = origin
    d = dest
    if o in ("rosario", "bahia") and d == "ummqasr":
        return ARG_TO_GIB + MED_TO_SUEZ + SUEZ_TO_GULF
    if o in ("rosario", "bahia") and d in ("genoa", "trieste"):
        return ARG_TO_GIB + [(5.0, 38.0, None), (9.0, 42.5, None)]
    if o in ("rosario", "bahia") and d in ("mersin", "iskenderun", "alexandria"):
        return ARG_TO_GIB + MED_TO_SUEZ[:2]
    if o in ("santarem", "paranagua", "santos") and d == "ummqasr":
        return BRAZIL_TO_GIB + MED_TO_SUEZ + SUEZ_TO_GULF
    if o in ("santarem", "paranagua", "santos") and d in ("mersin", "iskenderun"):
        return BRAZIL_TO_GIB + MED_TO_SUEZ[:2]
    if o in ("mykolaiv", "odessa", "novorossiysk") and d == "ummqasr":
        return BLACK_SEA_TO_MED + MED_TO_SUEZ + SUEZ_TO_GULF
    if o in ("mykolaiv", "odessa", "novorossiysk") and d in ("mersin", "iskenderun", "alexandria"):
        return BLACK_SEA_TO_MED + [(28.0, 36.0, None), (32.0, 35.5, None)]
    if o in ("iskenderun", "mersin", "izmir") and d == "alexandria":
        return TURKEY_TO_EGYPT
    if o in ("iskenderun", "mersin", "izmir") and d == "ummqasr":
        return TURKEY_TO_EGYPT + [(33.0, 31.5, None)] + SUEZ_TO_GULF[2:]
    # fallback — direct with one mid waypoint
    ox, oy = PORTS[o][2], PORTS[o][3]
    dx, dy = PORTS[d][2], PORTS[d][3]
    return [((ox + dx) / 2, (oy + dy) / 2, None)]


# --- Parsing heuristics ----------------------------------------------------
CARGO_KEYWORDS = {
    "CORN": ("CORN", "MISIR — DANE", "TCR", "THL", "MSR", "bulker"),
    "MISIR": ("CORN", "MISIR — DANE", "TCR", "THL", "MSR", "bulker"),
    "WHEAT": ("WHEAT", "BUĞDAY", "TCR", "THL", "BGD", "bulker"),
    "BUĞDAY": ("WHEAT", "BUĞDAY", "TCR", "THL", "BGD", "bulker"),
    "SBM": ("SOYBEAN MEAL (SBM)", "SOYA KÜSPESİ (SBM)", "TCR", "THL", "SBM", "bulker"),
    "SOYBEAN MEAL": ("SOYBEAN MEAL (SBM)", "SOYA KÜSPESİ", "TCR", "THL", "SBM", "bulker"),
    "SBO": ("SOYBEAN OIL (SBO)", "SOYA YAĞI - HAM", "TCR", "YYT", "SBO", "tanker"),
    "SOY OIL": ("SOYBEAN OIL (SBO)", "SOYA YAĞI - HAM", "TCR", "YYT", "SBO", "tanker"),
    "SOYBEAN OIL": ("SOYBEAN OIL (SBO)", "SOYA YAĞI - HAM", "TCR", "YYT", "SBO", "tanker"),
    "SUNFLOWER": ("SUNFLOWER OIL", "AYÇİÇEK YAĞI", "TCR", "YYT", "SFO", "tanker"),
    "AYÇİÇEK": ("SUNFLOWER OIL", "AYÇİÇEK YAĞI", "TCR", "YYT", "SFO", "tanker"),
    "SOYA FASULYESI": ("SOYBEAN", "SOYA FASULYESİ", "TCR", "YYT", "SOY", "bulker"),
    "SOYBEAN": ("SOYBEAN", "SOYA FASULYESİ", "TCR", "YYT", "SOY", "bulker"),
    "SOYA": ("SOYBEAN", "SOYA FASULYESİ", "TCR", "YYT", "SOY", "bulker"),
    "SBPP": ("SOYBEAN BY-PRODUCT", "SOYA YAN ÜRÜN", "TCR", "YYT", "SBP", "bulker"),
    "RME": ("RAPESEED MEAL", "KANOLA KÜSPESİ", "TCR", "THL", "RME", "bulker"),
}

GROUP_DEFAULT_CARGO = {
    "TAHIL": CARGO_KEYWORDS["CORN"],
    "YAGLITOHUM": CARGO_KEYWORDS["SOYBEAN"],
    "BAKLIYAT": ("PULSES", "BAKLIYAT", "TCR", "BLG", "BKL", "bulker"),
}


def detect_cargo(name: str, group: str):
    up = (name or "").upper()
    for key, val in CARGO_KEYWORDS.items():
        if key in up:
            return val
    return GROUP_DEFAULT_CARGO.get(group, CARGO_KEYWORDS["CORN"])


def detect_origin(name: str, group: str, currency: str):
    up = (name or "").upper()
    if "BRZ" in up or "BRAZIL" in up or "COFCO" in up:
        return "santarem"
    if "ARG" in up or "ARGENTINA" in up or "AGD" in up or "VITERRA" in up or "AVERE" in up or "AGROFINA" in up:
        return "rosario"
    if "TR " in up or "TR/" in up or "TURKISH" in up or "GTC" in up or up.startswith("TR"):
        return "iskenderun"
    if "NIBULON" in up or "UKR" in up or "UKRAINE" in up or "ODESA" in up or "MYKOLAIV" in up:
        return "mykolaiv"
    if "RUS" in up or currency == "RUB":
        return "novorossiysk"
    if "GAVILON" in up or "LOSUR" in up or "INERCO" in up or "TOI" in up:
        # often Argentinian export channels
        return "rosario"
    # heuristic by group
    if group == "TAHIL":
        return "mykolaiv"
    return "rosario"


def detect_destination(name: str, supplier: str, incoterm: str):
    up = (name or "").upper() + " " + (supplier or "").upper()
    if "SAMA ALMANAR" in up or "ALMANAR" in up or "IRAQ" in up:
        return "ummqasr"
    if "VITERRA" in up and ("SALE" in up or "IT" in up):
        return "iskenderun"
    if "EGYPT" in up:
        return "alexandria"
    if "ITALY" in up or "GENOA" in up or "GENOVA" in up:
        return "genoa"
    if "LEBANON" in up or "BEIRUT" in up:
        return "beirut"
    if "JEDDAH" in up or "SAUDI" in up:
        return "jeddah"
    # defaults: most TYRO trades end at Umm Qasr or Turkish ports
    return "ummqasr"


# Curated Pexels CDN URLs — verified 200 (curl-checked). Large commercial
# vessels: bulkers, tankers, container ships in port and at sea. Distributed
# across projects by hash so the fleet view feels varied but stable.
VESSEL_PHOTOS = [
    "https://images.pexels.com/photos/1554646/pexels-photo-1554646.jpeg?auto=compress&cs=tinysrgb&w=1200",
    "https://images.pexels.com/photos/753331/pexels-photo-753331.jpeg?auto=compress&cs=tinysrgb&w=1200",
    "https://images.pexels.com/photos/2144326/pexels-photo-2144326.jpeg?auto=compress&cs=tinysrgb&w=1200",
    "https://images.pexels.com/photos/1099532/pexels-photo-1099532.jpeg?auto=compress&cs=tinysrgb&w=1200",
    "https://images.pexels.com/photos/1738986/pexels-photo-1738986.jpeg?auto=compress&cs=tinysrgb&w=1200",
    "https://images.pexels.com/photos/1123262/pexels-photo-1123262.jpeg?auto=compress&cs=tinysrgb&w=1200",
]


def pick_hero_image(pno: str, kind: str, cargo: str) -> str:
    # Stable hash-based assignment: same project always gets the same picture.
    idx = sum(ord(c) for c in pno)
    return VESSEL_PHOTOS[idx % len(VESSEL_PHOTOS)]


RE_VESSEL = re.compile(
    r"(?<![\d.,])\b(?:MV|MT|M/V|M/T)[ \-/]+([A-Z][A-Z0-9 \-]{1,30})",
    re.IGNORECASE,
)
RE_QTY = re.compile(r"(\d{1,3}[\.,]?\d{0,3})\s*(K?MT|MT|TON|TONS)", re.IGNORECASE)


def extract_vessel(name: str, fallback: str):
    """Find vessel name in project title. Prefer the LAST MV/MT occurrence
    since the vessel name almost always appears at the end of the string
    (quantity markers like '30.000 MT' appear earlier)."""
    if not name:
        return fallback
    matches = list(RE_VESSEL.finditer(name))
    if not matches:
        return fallback
    m = matches[-1]
    v = m.group(1).strip(" -/.,").upper()
    v = re.split(r"\s{2,}|\s*-\s*|/|\(", v)[0].strip()
    return v[:32] if v else fallback


def extract_quantity_tons(name: str, default: int):
    m = RE_QTY.search(name or "")
    if not m:
        return default
    raw = m.group(1).replace(",", ".")
    unit = m.group(2).upper()
    try:
        val = float(raw)
    except ValueError:
        return default
    if "K" in unit:
        val *= 1000
    # normalize weirdly small values (e.g. 30.000 means 30,000 MT)
    if val < 100 and "." in raw:
        val *= 1000
    if val < 100:
        return default
    return int(val)


def detect_supplier(name: str, group: str):
    up = (name or "").upper()
    candidates = [
        "NIBULON",
        "COFCO",
        "AGD TRADE",
        "AGD",
        "VITERRA",
        "AVERE",
        "GAVILON",
        "LOSUR",
        "INERCO",
        "TOI COMMODITIES",
        "BTG PACTUAL",
        "GTC",
        "AGROFINA",
        "CARGILL",
        "ADM",
        "ARASA",
    ]
    for c in candidates:
        if c in up:
            return c
    return "INTERNATIONAL SUPPLIER"


def detect_buyer(name: str, supplier: str):
    up = (name or "").upper()
    if "SAMA ALMANAR" in up:
        return "SAMA ALMANAR FOR GENERAL TRADING"
    if "COFCO" in up and supplier != "COFCO":
        return "COFCO TRADING"
    if "MC FOOD" in up:
        return "MC FOOD"
    if "TIRYAKI" in up:
        return "TIRYAKI INTERNATIONAL DMCC"
    return "TIRYAKI INTERNATIONAL DMCC"


# --- Milestone generator ---------------------------------------------------


def build_milestones(project_date: datetime, status: str):
    """Given the project open date, generate a realistic milestone sequence.
    Phases are distributed to make the map/progress show variety across the
    whole dataset — older projects tend to be complete, newer ones in early
    stages."""
    # If project is "Kapalı" (closed) — show fully completed delivery
    if status and status.strip().lower() in ("kapalı", "kapali"):
        lp_eta = project_date + timedelta(days=5)
        return {
            "vesselStatus": "Completed",
            "operationStatus": "Cargo discharged",
            "lpEta": lp_eta.isoformat()[:10],
            "lpNorAccepted": (lp_eta + timedelta(days=1)).isoformat()[:10],
            "lpSd": (lp_eta + timedelta(days=3)).isoformat()[:10],
            "lpEd": (lp_eta + timedelta(days=7)).isoformat()[:10],
            "blDate": (lp_eta + timedelta(days=8)).isoformat()[:10],
            "dpEta": (lp_eta + timedelta(days=45)).isoformat()[:10],
            "dpNorAccepted": (lp_eta + timedelta(days=46)).isoformat()[:10],
            "actualQtyRatio": 1.0,
        }

    days_since_open = (TODAY - project_date).days

    if days_since_open < 0:
        # future-dated, barely started
        return {
            "vesselStatus": "Pending",
            "operationStatus": "Awaiting loading nomination",
            "lpEta": (project_date + timedelta(days=15)).isoformat()[:10],
            "lpNorAccepted": None,
            "lpSd": None,
            "lpEd": None,
            "blDate": None,
            "dpEta": None,
            "dpNorAccepted": None,
            "actualQtyRatio": 0.0,
        }

    # Map elapsed time to progress stage
    if days_since_open < 5:
        stage = "at-loading-port"
    elif days_since_open < 14:
        stage = "loading"
    elif days_since_open < 60:
        stage = "in-transit"
    elif days_since_open < 75:
        stage = "at-discharge-port"
    else:
        stage = "discharged"

    lp_eta = project_date + timedelta(days=3)
    lp_nor = lp_eta + timedelta(days=1) if stage != "at-loading-port" or days_since_open >= 4 else None
    lp_sd = lp_eta + timedelta(days=3) if stage in ("loading", "in-transit", "at-discharge-port", "discharged") else None
    lp_ed = lp_eta + timedelta(days=7) if stage in ("in-transit", "at-discharge-port", "discharged") else None
    bl = lp_ed + timedelta(days=1) if lp_ed else None
    dp_eta = lp_eta + timedelta(days=55)
    dp_nor = dp_eta + timedelta(days=1) if stage == "discharged" else None

    op_status = {
        "at-loading-port": "Going to the loading dock",
        "loading": "Loading in progress",
        "in-transit": "At sea — eastbound to discharge",
        "at-discharge-port": "Approaching discharge port",
        "discharged": "Cargo discharged",
    }[stage]

    return {
        "vesselStatus": "Completed" if stage == "discharged" else "Commenced",
        "operationStatus": op_status,
        "lpEta": lp_eta.isoformat()[:10],
        "lpNorAccepted": lp_nor.isoformat()[:10] if lp_nor else None,
        "lpSd": lp_sd.isoformat()[:10] if lp_sd else None,
        "lpEd": lp_ed.isoformat()[:10] if lp_ed else None,
        "blDate": bl.isoformat()[:10] if bl else None,
        "dpEta": dp_eta.isoformat()[:10] if stage in ("in-transit", "at-discharge-port", "discharged") else None,
        "dpNorAccepted": dp_nor.isoformat()[:10] if dp_nor else None,
        "actualQtyRatio": {
            "at-loading-port": 0.0,
            "loading": 0.55,
            "in-transit": 1.0,
            "at-discharge-port": 1.0,
            "discharged": 1.0,
        }[stage],
    }


# --- TS serialization ------------------------------------------------------


def ts_str(val):
    if val is None:
        return "null"
    if isinstance(val, bool):
        return "true" if val else "false"
    if isinstance(val, (int, float)):
        return repr(val)
    if isinstance(val, str):
        # escape backslashes and backticks/quotes minimally
        return '"' + val.replace("\\", "\\\\").replace('"', '\\"') + '"'
    raise TypeError(f"unsupported type: {type(val)}")


def dump_obj(obj, indent=2):
    pad = " " * indent
    lines = ["{"]
    for k, v in obj.items():
        lines.append(f'{pad}  {k}: {dump_value(v, indent + 2)},')
    lines.append(f"{pad}}}")
    return "\n".join(lines)


def dump_value(v, indent):
    pad = " " * indent
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return repr(v)
    if isinstance(v, str):
        return ts_str(v)
    if isinstance(v, list):
        if not v:
            return "[]"
        items = [dump_value(x, indent + 2) for x in v]
        return "[\n" + "\n".join(f"{pad}  {it}," for it in items) + f"\n{pad}]"
    if isinstance(v, dict):
        lines = ["{"]
        for k, vv in v.items():
            lines.append(f'{pad}  {k}: {dump_value(vv, indent + 2)},')
        lines.append(f"{pad}}}")
        return "\n".join(lines)
    raise TypeError(f"unsupported type: {type(v)}")


# --- Main ------------------------------------------------------------------


def main():
    wb = openpyxl.load_workbook(EXCEL, data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    headers = [h.strip() if isinstance(h, str) else h for h in rows[0]]

    def col(row, name):
        try:
            i = headers.index(name)
            return row[i]
        except ValueError:
            return None

    projects = []

    skipped = 0
    for raw in rows[1:]:
        pno = col(raw, "Proje No")
        if not pno:
            continue
        mode = col(raw, "Teslimat şekli") or "Gemi"
        # Everything that isn't explicit road goes through the maritime pipeline
        if mode not in ("Gemi", "Konteyner"):
            mode = "Gemi"

        name = str(col(raw, "Proje Adı") or "")
        desc = str(col(raw, "Açıklama") or name)
        group = str(col(raw, "Proje grup no") or "TAHIL")
        trader = str(col(raw, "Trader no") or "TRD-FTB")
        main_trader = str(col(raw, "Ana Trader no") or trader)
        cust = col(raw, "Satıcı hesabı")
        cust = str(cust) if cust else None
        currency = str(col(raw, "Para birimi") or "USD")
        trade_type = str(col(raw, "Proje ticaret şekilleri") or "TICARET")
        p_date_raw = col(raw, "Proje Tarihi")
        if isinstance(p_date_raw, datetime):
            p_date = p_date_raw
        elif isinstance(p_date_raw, str) and p_date_raw:
            try:
                p_date = datetime.fromisoformat(p_date_raw[:10])
            except ValueError:
                p_date = TODAY - timedelta(days=45)
        else:
            p_date = TODAY - timedelta(days=45)
        status = str(col(raw, "Durum") or "Açık")
        segment = col(raw, "Segment")
        segment = str(segment) if segment else "International"
        incoterm = str(col(raw, "Teslimat koşulları") or "FOB")
        organic_raw = col(raw, "Organik ?")
        if isinstance(organic_raw, str):
            organic = organic_raw.strip().lower() in ("evet", "yes", "true", "1")
        else:
            organic = bool(organic_raw) if organic_raw is not None else None
        tx_dir = col(raw, "İşlem Yönü")
        tx_dir = str(tx_dir) if tx_dir else None
        op_period = col(raw, "Operasyon periyodu")
        op_period = str(op_period) if op_period else None

        # Skip weird/system rows
        if group == "IDARI":
            continue

        # Parse cargo, origin, dest
        cargo = detect_cargo(name, group)
        origin = detect_origin(name, group, currency)
        dest = detect_destination(name, "", incoterm)
        vessel = extract_vessel(name, f"MV {pno[-6:]}")
        qty_mt = extract_quantity_tons(name, 40000)
        supplier = detect_supplier(name, group)
        buyer = detect_buyer(name, supplier)

        ms = build_milestones(p_date, status)
        actual_qty = int(qty_mt * ms.pop("actualQtyRatio"))

        cargo_product, line_product_name, lvl1, lvl2, lvl3, photo_kind = cargo
        unit_price = {
            "CORN": 275.0,
            "WHEAT": 310.0,
            "SOYBEAN MEAL (SBM)": 400.0,
            "SOYBEAN OIL (SBO)": 935.0,
            "SOYBEAN": 467.0,
            "SUNFLOWER OIL": 960.0,
            "SOYBEAN BY-PRODUCT": 290.0,
            "RAPESEED MEAL": 320.0,
            "PULSES": 700.0,
        }.get(cargo_product, 400.0)
        cargo_value_usd = int(qty_mt * unit_price)

        # Cost estimate scales with shipment value
        freight = int(cargo_value_usd * 0.07)
        insurance = int(cargo_value_usd * 0.004)
        duties = int(cargo_value_usd * 0.012) if dest == "ummqasr" else 0
        other = int(cargo_value_usd * 0.002)
        total = freight + insurance + duties + other
        # Actual cost scales with progress
        actual_ratio = 0.3 if ms["vesselStatus"] == "Pending" else (
            0.9 if status in ("Kapalı", "Kapali") else 0.7
        )
        booked = int(total * actual_ratio)
        invoiced = int(booked * (0.9 if status in ("Kapalı", "Kapali") else 0.55))
        paid = int(invoiced * (1.0 if status in ("Kapalı", "Kapali") else 0.6))

        wps = route(origin, dest)
        waypoints = [
            {"lon": x, "lat": y, **({"name": n} if n else {})} for x, y, n in wps
        ]

        loading_port = {
            "name": PORTS[origin][0],
            "country": PORTS[origin][1],
            "lon": PORTS[origin][2],
            "lat": PORTS[origin][3],
        }
        discharge_port = {
            "name": PORTS[dest][0],
            "country": PORTS[dest][1],
            "lon": PORTS[dest][2],
            "lat": PORTS[dest][3],
        }

        fixture_id = f"FFIX{str(pno)[-6:].zfill(6)}"

        project = {
            "projectNo": str(pno),
            "projectName": name,
            "projectGroup": group,
            "traderNo": trader,
            "mainTraderNo": main_trader,
            "customerAccount": cust,
            "description": desc,
            "currency": currency if currency in ("USD", "EUR", "TRY") else "USD",
            "tradeType": trade_type,
            "segment": segment,
            "deliveryMode": mode,
            "incoterm": incoterm,
            "status": status,
            "workflowStatus": "Gönderilmedi" if status == "Açık" else "Tamamlandı",
            "projectDate": p_date.isoformat()[:10],
            "organic": organic,
            "transactionDirection": tx_dir,
            "operationPeriod": op_period,
            "vesselPlan": {
                "vesselName": vessel,
                "fixtureId": fixture_id,
                "voyage": 1,
                "vesselStatus": ms["vesselStatus"],
                "operationStatus": ms["operationStatus"],
                "supplier": supplier,
                "buyer": buyer,
                "cargoProduct": cargo_product,
                "voyageTotalTonnage": qty_mt,
                "actualQuantity": actual_qty,
                "cargoValueUsd": cargo_value_usd,
                "loadingPort": loading_port,
                "dischargePort": discharge_port,
                "waypoints": waypoints,
                "milestones": {
                    "lpEta": ms["lpEta"],
                    "lpNorAccepted": ms["lpNorAccepted"],
                    "lpSd": ms["lpSd"],
                    "lpEd": ms["lpEd"],
                    "blDate": ms["blDate"],
                    "dpEta": ms["dpEta"],
                    "dpNorAccepted": ms["dpNorAccepted"],
                },
                "heroImageUrl": pick_hero_image(str(pno), photo_kind, cargo_product),
            },
            "lines": [
                {
                    "itemCode": f"{lvl3}{str(pno)[-3:]}",
                    "productName": line_product_name,
                    "quantityKg": qty_mt * 1000,
                    "unit": "KG",
                    "unitPrice": unit_price,
                    "currency": currency if currency in ("USD", "EUR", "TRY") else "USD",
                    "level1": lvl1,
                    "level2": lvl2,
                    "level3": lvl3,
                    "qualityClass": "K1",
                }
            ],
            "costEstimate": {
                "freightUsd": freight,
                "insuranceUsd": insurance,
                "dutiesUsd": duties,
                "otherUsd": other,
                "totalUsd": total,
            },
            "actualCost": {
                "bookedUsd": booked,
                "invoicedUsd": invoiced,
                "paidUsd": paid,
            },
        }
        projects.append(project)

    print(f"Parsed {len(projects)} projects (skipped {skipped})", file=sys.stderr)

    # Emit TS
    lines = [
        '// AUTO-GENERATED from TRYK Projeler Excel via scripts/build-mocks.py',
        '// Do not edit by hand — re-run the script to regenerate.',
        'import type { Project } from "@/lib/dataverse/entities";',
        "",
        f"export const mockProjects: Project[] = [",
    ]
    for p in projects:
        lines.append("  " + dump_value(p, 2) + ",")
    lines.append("];")
    lines.append("")
    lines.append(
        "export const findProject = (projectNo: string): Project | undefined =>\n"
        "  mockProjects.find((p) => p.projectNo === projectNo);"
    )

    OUT.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {OUT} ({OUT.stat().st_size // 1024} KB)", file=sys.stderr)


if __name__ == "__main__":
    main()
