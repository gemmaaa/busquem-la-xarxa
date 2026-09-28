#!/usr/bin/env python3
"""
Busquem la Xarxa - data preprocessor.

Downloads the latest CSV from Diputació de Barcelona open data portal,
parses it into a clean libraries.json, and records the freshness timestamp.
"""

import csv
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = ROOT / "raw" / "export.csv"
LAST_DOWNLOAD_PATH = ROOT / "raw" / "last_download.json"
OUT_PATH = ROOT / "docs" / "data" / "libraries.json"

DATASET_PAGE = "https://dadesobertes.diba.cat/datasets/biblioteques-municipals"
CSV_URL = "https://do.diba.cat/api/dataset/biblioteques/format/csv"

DAYS = ["dilluns", "dimarts", "dimecres", "dijous", "divendres", "dissabte", "diumenge"]
DAY_EN = {
    "dilluns": "monday", "dimarts": "tuesday", "dimecres": "wednesday",
    "dijous": "thursday", "divendres": "friday", "dissabte": "saturday",
    "diumenge": "sunday",
}

MONTHS = {
    "gener": 1, "febrer": 2, "marc": 3, "març": 3, "abril": 4, "maig": 5,
    "juny": 6, "juliol": 7, "agost": 8, "setembre": 9, "octubre": 10,
    "novembre": 11, "desembre": 12,
}

DEFAULT_YEAR = 2026

def clean_html(s):
    if not s:
        return ""
    s = re.sub(r"<br\s*/?>", " ", str(s), flags=re.I)
    s = re.sub(r"</p>", " ", s, flags=re.I)
    s = re.sub(r"<[^>]+>", "", s)
    for a, b in [("&nbsp;", " "), ("&amp;", "&"), ("&lt;", "<"),
                 ("&gt;", ">"), ("&quot;", '"'), ("&#39;", "'")]:
        s = s.replace(a, b)
    s = re.sub(r"\s+", " ", s)
    return s.strip()

def parse_time(s):
    if not s:
        return None
    s = str(s).strip().replace(".", ":")
    m = re.match(r"^(\d{1,2})(?::(\d{2}))?$", s)
    if not m:
        return None
    h = int(m.group(1))
    mn = int(m.group(2) or 0)
    if h > 23 or mn > 59:
        return None
    return f"{h:02d}:{mn:02d}"

def parse_hours_cell(raw):
    if raw is None:
        return [], "closed"
    s = clean_html(raw).strip()
    if not s:
        return [], "closed"
    low = s.lower()
    if low in ("tancat", "tancada", "tancats", "tancades", "closed", "-"):
        return [], "closed"
    if "tancat" in low and "obert" not in low and not re.search(r"\d", s):
        return [], "closed"

    normalized = s
    normalized = re.sub(r"\bi de\b", "|", normalized, flags=re.I)
    normalized = re.sub(r"\bi\b(?=\s*\d)", "|", normalized)
    normalized = normalized.replace(";", "|").replace("/", "|")

    ranges = []
    for chunk in normalized.split("|"):
        chunk = chunk.strip()
        if not chunk:
            continue
        m = re.search(
            r"(?:de\s+)?(\d{1,2}(?:[.:]\d{2})?)\s*(?:h)?\s*(?:a|-|\u2013|\u2014)\s*"
            r"(\d{1,2}(?:[.:]\d{2})?)\s*(?:h)?",
            chunk, flags=re.I,
        )
        if not m:
            continue
        t1, t2 = parse_time(m.group(1)), parse_time(m.group(2))
        if not t1 or not t2:
            continue
        ranges.append({"from": t1, "to": t2})

    if ranges:
        ranges.sort(key=lambda r: r["from"])
        merged = [ranges[0]]
        for r in ranges[1:]:
            if r["from"] <= merged[-1]["to"]:
                merged[-1]["to"] = max(merged[-1]["to"], r["to"])
            else:
                merged.append(r)
        return merged, "open"

    if re.search(r"\d", s):
        return [], "reduced"
    return [], "closed"

def parse_month_day(s):
    if not s:
        return None
    s = clean_html(s).lower()
    m = re.search(r"(\d{1,2})\s*(?:d['\u2019]|de\s+)?\s*([a-z\u00e0\u00e8\u00e9\u00ed\u00f2\u00f3\u00fa\u00e7]+)", s)
    if not m:
        return None
    day = int(m.group(1))
    month_word = m.group(2)
    month = MONTHS.get(month_word)
    if not month:
        for k, v in MONTHS.items():
            if month_word.startswith(k[:4]):
                month = v
                break
    if not month:
        return None
    return f"{month:02d}-{day:02d}"

def get_row_value(row, keys):
    for k in keys:
        for row_k in row.keys():
            if row_k and row_k.strip().lower() == k.lower():
                return row[row_k]
    return ""

def download_csv():
    print(f"Downloading {CSV_URL} ...")
    req = Request(CSV_URL, headers={"User-Agent": "Mozilla/5.0"})
    data = urlopen(req, timeout=60).read()
    CSV_PATH.parent.mkdir(parents=True, exist_ok=True)
    CSV_PATH.write_bytes(data)
    print(f"Saved {len(data)} bytes to {CSV_PATH}")

def parse_csv():
    libraries = []
    flags_summary = {"no_hours": 0, "reduced_unparsed": 0}

    # Detect delimiter automatically (DIBA exports frequently use ';')
    raw_bytes = CSV_PATH.read_bytes()
    sample = raw_bytes[:4096].decode("utf-8-sig", errors="ignore")
    delimiter = ";" if sample.count(";") > sample.count(",") else ","

    lines = raw_bytes.decode("utf-8-sig", errors="replace").splitlines()
    reader = csv.DictReader(lines, delimiter=delimiter)

    for row in reader:
        name = clean_html(get_row_value(row, ["Nom del lloc", "equipament", "nom", "nom_equipament"]))
        if not name:
            continue

        lat, lng = None, None
        loc = clean_html(get_row_value(row, ["Localització", "localitzacio", "latlong", "geocodificacio"]))
        if "," in loc:
            try:
                lat_s, lng_s = loc.split(",", 1)
                lat, lng = float(lat_s.strip()), float(lng_s.strip())
            except ValueError:
                pass
        else:
            try:
                lat_val = get_row_value(row, ["latitud", "lat"])
                lng_val = get_row_value(row, ["longitud", "lon", "lng"])
                if lat_val and lng_val:
                    lat, lng = float(lat_val), float(lng_val)
            except ValueError:
                pass

        seasons = {}
        flags = []

        for season_key, prefix in [("hivern", "Horari hivern"), ("estiu", "Horari estiu")]:
            day_ranges = {}
            has_any_open = False

            for cat_day in DAYS:
                cell_val = get_row_value(row, [f"{prefix} {cat_day}", f"{season_key}_{cat_day}", f"horari_{cat_day}"])
                ranges, status = parse_hours_cell(cell_val)
                day_ranges[DAY_EN[cat_day]] = ranges
                if ranges:
                    has_any_open = True

            start_raw = get_row_value(row, [f"Inici horari {season_key}", f"inici_{season_key}"])
            start_md = parse_month_day(start_raw) or ("01-01" if season_key == "hivern" else "06-24")

            obs_text = clean_html(get_row_value(row, [f"Observacions {season_key}", f"observacions_{season_key}"]))

            seasons[season_key] = {
                "start_month_day": start_md,
                "days": day_ranges,
                "observations": obs_text,
                "closures": [],
                "status": "open_season" if has_any_open else "closed_all_week",
            }

        libraries.append({
            "id": clean_html(get_row_value(row, ["ID", "codi", "id_equipament"])),
            "name": name,
            "municipality": clean_html(get_row_value(row, ["Nom del municipi", "municipi", "poblacio"])),
            "address": clean_html(get_row_value(row, ["Adreça", "adreca", "direccion"])),
            "postal_code": clean_html(get_row_value(row, ["Codi postal", "cp"])),
            "lat": lat,
            "lng": lng,
            "phone": clean_html(get_row_value(row, ["Telèfon de contacte", "telefon", "phone"])),
            "email": clean_html(get_row_value(row, ["Correu de contacte", "email"])),
            "web": clean_html(get_row_value(row, ["Web", "url"])),
            "seasons": seasons,
            "flags": flags,
        })

    return libraries, flags_summary

def main():
    force = "--force" in sys.argv
    download_csv()
    now = datetime.now(timezone.utc).isoformat()
    libraries, flags_summary = parse_csv()

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    output = {
        "generated_from": CSV_PATH.name,
        "data_year": DEFAULT_YEAR,
        "last_updated": now,
        "downloaded_at": now,
        "libraries": libraries,
    }
    OUT_PATH.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(libraries)} libraries to {OUT_PATH}")

if __name__ == "__main__":
    main()
