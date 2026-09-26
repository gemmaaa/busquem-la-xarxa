#!/usr/bin/env python3
"""
Busquem la Xarxa - data preprocessor.

Downloads the latest CSV from the Diputacio de Barcelona open data portal,
parses it into a clean libraries.json, and records the freshness timestamp.

Usage:
    python build/preprocess.py           # only re-downloads if source changed
    python build/preprocess.py --force   # always re-download and re-parse
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

# Paste the CSV download URL here. Find it by opening the dataset page,
# clicking the CSV resource, and copying the download link.
CSV_URL = "https://do.diba.cat/api/dataset/biblioteques/format/csv"

DAYS = ["dilluns", "dimarts", "dimecres", "dijous", "divendres", "dissabte", "diumenge"]
DAY_EN = {
    "dilluns": "monday", "dimarts": "tuesday", "dimecres": "wednesday",
    "dijous": "thursday", "divendres": "friday", "dissabte": "saturday",
    "diumenge": "sunday",
}

MONTHS = {
    "gener": 1, "febrer": 2, "marc": 3, "marc": 3, "abril": 4, "maig": 5,
    "juny": 6, "juliol": 7, "agost": 8, "setembre": 9, "octubre": 10,
    "novembre": 11, "desembre": 12,
}
# handle accented "marc"
MONTHS["marc"] = 3

DEFAULT_YEAR = 2026


# ---------------------------------------------------------------------------
# HTML / text cleanup
# ---------------------------------------------------------------------------

def clean_html(s):
    if not s:
        return ""
    s = re.sub(r"<br\s*/?>", " ", s, flags=re.I)
    s = re.sub(r"</p>", " ", s, flags=re.I)
    s = re.sub(r"<[^>]+>", "", s)
    for a, b in [("&nbsp;", " "), ("&amp;", "&"), ("&lt;", "<"),
                 ("&gt;", ">"), ("&quot;", '"'), ("&#39;", "'")]:
        s = s.replace(a, b)
    s = re.sub(r"\s+", " ", s)
    return s.strip()


# ---------------------------------------------------------------------------
# Time parsing
# ---------------------------------------------------------------------------

def parse_time(s):
    if not s:
        return None
    s = s.strip().replace(".", ":")
    m = re.match(r"^(\d{1,2})(?::(\d{2}))?$", s)
    if not m:
        return None
    h = int(m.group(1))
    mn = int(m.group(2) or 0)
    if h > 23 or mn > 59:
        return None
    return f"{h:02d}:{mn:02d}"


def parse_hours_cell(raw):
    """Return (ranges, status). status in {open, closed, reduced}."""
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
    """'31 d'agost' -> '08-31'. Returns MM-DD or None."""
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


def extract_season_observations(obs_html):
    s = clean_html(obs_html)
    s = re.sub(
        r"L'horari d'(hivern|estiu) comen\u00e7a el dia:\s*\d{1,2}\s*"
        r"(?:d['\u2019]|de\s+)?\s*\w+\.?",
        "", s, flags=re.I,
    )
    s = re.sub(r"Observacions de l'horari:\s*", "", s, flags=re.I)
    return s.strip()


# ---------------------------------------------------------------------------
# Closure parsing (best effort)
# ---------------------------------------------------------------------------

DATE_RE = re.compile(
    r"(\d{1,2})\s*(?:d['\u2019]|de\s+)?\s*([a-z\u00e0\u00e8\u00e9\u00ed\u00f2\u00f3\u00fa\u00e7]+)"
    r"(?:\s+de\s+(\d{4}))?",
    flags=re.I,
)

CLOSURE_KEYWORDS = [
    "tancat", "tanca", "festiu", "pont", "vacances",
    "redu\u00eft", "reduit", "horari especial", "no obre",
]


def parse_closures(obs_text, year=DEFAULT_YEAR):
    if not obs_text:
        return [], []

    text = obs_text
    closures = []
    unparsed = []
    consumed_spans = []

    # Ranges: "del 5 al 7 de setembre", "de l'1 al 30 d'agost",
    #         "del 25 de desembre de 2026 al 9 de gener de 2027"
    range_re = re.compile(
        r"(?:del|de\s+l['\u2019]|des\s+del|des\s+de\s+l['\u2019]|entre\s+el)\s+"
        r"(\d{1,2})\s*(?:d['\u2019]|de\s+)?\s*([a-z\u00e0\u00e8\u00e9\u00ed\u00f2\u00f3\u00fa\u00e7]+)"
        r"(?:\s+de\s+(\d{4}))?\s+"
        r"(?:al|fins\s+al|a)\s+"
        r"(\d{1,2})\s*(?:d['\u2019]|de\s+)?\s*([a-z\u00e0\u00e8\u00e9\u00ed\u00f2\u00f3\u00fa\u00e7]+)"
        r"(?:\s+de\s+(\d{4}))?",
        flags=re.I,
    )
    for m in range_re.finditer(text):
        d1, m1, y1, d2, m2, y2 = m.groups()
        mm1 = MONTHS.get(m1.lower()) or MONTHS.get(m1.lower()[:4])
        mm2 = MONTHS.get(m2.lower()) or MONTHS.get(m2.lower()[:4])
        if not mm1 or not mm2:
            unparsed.append(m.group(0))
            continue
        yy1 = int(y1) if y1 else year
        yy2 = int(y2) if y2 else yy1
        if (mm2, int(d2)) < (mm1, int(d1)) and not y2:
            yy2 = yy1 + 1
        try:
            start = f"{yy1:04d}-{mm1:02d}-{int(d1):02d}"
            end = f"{yy2:04d}-{mm2:02d}-{int(d2):02d}"
        except ValueError:
            unparsed.append(m.group(0))
            continue
        snippet = text[max(0, m.start() - 40):m.end() + 40].lower()
        ctype = "closed"
        if any(k in snippet for k in ["redu\u00eft", "reduit", "nom\u00e9s mat\u00ed", "nom\u00e9s al mat\u00ed"]):
            ctype = "reduced"
        closures.append({
            "from": start, "to": end, "type": ctype,
            "note": m.group(0).strip(),
        })
        consumed_spans.append((m.start(), m.end()))

    def overlaps(a, b):
        return any(not (b[1] <= s or b[0] >= e) for s, e in consumed_spans)

    for m in DATE_RE.finditer(text):
        if overlaps(m.start(), m.end()):
            continue
        d, mon, y = m.groups()
        mm = MONTHS.get(mon.lower()) or MONTHS.get(mon.lower()[:4])
        if not mm:
            continue
        yy = int(y) if y else year
        snippet = text[max(0, m.start() - 40):m.end() + 40].lower()
        if " obert" in snippet or " oberta" in snippet:
            continue
        if (" a " in snippet and "de " in snippet
                and not any(k in snippet for k in CLOSURE_KEYWORDS)):
            continue
        if not any(k in snippet for k in CLOSURE_KEYWORDS):
            continue
        ctype = "closed"
        if any(k in snippet for k in ["redu\u00eft", "reduit", "horari especial", "nom\u00e9s mat\u00ed"]):
            ctype = "reduced"
        try:
            date = f"{yy:04d}-{mm:02d}-{int(d):02d}"
        except ValueError:
            continue
        closures.append({"date": date, "type": ctype, "note": m.group(0).strip()})

    # Alternating / whitelist Saturdays
    alt_match = re.search(
        r"dissabtes\s+d['\u2019]?\s*obertura[^:]*:\s*(.+?)(?:\.|$)",
        text, flags=re.I | re.S,
    )
    if alt_match:
        block = alt_match.group(1)
        month_chunks = re.split(
            r"([A-Z\u00c0\u00c8\u00c9\u00cd\u00d2\u00d3\u00da\u00c7]{4,})\s*:",
            block,
        )
        i = 1
        while i + 1 < len(month_chunks):
            month_word = month_chunks[i].strip().lower()
            days_str = month_chunks[i + 1]
            mm = MONTHS.get(month_word) or next(
                (v for k, v in MONTHS.items() if month_word.startswith(k[:4])),
                None,
            )
            if mm:
                for d in re.findall(r"\b(\d{1,2})\b", days_str):
                    try:
                        closures.append({
                            "date": f"{year:04d}-{mm:02d}-{int(d):02d}",
                            "type": "open_override",
                            "note": "Dissabte d'obertura",
                        })
                    except ValueError:
                        pass
            i += 2

    whitelist_match = re.search(
        r"obert\s+els\s+seg\u00fcents\s+dissabtes[^:]*:\s*(.+?)(?:\.|$)",
        text, flags=re.I | re.S,
    )
    if whitelist_match:
        for m in DATE_RE.finditer(whitelist_match.group(1)):
            d, mon, y = m.groups()
            mm = MONTHS.get(mon.lower()) or MONTHS.get(mon.lower()[:4])
            if not mm:
                continue
            yy = int(y) if y else year
            try:
                closures.append({
                    "date": f"{yy:04d}-{mm:02d}-{int(d):02d}",
                    "type": "open_override",
                    "note": "Dissabte d'obertura",
                })
            except ValueError:
                pass

    seen = set()
    dedup = []
    for c in closures:
        key = (c.get("date") or (c.get("from"), c.get("to")), c["type"])
        if key in seen:
            continue
        seen.add(key)
        dedup.append(c)
    return dedup, unparsed


# ---------------------------------------------------------------------------
# Freshness check + download
# ---------------------------------------------------------------------------

def fetch_last_updated():
    try:
        req = Request(DATASET_PAGE, headers={"User-Agent": "Mozilla/5.0"})
        html = urlopen(req, timeout=30).read().decode("utf-8", errors="replace")
    except Exception as e:
        print(f"WARNING: could not fetch dataset page: {e}", file=sys.stderr)
        return None

    m = re.search(
        r"Darrera actualitzaci[o\u00f3]\s*:?\s*(.{0,120})",
        html, flags=re.I | re.S,
    )
    if not m:
        return None
    raw = re.sub(r"<[^>]+>", "", m.group(1)).strip()
    raw = re.sub(r"\s+", " ", raw)[:120]
    return raw


def load_last_download():
    if LAST_DOWNLOAD_PATH.exists():
        try:
            return json.loads(LAST_DOWNLOAD_PATH.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}


def save_last_download(info):
    LAST_DOWNLOAD_PATH.parent.mkdir(parents=True, exist_ok=True)
    LAST_DOWNLOAD_PATH.write_text(
        json.dumps(info, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def download_csv():
    if "PASTE_CSV" in CSV_URL:
        print("ERROR: set CSV_URL at the top of preprocess.py", file=sys.stderr)
        sys.exit(1)
    print(f"Downloading {CSV_URL} ...")
    req = Request(CSV_URL, headers={"User-Agent": "Mozilla/5.0"})
    data = urlopen(req, timeout=60).read()
    CSV_PATH.parent.mkdir(parents=True, exist_ok=True)
    CSV_PATH.write_bytes(data)
    print(f"Saved {len(data)} bytes to {CSV_PATH}")


# ---------------------------------------------------------------------------
# Parse CSV -> libraries.json
# ---------------------------------------------------------------------------

def parse_csv():
    libraries = []
    flags_summary = {"no_hours": 0, "reduced_unparsed": 0, "closures_unparsed": 0}

    with CSV_PATH.open(encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            name = (row.get("Nom del lloc") or "").strip()
            if not name:
                continue

            lat, lng = None, None
            loc = (row.get("Localitzaci\u00f3") or "").strip()
            if "," in loc:
                try:
                    lat_s, lng_s = loc.split(",", 1)
                    lat = float(lat_s)
                    lng = float(lng_s)
                except ValueError:
                    pass

            seasons = {}
            flags = []
            all_unparsed = []

            for season_key, prefix in [("hivern", "Horari hivern"), ("estiu", "Horari estiu")]:
                day_ranges = {}
                has_any_open = False

                for cat_day in DAYS:
                    ranges, status = parse_hours_cell(row.get(f"{prefix} {cat_day}", ""))
                    day_ranges[DAY_EN[cat_day]] = ranges
                    if ranges:
                        has_any_open = True
                    elif status == "reduced":
                        flags.append(f"{season_key}_{cat_day}_reduced")
                        flags_summary["reduced_unparsed"] += 1

                start_raw = row.get(
                    "Inici horari hivern" if season_key == "hivern" else "Inici horari estiu",
                    "",
                )
                start_md = parse_month_day(start_raw)

                obs_col = "Observacions hivern" if season_key == "hivern" else "Observacions estiu"
                obs_text = extract_season_observations(row.get(obs_col, ""))

                closures, unparsed = parse_closures(obs_text)
                all_unparsed.extend(unparsed)

                season_status = "unknown"
                if not has_any_open:
                    season_status = "closed_all_week"

                seasons[season_key] = {
                    "start_month_day": start_md,
                    "days": day_ranges,
                    "observations": obs_text,
                    "closures": closures,
                    "status": season_status,
                }

            if not any(
                any(seasons[s]["days"][d] for d in seasons[s]["days"])
                for s in seasons
            ):
                flags.append("no_hours_at_all")
                flags_summary["no_hours"] += 1

            if all_unparsed:
                flags_summary["closures_unparsed"] += len(all_unparsed)

            libraries.append({
                "id": (row.get("ID") or row.get("_id") or "").strip(),
                "name": name,
                "municipality": (row.get("Nom del municipi") or "").strip(),
                "address": (row.get("Adre\u00e7a") or "").strip(),
                "postal_code": (row.get("Codi postal") or "").strip(),
                "lat": lat,
                "lng": lng,
                "phone": (row.get("Tel\u00e8fon de contacte") or "").strip(),
                "email": (row.get("Correu de contacte") or "").strip(),
                "web": (row.get("Web") or "").strip(),
                "seasons": seasons,
                "flags": flags,
            })

    return libraries, flags_summary


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    force = "--force" in sys.argv
    last = load_last_download()
    remote_stamp = fetch_last_updated()

    if not force and remote_stamp and last.get("remote_stamp") == remote_stamp:
        print(f"Data unchanged (remote says: {remote_stamp}). Nothing to do.")
        print("Use --force to re-run anyway.")
        return

    if remote_stamp:
        print(f"Remote last-updated: {remote_stamp}")
    else:
        print("Could not read remote timestamp; downloading anyway.")

    download_csv()

    now = datetime.now(timezone.utc).isoformat()
    save_last_download({
        "remote_stamp": remote_stamp,
        "downloaded_at": now,
        "source": DATASET_PAGE,
    })
    print(f"Recorded download at {now}")

    print("Parsing...")
    libraries, flags_summary = parse_csv()

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    output = {
        "generated_from": CSV_PATH.name,
        "data_year": DEFAULT_YEAR,
        "last_updated": remote_stamp or "unknown",
        "downloaded_at": now,
        "libraries": libraries,
    }
    OUT_PATH.write_text(
        json.dumps(output, ensure_ascii=False, indent=1),
        encoding="utf-8",
    )

    print(f"Wrote {len(libraries)} libraries to {OUT_PATH}")
    print(f"Flags: {flags_summary}")
    print("Review the JSON, especially libraries with non-empty 'flags'.")


if __name__ == "__main__":
    main()
