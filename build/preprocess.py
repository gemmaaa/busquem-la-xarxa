#!/usr/bin/env python3
"""
Busquem la Xarxa - data preprocessor.

Downloads the latest JSON dataset from the Diputació de Barcelona open data portal,
parses it into a clean libraries.json, and records freshness metadata.
"""

import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent.parent
RAW_JSON_PATH = ROOT / "raw" / "export.json"
LAST_DOWNLOAD_PATH = ROOT / "raw" / "last_download.json"
OUT_PATH = ROOT / "docs" / "data" / "libraries.json"

DATASET_PAGE = "https://dadesobertes.diba.cat/datasets/biblioteques-municipals"
JSON_URL = "https://do.diba.cat/api/dataset/biblioteques/format/json"

DAYS = ["dilluns", "dimarts", "dimecres", "dijous", "divendres", "dissabte", "diumenge"]
DAY_EN = {
    "dilluns": "monday",
    "dimarts": "tuesday",
    "dimecres": "wednesday",
    "dijous": "thursday",
    "friday": "friday",
    "divendres": "friday",
    "dissabte": "saturday",
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
    if isinstance(s, list):
        s = " ".join([str(x) for x in s if x])
    s = re.sub(r"<br\s*/?>", " ", str(s), flags=re.I)
    s = re.sub(r"</p>", " ", s, flags=re.I)
    s = re.sub(r"<[^>]+>", "", s)
    for a, b in [
        ("&nbsp;", " "), ("&amp;", "&"), ("&lt;", "<"),
        ("&gt;", ">"), ("&quot;", '"'), ("&#39;", "'"),
    ]:
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
    if not raw:
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
            chunk,
            flags=re.I,
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
    m = re.search(
        r"(\d{1,2})\s*(?:d['\u2019]|de\s+)?\s*([a-z\u00e0\u00e8\u00e9\u00ed\u00f2\u00f3\u00fa\u00e7]+)",
        s,
    )
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


def download_json():
    print(f"Downloading {JSON_URL} ...")
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "ca,es;q=0.9,en;q=0.8",
        "Referer": "https://dadesobertes.diba.cat/",
    }

    RAW_JSON_PATH.parent.mkdir(parents=True, exist_ok=True)

    try:
        req = Request(JSON_URL, headers=headers)
        data = urlopen(req, timeout=30).read()
        RAW_JSON_PATH.write_bytes(data)
        print(f"Saved {len(data)} bytes to {RAW_JSON_PATH} via urllib")
        return
    except Exception as e:
        print(f"urllib download failed ({e}), falling back to curl...", file=sys.stderr)

    curl_cmd = [
        "curl", "-sSL",
        "--retry", "3",
        "--retry-delay", "2",
        "-A", headers["User-Agent"],
        "-H", f"Referer: {headers['Referer']}",
        JSON_URL,
        "-o", str(RAW_JSON_PATH)
    ]
    
    result = subprocess.run(curl_cmd, capture_output=True, text=True)
    if result.returncode == 0 and RAW_JSON_PATH.exists() and RAW_JSON_PATH.stat().st_size > 0:
        print(f"Saved {RAW_JSON_PATH.stat().st_size} bytes to {RAW_JSON_PATH} via curl")
    else:
        print(f"ERROR: curl download failed: {result.stderr}", file=sys.stderr)
        sys.exit(1)


def parse_dataset():
    libraries = []
    data = json.loads(RAW_JSON_PATH.read_text(encoding="utf-8"))
    elements = data.get("elements", [])

    for el in elements:
        name = clean_html(el.get("adreca_nom") or el.get("descripcio"))
        if not name:
            continue

        lat, lng = None, None
        loc = el.get("localitzacio") or ""
        if "," in loc:
            try:
                lat_s, lng_s = loc.split(",", 1)
                lat, lng = float(lat_s.strip()), float(lng_s.strip())
            except ValueError:
                pass

        grup_adreca = el.get("grup_adreca") or {}
        address = clean_html(grup_adreca.get("adreca") or grup_adreca.get("adreca_completa"))
        postal_code = clean_html(grup_adreca.get("codi_postal"))
        muni = clean_html(
            grup_adreca.get("municipi_nom")
            or (el.get("rel_municipis") or {}).get("municipi_nom")
        )

        phone_list = el.get("telefon_contacte") or []
        phone = phone_list[0] if isinstance(phone_list, list) and phone_list else str(phone_list)
        email_list = el.get("email") or []
        email = email_list[0] if isinstance(email_list, list) and email_list else str(email_list)
        web = clean_html(el.get("url_general"))

        seasons = {}
        for season_key in ["hivern", "estiu"]:
            day_ranges = {}
            has_any_open = False

            for cat_day in DAYS:
                cell_key = f"horari_{season_key}_{cat_day}"
                raw_val = el.get(cell_key)
                ranges, status = parse_hours_cell(raw_val)
                day_ranges[DAY_EN[cat_day]] = ranges
                if ranges:
                    has_any_open = True

            start_raw = el.get(f"inici_horari_{season_key}")
            start_md = parse_month_day(start_raw) or ("01-01" if season_key == "hivern" else "06-22")
            obs_raw = el.get(f"observacions_{season_key}")
            obs_text = clean_html(obs_raw)

            seasons[season_key] = {
                "start_month_day": start_md,
                "days": day_ranges,
                "observations": obs_text,
                "closures": [],
                "status": "open_season" if has_any_open else "closed_all_week",
            }

        libraries.append({
            "id": str(el.get("punt_id") or ""),
            "name": name,
            "municipality": muni,
            "address": address,
            "postal_code": postal_code,
            "lat": lat,
            "lng": lng,
            "phone": clean_html(phone),
            "email": clean_html(email),
            "web": web,
            "seasons": seasons,
            "flags": [],
        })

    return libraries, data.get("modificacio")


def main():
    force = "--force" in sys.argv
    download_json()
    now = datetime.now(timezone.utc).isoformat()
    libraries, remote_mod = parse_dataset()

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    output = {
        "generated_from": RAW_JSON_PATH.name,
        "data_year": DEFAULT_YEAR,
        "last_updated": remote_mod or now,
        "downloaded_at": now,
        "libraries": libraries,
    }
    OUT_PATH.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(libraries)} libraries to {OUT_PATH}")


if __name__ == "__main__":
    main()
