<!DOCTYPE html PUBLIC "-//W3C//DTD HTML 4.01//EN" "http://www.w3.org/TR/html4/strict.dtd">
<html>
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
  <meta http-equiv="Content-Style-Type" content="text/css">
  <title></title>
  <meta name="Generator" content="Cocoa HTML Writer">
  <meta name="CocoaVersion" content="2685.7">
  <style type="text/css">
    p.p1 {margin: 0.0px 0.0px 0.0px 0.0px; font: 12.0px Helvetica}
    p.p2 {margin: 0.0px 0.0px 0.0px 0.0px; font: 12.0px Helvetica; min-height: 14.0px}
  </style>
</head>
<body>
<p class="p1">const state = {</p>
<p class="p1"><span class="Apple-converted-space">  </span>libraries: [],</p>
<p class="p1"><span class="Apple-converted-space">  </span>lang: "ca",</p>
<p class="p1"><span class="Apple-converted-space">  </span>i18n: {},</p>
<p class="p1"><span class="Apple-converted-space">  </span>map: null,</p>
<p class="p1"><span class="Apple-converted-space">  </span>markers: [],</p>
<p class="p1"><span class="Apple-converted-space">  </span>userLatLng: null,</p>
<p class="p1">};</p>
<p class="p2"><br></p>
<p class="p1">const $ = (sel) =&gt; document.querySelector(sel);</p>
<p class="p2"><br></p>
<p class="p1">function t(key, vars = {}) {</p>
<p class="p1"><span class="Apple-converted-space">  </span>let s = (state.i18n[state.lang] || {})[key] || key;</p>
<p class="p1"><span class="Apple-converted-space">  </span>for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v);</p>
<p class="p1"><span class="Apple-converted-space">  </span>return s;</p>
<p class="p1">}</p>
<p class="p2"><br></p>
<p class="p1">function applyI18n() {</p>
<p class="p1"><span class="Apple-converted-space">  </span>document.documentElement.lang = state.lang;</p>
<p class="p1"><span class="Apple-converted-space">  </span>document.querySelectorAll("[data-i18n]").forEach((el) =&gt; {</p>
<p class="p1"><span class="Apple-converted-space">    </span>el.textContent = t(el.dataset.i18n);</p>
<p class="p1"><span class="Apple-converted-space">  </span>});</p>
<p class="p1">}</p>
<p class="p2"><br></p>
<p class="p1">// --- Time helpers ------------------------------------------------------------</p>
<p class="p2"><br></p>
<p class="p1">function hhmmToMinutes(hhmm) {</p>
<p class="p1"><span class="Apple-converted-space">  </span>const [h, m] = hhmm.split(":").map(Number);</p>
<p class="p1"><span class="Apple-converted-space">  </span>return h * 60 + m;</p>
<p class="p1">}</p>
<p class="p2"><br></p>
<p class="p1">function nowMinutes() {</p>
<p class="p1"><span class="Apple-converted-space">  </span>const d = new Date();</p>
<p class="p1"><span class="Apple-converted-space">  </span>return d.getHours() * 60 + d.getMinutes();</p>
<p class="p1">}</p>
<p class="p2"><br></p>
<p class="p1">// --- Season resolution -------------------------------------------------------</p>
<p class="p2"><br></p>
<p class="p1">function monthDayToDate(mmdd, refDate) {</p>
<p class="p1"><span class="Apple-converted-space">  </span>// returns a Date in the same year as refDate, or previous year if needed</p>
<p class="p1"><span class="Apple-converted-space">  </span>const [mm, dd] = mmdd.split("-").map(Number);</p>
<p class="p1"><span class="Apple-converted-space">  </span>const d = new Date(refDate.getFullYear(), mm - 1, dd);</p>
<p class="p1"><span class="Apple-converted-space">  </span>return d;</p>
<p class="p1">}</p>
<p class="p2"><br></p>
<p class="p1">function pickSeason(library, date) {</p>
<p class="p1"><span class="Apple-converted-space">  </span>const seasons = library.seasons;</p>
<p class="p1"><span class="Apple-converted-space">  </span>const candidates = [];</p>
<p class="p1"><span class="Apple-converted-space">  </span>for (const key of ["hivern", "estiu"]) {</p>
<p class="p1"><span class="Apple-converted-space">    </span>const s = seasons[key];</p>
<p class="p1"><span class="Apple-converted-space">    </span>if (!s || !s.start_month_day) continue;</p>
<p class="p1"><span class="Apple-converted-space">    </span>const start = monthDayToDate(s.start_month_day, date);</p>
<p class="p1"><span class="Apple-converted-space">    </span>// If start is after date, it's actually last year's start</p>
<p class="p1"><span class="Apple-converted-space">    </span>const startAdjusted = start &gt; date</p>
<p class="p1"><span class="Apple-converted-space">      </span>? new Date(start.getFullYear() - 1, start.getMonth(), start.getDate())</p>
<p class="p1"><span class="Apple-converted-space">      </span>: start;</p>
<p class="p1"><span class="Apple-converted-space">    </span>candidates.push({ key, start: startAdjusted });</p>
<p class="p1"><span class="Apple-converted-space">  </span>}</p>
<p class="p1"><span class="Apple-converted-space">  </span>if (!candidates.length) return null;</p>
<p class="p1"><span class="Apple-converted-space">  </span>candidates.sort((a, b) =&gt; b.start - a.start);</p>
<p class="p1"><span class="Apple-converted-space">  </span>return candidates[0];</p>
<p class="p1">}</p>
<p class="p2"><br></p>
<p class="p1">function ymd(date) {</p>
<p class="p1"><span class="Apple-converted-space">  </span>const y = date.getFullYear();</p>
<p class="p1"><span class="Apple-converted-space">  </span>const m = String(date.getMonth() + 1).padStart(2, "0");</p>
<p class="p1"><span class="Apple-converted-space">  </span>const d = String(date.getDate()).padStart(2, "0");</p>
<p class="p1"><span class="Apple-converted-space">  </span>return `${y}-${m}-${d}`;</p>
<p class="p1">}</p>
<p class="p2"><br></p>
<p class="p1">function findClosure(season, date) {</p>
<p class="p1"><span class="Apple-converted-space">  </span>const key = ymd(date);</p>
<p class="p1"><span class="Apple-converted-space">  </span>for (const c of season.closures || []) {</p>
<p class="p1"><span class="Apple-converted-space">    </span>if (c.date === key) return c;</p>
<p class="p1"><span class="Apple-converted-space">    </span>if (c.from &amp;&amp; c.to &amp;&amp; key &gt;= c.from &amp;&amp; key &lt;= c.to) return c;</p>
<p class="p1"><span class="Apple-converted-space">  </span>}</p>
<p class="p1"><span class="Apple-converted-space">  </span>return null;</p>
<p class="p1">}</p>
<p class="p2"><br></p>
<p class="p1">function dayNameEn(date) {</p>
<p class="p1"><span class="Apple-converted-space">  </span>return ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][date.getDay()];</p>
<p class="p1">}</p>
<p class="p2"><br></p>
<p class="p1">// --- Core query --------------------------------------------------------------</p>
<p class="p2"><br></p>
<p class="p1">function evaluateLibrary(library, date, timeFromMin, timeToMin) {</p>
<p class="p1"><span class="Apple-converted-space">  </span>const season = pickSeason(library, date);</p>
<p class="p1"><span class="Apple-converted-space">  </span>if (!season) return { status: "unknown" };</p>
<p class="p2"><br></p>
<p class="p1"><span class="Apple-converted-space">  </span>const s = library.seasons[season.key];</p>
<p class="p1"><span class="Apple-converted-space">  </span>if (s.status === "closed_all_week") {</p>
<p class="p1"><span class="Apple-converted-space">    </span>return { status: "closed", season: season.key, reason: "season_closed" };</p>
<p class="p1"><span class="Apple-converted-space">  </span>}</p>
<p class="p2"><br></p>
<p class="p1"><span class="Apple-converted-space">  </span>const closure = findClosure(s, date);</p>
<p class="p1"><span class="Apple-converted-space">  </span>const dayKey = dayNameEn(date);</p>
<p class="p1"><span class="Apple-converted-space">  </span>let ranges = s.days[dayKey] || [];</p>
<p class="p2"><br></p>
<p class="p1"><span class="Apple-converted-space">  </span>if (closure) {</p>
<p class="p1"><span class="Apple-converted-space">    </span>if (closure.type === "closed") {</p>
<p class="p1"><span class="Apple-converted-space">      </span>return { status: "closed", season: season.key, reason: "closure", closure };</p>
<p class="p1"><span class="Apple-converted-space">    </span>}</p>
<p class="p1"><span class="Apple-converted-space">    </span>if (closure.type === "reduced") {</p>
<p class="p1"><span class="Apple-converted-space">      </span>// We didn't parse reduced hours reliably — treat as unknown/closed</p>
<p class="p1"><span class="Apple-converted-space">      </span>if (!ranges.length) {</p>
<p class="p1"><span class="Apple-converted-space">        </span>return { status: "closed", season: season.key, reason: "reduced_unparsed", closure };</p>
<p class="p1"><span class="Apple-converted-space">      </span>}</p>
<p class="p1"><span class="Apple-converted-space">      </span>// Fall through: use regular ranges but warn</p>
<p class="p1"><span class="Apple-converted-space">      </span>return {</p>
<p class="p1"><span class="Apple-converted-space">        </span>status: "reduced", season: season.key, ranges, closure,</p>
<p class="p1"><span class="Apple-converted-space">      </span>};</p>
<p class="p1"><span class="Apple-converted-space">    </span>}</p>
<p class="p1"><span class="Apple-converted-space">    </span>if (closure.type === "open_override") {</p>
<p class="p1"><span class="Apple-converted-space">      </span>// Whitelisted open Saturday — we don't have times, use regular Saturday ranges if any</p>
<p class="p1"><span class="Apple-converted-space">      </span>if (!ranges.length) {</p>
<p class="p1"><span class="Apple-converted-space">        </span>// can't know exact hours; report as "possibly open"</p>
<p class="p1"><span class="Apple-converted-space">        </span>return { status: "open_override", season: season.key, closure };</p>
<p class="p1"><span class="Apple-converted-space">      </span>}</p>
<p class="p1"><span class="Apple-converted-space">    </span>}</p>
<p class="p1"><span class="Apple-converted-space">  </span>}</p>
<p class="p2"><br></p>
<p class="p1"><span class="Apple-converted-space">  </span>if (!ranges.length) {</p>
<p class="p1"><span class="Apple-converted-space">    </span>return { status: "closed", season: season.key };</p>
<p class="p1"><span class="Apple-converted-space">  </span>}</p>
<p class="p2"><br></p>
<p class="p1"><span class="Apple-converted-space">  </span>// Does the requested window overlap any open range?</p>
<p class="p1"><span class="Apple-converted-space">  </span>if (timeFromMin != null &amp;&amp; timeToMin != null) {</p>
<p class="p1"><span class="Apple-converted-space">    </span>const overlap = ranges.some(</p>
<p class="p1"><span class="Apple-converted-space">      </span>(r) =&gt; timeFromMin &lt; hhmmToMinutes(r.to) &amp;&amp; timeToMin &gt; hhmmToMinutes(r.from)</p>
<p class="p1"><span class="Apple-converted-space">    </span>);</p>
<p class="p1"><span class="Apple-converted-space">    </span>return { status: overlap ? "open" : "closed", season: season.key, ranges };</p>
<p class="p1"><span class="Apple-converted-space">  </span>}</p>
<p class="p2"><br></p>
<p class="p1"><span class="Apple-converted-space">  </span>// Otherwise check whether we're open at now (or at requested single time)</p>
<p class="p1"><span class="Apple-converted-space">  </span>const checkMin = timeFromMin != null ? timeFromMin : nowMinutes();</p>
<p class="p1"><span class="Apple-converted-space">  </span>const isOpen = ranges.some(</p>
<p class="p1"><span class="Apple-converted-space">    </span>(r) =&gt; checkMin &gt;= hhmmToMinutes(r.from) &amp;&amp; checkMin &lt; hhmmToMinutes(r.to)</p>
<p class="p1"><span class="Apple-converted-space">  </span>);</p>
<p class="p1"><span class="Apple-converted-space">  </span>return { status: isOpen ? "open" : "closed", season: season.key, ranges };</p>
<p class="p1">}</p>
<p class="p2"><br></p>
<p class="p1">// --- Distance ----------------------------------------------------------------</p>
<p class="p2"><br></p>
<p class="p1">function haversineKm(a, b) {</p>
<p class="p1"><span class="Apple-converted-space">  </span>const R = 6371;</p>
<p class="p1"><span class="Apple-converted-space">  </span>const dLat = (b.lat - a.lat) * Math.PI / 180;</p>
<p class="p1"><span class="Apple-converted-space">  </span>const dLng = (b.lng - a.lng) * Math.PI / 180;</p>
<p class="p1"><span class="Apple-converted-space">  </span>const la1 = a.lat * Math.PI / 180;</p>
<p class="p1"><span class="Apple-converted-space">  </span>const la2 = b.lat * Math.PI / 180;</p>
<p class="p1"><span class="Apple-converted-space">  </span>const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;</p>
<p class="p1"><span class="Apple-converted-space">  </span>return 2 * R * Math.asin(Math.sqrt(h));</p>
<p class="p1">}</p>
<p class="p2"><br></p>
<p class="p1">// --- Rendering ---------------------------------------------------------------</p>
<p class="p2"><br></p>
<p class="p1">function renderResults(results) {</p>
<p class="p1"><span class="Apple-converted-space">  </span>const container = $("#results");</p>
<p class="p1"><span class="Apple-converted-space">  </span>container.innerHTML = "";</p>
<p class="p1"><span class="Apple-converted-space">  </span>if (!results.length) {</p>
<p class="p1"><span class="Apple-converted-space">    </span>const p = document.createElement("p");</p>
<p class="p1"><span class="Apple-converted-space">    </span>p.textContent = t("no_results");</p>
<p class="p1"><span class="Apple-converted-space">    </span>container.appendChild(p);</p>
<p class="p1"><span class="Apple-converted-space">    </span>return;</p>
<p class="p1"><span class="Apple-converted-space">  </span>}</p>
<p class="p1"><span class="Apple-converted-space">  </span>const tpl = $("#card-template");</p>
<p class="p1"><span class="Apple-converted-space">  </span>for (const { library, evalResult, distanceKm } of results) {</p>
<p class="p1"><span class="Apple-converted-space">    </span>const node = tpl.content.cloneNode(true);</p>
<p class="p1"><span class="Apple-converted-space">    </span>node.querySelector(".name").textContent = library.name;</p>
<p class="p1"><span class="Apple-converted-space">    </span>const meta = [library.municipality];</p>
<p class="p1"><span class="Apple-converted-space">    </span>if (distanceKm != null) meta.push(`${distanceKm.toFixed(1)} km`);</p>
<p class="p1"><span class="Apple-converted-space">    </span>node.querySelector(".meta").textContent = meta.join(" · ");</p>
<p class="p2"><br></p>
<p class="p1"><span class="Apple-converted-space">    </span>const statusEl = node.querySelector(".status");</p>
<p class="p1"><span class="Apple-converted-space">    </span>if (evalResult.status === "open") {</p>
<p class="p1"><span class="Apple-converted-space">      </span>statusEl.textContent = t("open_now");</p>
<p class="p1"><span class="Apple-converted-space">      </span>statusEl.classList.add("open");</p>
<p class="p1"><span class="Apple-converted-space">    </span>} else if (evalResult.status === "closed") {</p>
<p class="p1"><span class="Apple-converted-space">      </span>statusEl.textContent = evalResult.reason === "closure" ? t("closed_holiday") : t("closed");</p>
<p class="p1"><span class="Apple-converted-space">      </span>statusEl.classList.add("closed");</p>
<p class="p1"><span class="Apple-converted-space">    </span>} else if (evalResult.status === "reduced") {</p>
<p class="p1"><span class="Apple-converted-space">      </span>statusEl.textContent = t("reduced_hours");</p>
<p class="p1"><span class="Apple-converted-space">    </span>} else if (evalResult.status === "open_override") {</p>
<p class="p1"><span class="Apple-converted-space">      </span>statusEl.textContent = "★ " + (evalResult.closure?.note || "Obertura especial");</p>
<p class="p1"><span class="Apple-converted-space">    </span>}</p>
<p class="p2"><br></p>
<p class="p1"><span class="Apple-converted-space">    </span>const ranges = evalResult.ranges || [];</p>
<p class="p1"><span class="Apple-converted-space">    </span>node.querySelector(".hours").textContent = ranges.length</p>
<p class="p1"><span class="Apple-converted-space">      </span>? ranges.map((r) =&gt; `${r.from}–${r.to}`).join(", ")</p>
<p class="p1"><span class="Apple-converted-space">      </span>: "";</p>
<p class="p2"><br></p>
<p class="p1"><span class="Apple-converted-space">    </span>const season = library.seasons[evalResult.season];</p>
<p class="p1"><span class="Apple-converted-space">    </span>if (season &amp;&amp; season.observations) {</p>
<p class="p1"><span class="Apple-converted-space">      </span>node.querySelector(".obs-text").textContent = season.observations;</p>
<p class="p1"><span class="Apple-converted-space">      </span>if (evalResult.closure) {</p>
<p class="p1"><span class="Apple-converted-space">        </span>node.querySelector(".obs-text").textContent =</p>
<p class="p1"><span class="Apple-converted-space">          </span>`→ ${evalResult.closure.note}\n\n` + season.observations;</p>
<p class="p1"><span class="Apple-converted-space">      </span>}</p>
<p class="p1"><span class="Apple-converted-space">    </span>} else {</p>
<p class="p1"><span class="Apple-converted-space">      </span>node.querySelector(".obs").remove();</p>
<p class="p1"><span class="Apple-converted-space">    </span>}</p>
<p class="p2"><br></p>
<p class="p1"><span class="Apple-converted-space">    </span>const links = node.querySelector(".links");</p>
<p class="p1"><span class="Apple-converted-space">    </span>if (library.web) {</p>
<p class="p1"><span class="Apple-converted-space">      </span>const a = document.createElement("a");</p>
<p class="p1"><span class="Apple-converted-space">      </span>a.href = library.web;</p>
<p class="p1"><span class="Apple-converted-space">      </span>a.target = "_blank";</p>
<p class="p1"><span class="Apple-converted-space">      </span>a.rel = "noopener";</p>
<p class="p1"><span class="Apple-converted-space">      </span>a.textContent = t("library_page");</p>
<p class="p1"><span class="Apple-converted-space">      </span>links.appendChild(a);</p>
<p class="p1"><span class="Apple-converted-space">    </span>}</p>
<p class="p1"><span class="Apple-converted-space">    </span>if (library.phone) {</p>
<p class="p1"><span class="Apple-converted-space">      </span>const a = document.createElement("a");</p>
<p class="p1"><span class="Apple-converted-space">      </span>a.href = `tel:${library.phone.replace(/\s/g, "")}`;</p>
<p class="p1"><span class="Apple-converted-space">      </span>a.textContent = `${t("phone")}: ${library.phone}`;</p>
<p class="p1"><span class="Apple-converted-space">      </span>links.appendChild(a);</p>
<p class="p1"><span class="Apple-converted-space">    </span>}</p>
<p class="p2"><br></p>
<p class="p1"><span class="Apple-converted-space">    </span>container.appendChild(node);</p>
<p class="p1"><span class="Apple-converted-space">  </span>}</p>
<p class="p1">}</p>
<p class="p2"><br></p>
<p class="p1">function renderMap(results) {</p>
<p class="p1"><span class="Apple-converted-space">  </span>if (!state.map) {</p>
<p class="p1"><span class="Apple-converted-space">    </span>state.map = L.map("map").setView([41.5, 2.1], 9);</p>
<p class="p1"><span class="Apple-converted-space">    </span>L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {</p>
<p class="p1"><span class="Apple-converted-space">      </span>attribution: "© OpenStreetMap",</p>
<p class="p1"><span class="Apple-converted-space">      </span>maxZoom: 19,</p>
<p class="p1"><span class="Apple-converted-space">    </span>}).addTo(state.map);</p>
<p class="p1"><span class="Apple-converted-space">  </span>}</p>
<p class="p1"><span class="Apple-converted-space">  </span>for (const m of state.markers) m.remove();</p>
<p class="p1"><span class="Apple-converted-space">  </span>state.markers = [];</p>
<p class="p2"><br></p>
<p class="p1"><span class="Apple-converted-space">  </span>for (const { library, evalResult } of results) {</p>
<p class="p1"><span class="Apple-converted-space">    </span>if (library.lat == null || library.lng == null) continue;</p>
<p class="p1"><span class="Apple-converted-space">    </span>const color = evalResult.status === "open" ? "#0a6" : "#999";</p>
<p class="p1"><span class="Apple-converted-space">    </span>const marker = L.circleMarker([library.lat, library.lng], {</p>
<p class="p1"><span class="Apple-converted-space">      </span>radius: 6, color, fillColor: color, fillOpacity: 0.8,</p>
<p class="p1"><span class="Apple-converted-space">    </span>}).addTo(state.map);</p>
<p class="p1"><span class="Apple-converted-space">    </span>marker.bindPopup(`&lt;strong&gt;${library.name}&lt;/strong&gt;&lt;br&gt;${library.municipality}`);</p>
<p class="p1"><span class="Apple-converted-space">    </span>state.markers.push(marker);</p>
<p class="p1"><span class="Apple-converted-space">  </span>}</p>
<p class="p1"><span class="Apple-converted-space">  </span>if (state.userLatLng) {</p>
<p class="p1"><span class="Apple-converted-space">    </span>const um = L.circleMarker(state.userLatLng, {</p>
<p class="p1"><span class="Apple-converted-space">      </span>radius: 7, color: "#06f", fillColor: "#06f", fillOpacity: 0.9,</p>
<p class="p1"><span class="Apple-converted-space">    </span>}).addTo(state.map);</p>
<p class="p1"><span class="Apple-converted-space">    </span>state.markers.push(um);</p>
<p class="p1"><span class="Apple-converted-space">  </span>}</p>
<p class="p1">}</p>
<p class="p2"><br></p>
<p class="p1">// --- Main filter loop --------------------------------------------------------</p>
<p class="p2"><br></p>
<p class="p1">function runQuery() {</p>
<p class="p1"><span class="Apple-converted-space">  </span>const dateVal = $("#date-input").value;</p>
<p class="p1"><span class="Apple-converted-space">  </span>const date = dateVal ? new Date(dateVal + "T00:00:00") : new Date();</p>
<p class="p1"><span class="Apple-converted-space">  </span>const fromVal = $("#time-from").value;</p>
<p class="p1"><span class="Apple-converted-space">  </span>const toVal = $("#time-to").value;</p>
<p class="p1"><span class="Apple-converted-space">  </span>const muni = $("#municipality").value.trim().toLowerCase();</p>
<p class="p1"><span class="Apple-converted-space">  </span>const radiusKm = parseFloat($("#radius").value) || null;</p>
<p class="p2"><br></p>
<p class="p1"><span class="Apple-converted-space">  </span>const timeFromMin = fromVal ? hhmmToMinutes(fromVal) : null;</p>
<p class="p1"><span class="Apple-converted-space">  </span>const timeToMin = toVal ? hhmmToMinutes(toVal) : null;</p>
<p class="p2"><br></p>
<p class="p1"><span class="Apple-converted-space">  </span>const results = [];</p>
<p class="p1"><span class="Apple-converted-space">  </span>for (const library of state.libraries) {</p>
<p class="p1"><span class="Apple-converted-space">    </span>if (muni &amp;&amp; !(library.municipality || "").toLowerCase().includes(muni)) continue;</p>
<p class="p2"><br></p>
<p class="p1"><span class="Apple-converted-space">    </span>let distanceKm = null;</p>
<p class="p1"><span class="Apple-converted-space">    </span>if (state.userLatLng &amp;&amp; library.lat != null &amp;&amp; library.lng != null) {</p>
<p class="p1"><span class="Apple-converted-space">      </span>distanceKm = haversineKm(</p>
<p class="p1"><span class="Apple-converted-space">        </span>{ lat: state.userLatLng[0], lng: state.userLatLng[1] },</p>
<p class="p1"><span class="Apple-converted-space">        </span>{ lat: library.lat, lng: library.lng }</p>
<p class="p1"><span class="Apple-converted-space">      </span>);</p>
<p class="p1"><span class="Apple-converted-space">      </span>if (radiusKm &amp;&amp; distanceKm &gt; radiusKm) continue;</p>
<p class="p1"><span class="Apple-converted-space">    </span>}</p>
<p class="p2"><br></p>
<p class="p1"><span class="Apple-converted-space">    </span>const evalResult = evaluateLibrary(library, date, timeFromMin, timeToMin);</p>
<p class="p1"><span class="Apple-converted-space">    </span>if (!["open", "reduced", "open_override"].includes(evalResult.status)) continue;</p>
<p class="p2"><br></p>
<p class="p1"><span class="Apple-converted-space">    </span>results.push({ library, evalResult, distanceKm });</p>
<p class="p1"><span class="Apple-converted-space">  </span>}</p>
<p class="p2"><br></p>
<p class="p1"><span class="Apple-converted-space">  </span>results.sort((a, b) =&gt; {</p>
<p class="p1"><span class="Apple-converted-space">    </span>if (a.distanceKm != null &amp;&amp; b.distanceKm != null) return a.distanceKm - b.distanceKm;</p>
<p class="p1"><span class="Apple-converted-space">    </span>return a.library.name.localeCompare(b.library.name);</p>
<p class="p1"><span class="Apple-converted-space">  </span>});</p>
<p class="p2"><br></p>
<p class="p1"><span class="Apple-converted-space">  </span>renderResults(results);</p>
<p class="p1"><span class="Apple-converted-space">  </span>renderMap(results);</p>
<p class="p1">}</p>
<p class="p2"><br></p>
<p class="p1">// --- Init --------------------------------------------------------------------</p>
<p class="p2"><br></p>
<p class="p1">async function init() {</p>
<p class="p1"><span class="Apple-converted-space">  </span>const [libData, i18n] = await Promise.all([</p>
<p class="p1"><span class="Apple-converted-space">    </span>fetch("data/libraries.json").then((r) =&gt; r.json()),</p>
<p class="p1"><span class="Apple-converted-space">    </span>fetch("i18n.json").then((r) =&gt; r.json()),</p>
<p class="p1"><span class="Apple-converted-space">  </span>]);</p>
<p class="p1"><span class="Apple-converted-space">  </span>state.libraries = libData.libraries;</p>
<p class="p1"><span class="Apple-converted-space">  </span>state.i18n = i18n;</p>
<p class="p2"><br></p>
<p class="p1"><span class="Apple-converted-space">  </span>// Populate municipality datalist</p>
<p class="p1"><span class="Apple-converted-space">  </span>const munis = [...new Set(state.libraries.map((l) =&gt; l.municipality).filter(Boolean))].sort();</p>
<p class="p1"><span class="Apple-converted-space">  </span>const dl = $("#municipality-list");</p>
<p class="p1"><span class="Apple-converted-space">  </span>for (const m of munis) {</p>
<p class="p1"><span class="Apple-converted-space">    </span>const opt = document.createElement("option");</p>
<p class="p1"><span class="Apple-converted-space">    </span>opt.value = m;</p>
<p class="p1"><span class="Apple-converted-space">    </span>dl.appendChild(opt);</p>
<p class="p1"><span class="Apple-converted-space">  </span>}</p>
<p class="p2"><br></p>
<p class="p1"><span class="Apple-converted-space">  </span>// Defaults: today, now</p>
<p class="p1"><span class="Apple-converted-space">  </span>const today = new Date();</p>
<p class="p1"><span class="Apple-converted-space">  </span>$("#date-input").value = ymd(today);</p>
<p class="p1"><span class="Apple-converted-space">  </span>$("#time-from").value = "";</p>
<p class="p1"><span class="Apple-converted-space">  </span>$("#time-to").value = "";</p>
<p class="p2"><br></p>
<p class="p1"><span class="Apple-converted-space">  </span>applyI18n();</p>
<p class="p1"><span class="Apple-converted-space">  </span>runQuery();</p>
<p class="p2"><br></p>
<p class="p1"><span class="Apple-converted-space">  </span>document.querySelectorAll("input, select").forEach((el) =&gt; {</p>
<p class="p1"><span class="Apple-converted-space">    </span>el.addEventListener("change", runQuery);</p>
<p class="p1"><span class="Apple-converted-space">    </span>el.addEventListener("input", runQuery);</p>
<p class="p1"><span class="Apple-converted-space">  </span>});</p>
<p class="p1"><span class="Apple-converted-space">  </span>$("#use-location").addEventListener("click", () =&gt; {</p>
<p class="p1"><span class="Apple-converted-space">    </span>if (!navigator.geolocation) return;</p>
<p class="p1"><span class="Apple-converted-space">    </span>navigator.geolocation.getCurrentPosition((pos) =&gt; {</p>
<p class="p1"><span class="Apple-converted-space">      </span>state.userLatLng = [pos.coords.latitude, pos.coords.longitude];</p>
<p class="p1"><span class="Apple-converted-space">      </span>runQuery();</p>
<p class="p1"><span class="Apple-converted-space">    </span>});</p>
<p class="p1"><span class="Apple-converted-space">  </span>});</p>
<p class="p1"><span class="Apple-converted-space">  </span>$("#lang").addEventListener("change", (e) =&gt; {</p>
<p class="p1"><span class="Apple-converted-space">    </span>state.lang = e.target.value;</p>
<p class="p1"><span class="Apple-converted-space">    </span>applyI18n();</p>
<p class="p1"><span class="Apple-converted-space">    </span>runQuery();</p>
<p class="p1"><span class="Apple-converted-space">  </span>});</p>
<p class="p2"><br></p>
<p class="p1"><span class="Apple-converted-space">  </span>if ("serviceWorker" in navigator) {</p>
<p class="p1"><span class="Apple-converted-space">    </span>navigator.serviceWorker.register("sw.js");</p>
<p class="p1"><span class="Apple-converted-space">  </span>}</p>
<p class="p1">}</p>
<p class="p2"><br></p>
<p class="p1">init();</p>
</body>
</html>
