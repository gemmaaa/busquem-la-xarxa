<!DOCTYPE html PUBLIC "-//W3C//DTD HTML 4.01//EN" "http://www.w3.org/TR/html4/strict.dtd">
<html>
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
  <meta http-equiv="Content-Style-Type" content="text/css">
  <title></title>
  <meta name="Generator" content="Cocoa HTML Writer">
  <meta name="CocoaVersion" content="2685.7">
  <style type="text/css">
    p.p1 {margin: 0.0px 0.0px 0.0px 0.0px; font: 12.0px Helvetica; -webkit-text-stroke: #000000}
    p.p2 {margin: 0.0px 0.0px 0.0px 0.0px; font: 12.0px Helvetica; -webkit-text-stroke: #000000; min-height: 14.0px}
    span.s1 {font-kerning: none}
  </style>
</head>
<body>
<p class="p1"><span class="s1">import json</span></p>
<p class="p1"><span class="s1">import re</span></p>
<p class="p1"><span class="s1">import sys</span></p>
<p class="p1"><span class="s1">from datetime import datetime, timezone</span></p>
<p class="p1"><span class="s1">from pathlib import Path</span></p>
<p class="p1"><span class="s1">from urllib.request import Request, urlopen</span></p>
<p class="p2"><span class="s1"></span><br></p>
<p class="p1"><span class="s1">ROOT = Path(__file__).resolve().parent.parent</span></p>
<p class="p1"><span class="s1">CSV_PATH = ROOT / "raw" / "export_26092026.csv"</span></p>
<p class="p1"><span class="s1">LAST_DOWNLOAD_PATH = ROOT / "raw" / "last_download.json"</span></p>
<p class="p1"><span class="s1">OUT_PATH = ROOT / "docs" / "data" / "libraries.json"</span></p>
<p class="p2"><span class="s1"></span><br></p>
<p class="p1"><span class="s1"># Source URLs</span></p>
<p class="p1"><span class="s1">DATASET_PAGE = "https://dadesobertes.diba.cat/datasets/biblioteques-municipals"</span></p>
<p class="p1"><span class="s1"># The actual CSV download URL — you'll need to find the resource UUID.</span></p>
<p class="p1"><span class="s1"># On the dataset page, click the CSV resource, and copy the URL.</span></p>
<p class="p1"><span class="s1"># It looks like: https://dadesobertes.diba.cat/dataset/biblioteques-municipals/resource/&lt;uuid&gt;/download/biblioteques_municipals.csv</span></p>
<p class="p1"><span class="s1">CSV_URL = "PASTE_CSV_DOWNLOAD_URL_HERE"</span></p>
<p class="p2"><span class="s1"></span><br></p>
<p class="p2"><span class="s1"></span><br></p>
<p class="p1"><span class="s1">def fetch_last_updated():</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">    </span>"""Scrape the dataset page for the 'Darrera actualització' timestamp."""</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">    </span>try:</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">        </span>req = Request(DATASET_PAGE, headers={"User-Agent": "Mozilla/5.0"})</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">        </span>html = urlopen(req, timeout=30).read().decode("utf-8", errors="replace")</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">    </span>except Exception as e:</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">        </span>print(f"WARNING: could not fetch dataset page: {e}", file=sys.stderr)</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">        </span>return None</span></p>
<p class="p2"><span class="s1"></span><br></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">    </span># Look for "Darrera actualització:" followed by text.</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">    </span># The portal renders something like "fa 18 hores 39 minuts" or a date.</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">    </span># We grab the raw string and store it as-is.</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">    </span>m = re.search(</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">        </span>r"Darrera actualitzaci[oó]\s*:?\s*(.{0,120})",</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">        </span>html, flags=re.I | re.S,</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">    </span>)</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">    </span>if not m:</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">        </span>return None</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">    </span>raw = re.sub(r"&lt;[^&gt;]+&gt;", "", m.group(1)).strip()</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">    </span>raw = re.sub(r"\s+", " ", raw)[:120]</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">    </span>return raw</span></p>
<p class="p2"><span class="s1"></span><br></p>
<p class="p2"><span class="s1"></span><br></p>
<p class="p1"><span class="s1">def load_last_download():</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">    </span>if LAST_DOWNLOAD_PATH.exists():</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">        </span>try:</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">            </span>return json.loads(LAST_DOWNLOAD_PATH.read_text(encoding="utf-8"))</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">        </span>except Exception:</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">            </span>return {}</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">    </span>return {}</span></p>
<p class="p2"><span class="s1"></span><br></p>
<p class="p2"><span class="s1"></span><br></p>
<p class="p1"><span class="s1">def save_last_download(info):</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">    </span>LAST_DOWNLOAD_PATH.write_text(</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">        </span>json.dumps(info, ensure_ascii=False, indent=2),</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">        </span>encoding="utf-8",</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">    </span>)</span></p>
<p class="p2"><span class="s1"></span><br></p>
<p class="p2"><span class="s1"></span><br></p>
<p class="p1"><span class="s1">def download_csv():</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">    </span>if "PASTE_CSV" in CSV_URL:</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">        </span>print("ERROR: set CSV_URL in preprocess.py", file=sys.stderr)</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">        </span>sys.exit(1)</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">    </span>print(f"Downloading {CSV_URL} ...")</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">    </span>req = Request(CSV_URL, headers={"User-Agent": "Mozilla/5.0"})</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">    </span>data = urlopen(req, timeout=60).read()</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">    </span>CSV_PATH.parent.mkdir(parents=True, exist_ok=True)</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">    </span>CSV_PATH.write_bytes(data)</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">    </span>print(f"Saved {len(data)} bytes to {CSV_PATH}")</span></p>
<p class="p2"><span class="s1"></span><br></p>
<p class="p2"><span class="s1"></span><br></p>
<p class="p1"><span class="s1">def main():</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">    </span>force = "--force" in sys.argv</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">    </span>last = load_last_download()</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">    </span>remote_stamp = fetch_last_updated()</span></p>
<p class="p2"><span class="s1"></span><br></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">    </span>if not force and remote_stamp and last.get("remote_stamp") == remote_stamp:</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">        </span>print(f"Data unchanged (remote says: {remote_stamp}). Nothing to do.")</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">        </span>print("Use --force to re-run anyway.")</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">        </span>return</span></p>
<p class="p2"><span class="s1"></span><br></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">    </span>if remote_stamp:</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">        </span>print(f"Remote last-updated: {remote_stamp}")</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">    </span>else:</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">        </span>print("Could not read remote timestamp; downloading anyway.")</span></p>
<p class="p2"><span class="s1"></span><br></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">    </span>download_csv()</span></p>
<p class="p2"><span class="s1"></span><br></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">    </span>now = datetime.now(timezone.utc).isoformat()</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">    </span>save_last_download({</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">        </span>"remote_stamp": remote_stamp,</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">        </span>"downloaded_at": now,</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">        </span>"source": DATASET_PAGE,</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">    </span>})</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">    </span>print(f"Recorded download at {now}")</span></p>
<p class="p2"><span class="s1"></span><br></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">    </span># Now run the existing parsing logic from the earlier script.</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">    </span># (Paste the body of the old main() here, minus the CSV_PATH existence check.)</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">    </span>print("Parsing...")</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">    </span># ... call the parser (the code from the previous message) ...</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">    </span># It writes libraries.json.</span></p>
<p class="p2"><span class="s1"></span><br></p>
<p class="p2"><span class="s1"></span><br></p>
<p class="p1"><span class="s1">if __name__ == "__main__":</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">    </span>main()</span></p>
</body>
</html>
