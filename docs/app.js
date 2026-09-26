const state = {
  libraries: [],
  lang: "ca",
  i18n: {},
  map: null,
  markers: [],
  userLatLng: null,
};

const $ = (sel) => document.querySelector(sel);

function t(key, vars = {}) {
  let s = (state.i18n[state.lang] || {})[key] || key;
  for (const [k, v] of Object.entries(vars)) s = s.replace("{" + k + "}", v);
  return s;
}

function applyI18n() {
  document.documentElement.lang = state.lang;
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
}

function hhmmToMinutes(hhmm) {
  const parts = hhmm.split(":");
  return Number(parts[0]) * 60 + Number(parts[1]);
}

function nowMinutes() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function ymd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + d;
}

function monthDayToDate(mmdd, refDate) {
  const parts = mmdd.split("-");
  const mm = Number(parts[0]);
  const dd = Number(parts[1]);
  return new Date(refDate.getFullYear(), mm - 1, dd);
}

function pickSeason(library, date) {
  const seasons = library.seasons;
  const candidates = [];
  for (const key of ["hivern", "estiu"]) {
    const s = seasons[key];
    if (!s || !s.start_month_day) continue;
    const start = monthDayToDate(s.start_month_day, date);
    const startAdjusted = start > date
      ? new Date(start.getFullYear() - 1, start.getMonth(), start.getDate())
      : start;
    candidates.push({ key: key, start: startAdjusted });
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => b.start - a.start);
  return candidates[0];
}

function findClosure(season, date) {
  const key = ymd(date);
  const closures = season.closures || [];
  for (const c of closures) {
    if (c.date === key) return c;
    if (c.from && c.to && key >= c.from && key <= c.to) return c;
  }
  return null;
}

function dayNameEn(date) {
  const names = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  return names[date.getDay()];
}

function evaluateLibrary(library, date, timeFromMin, timeToMin) {
  const season = pickSeason(library, date);
  if (!season) return { status: "unknown" };

  const s = library.seasons[season.key];
  if (s.status === "closed_all_week") {
    return { status: "closed", season: season.key, reason: "season_closed" };
  }

  const closure = findClosure(s, date);
  const dayKey = dayNameEn(date);
  let ranges = s.days[dayKey] || [];

  if (closure) {
    if (closure.type === "closed") {
      return { status: "closed", season: season.key, reason: "closure", closure: closure };
    }
    if (closure.type === "reduced") {
      if (!ranges.length) {
        return { status: "closed", season: season.key, reason: "reduced_unparsed", closure: closure };
      }
      return { status: "reduced", season: season.key, ranges: ranges, closure: closure };
    }
    if (closure.type === "open_override") {
      if (!ranges.length) {
        return { status: "open_override", season: season.key, closure: closure };
      }
    }
  }

  if (!ranges.length) {
    return { status: "closed", season: season.key };
  }

  if (timeFromMin != null && timeToMin != null) {
    const overlap = ranges.some(
      (r) => timeFromMin < hhmmToMinutes(r.to) && timeToMin > hhmmToMinutes(r.from)
    );
    return { status: overlap ? "open" : "closed", season: season.key, ranges: ranges };
  }

  const checkMin = timeFromMin != null ? timeFromMin : nowMinutes();
  const isOpen = ranges.some(
    (r) => checkMin >= hhmmToMinutes(r.from) && checkMin < hhmmToMinutes(r.to)
  );
  return { status: isOpen ? "open" : "closed", season: season.key, ranges: ranges };
}

function haversineKm(a, b) {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const la1 = a.lat * Math.PI / 180;
  const la2 = b.lat * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function renderResults(results) {
  const container = $("#results");
  container.innerHTML = "";
  if (!results.length) {
    const p = document.createElement("p");
    p.textContent = t("no_results");
    container.appendChild(p);
    return;
  }
  const tpl = $("#card-template");
  for (const item of results) {
    const library = item.library;
    const evalResult = item.evalResult;
    const distanceKm = item.distanceKm;

    const node = tpl.content.cloneNode(true);
    node.querySelector(".name").textContent = library.name;

    const meta = [library.municipality];
    if (distanceKm != null) meta.push(distanceKm.toFixed(1) + " km");
    node.querySelector(".meta").textContent = meta.join(" - ");

    const statusEl = node.querySelector(".status");
    if (evalResult.status === "open") {
      statusEl.textContent = t("open_now");
      statusEl.classList.add("open");
    } else if (evalResult.status === "closed") {
      statusEl.textContent = evalResult.reason === "closure" ? t("closed_holiday") : t("closed");
      statusEl.classList.add("closed");
    } else if (evalResult.status === "reduced") {
      statusEl.textContent = t("reduced_hours");
      statusEl.classList.add("reduced");
    } else if (evalResult.status === "open_override") {
      statusEl.textContent = t("special_open");
      statusEl.classList.add("override");
    }

    const ranges = evalResult.ranges || [];
    node.querySelector(".hours").textContent = ranges.length
      ? ranges.map((r) => r.from + " - " + r.to).join(", ")
      : "";

    const season = library.seasons[evalResult.season];
    const obsBlock = node.querySelector(".obs");
    if (season && season.observations) {
      let text = season.observations;
      if (evalResult.closure && evalResult.closure.note) {
        text = "\u2192 " + evalResult.closure.note + "\n\n" + text;
      }
      node.querySelector(".obs-text").textContent = text;
    } else {
      obsBlock.remove();
    }

    const links = node.querySelector(".links");
    if (library.web) {
      const a = document.createElement("a");
      a.href = library.web;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = t("library_page");
      links.appendChild(a);
    }
    if (library.phone) {
      const a = document.createElement("a");
      a.href = "tel:" + library.phone.replace(/\s/g, "");
      a.textContent = t("phone") + ": " + library.phone;
      links.appendChild(a);
    }

    container.appendChild(node);
  }
}

function renderMap(results) {
  if (!state.map) {
    state.map = L.map("map").setView([41.5, 2.1], 9);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "(c) OpenStreetMap",
      maxZoom: 19,
    }).addTo(state.map);
  }
  for (const m of state.markers) m.remove();
  state.markers = [];

  for (const item of results) {
    const library = item.library;
    if (library.lat == null || library.lng == null) continue;
    const color = item.evalResult.status === "open" ? "#0a6" : "#999";
    const marker = L.circleMarker([library.lat, library.lng], {
      radius: 6, color: color, fillColor: color, fillOpacity: 0.8,
    }).addTo(state.map);
    marker.bindPopup("<strong>" + library.name + "</strong><br>" + library.municipality);
    state.markers.push(marker);
  }
  if (state.userLatLng) {
    const um = L.circleMarker(state.userLatLng, {
      radius: 7, color: "#06f", fillColor: "#06f", fillOpacity: 0.9,
    }).addTo(state.map);
    state.markers.push(um);
  }
}

function runQuery() {
  const dateVal = $("#date-input").value;
  const date = dateVal ? new Date(dateVal + "T00:00:00") : new Date();
  const fromVal = $("#time-from").value;
  const toVal = $("#time-to").value;
  const muni = $("#municipality").value.trim().toLowerCase();
  const radiusKm = parseFloat($("#radius").value) || null;

  const timeFromMin = fromVal ? hhmmToMinutes(fromVal) : null;
  const timeToMin = toVal ? hhmmToMinutes(toVal) : null;

  const results = [];
  for (const library of state.libraries) {
    if (muni && !(library.municipality || "").toLowerCase().includes(muni)) continue;

    let distanceKm = null;
    if (state.userLatLng && library.lat != null && library.lng != null) {
      distanceKm = haversineKm(
        { lat: state.userLatLng[0], lng: state.userLatLng[1] },
        { lat: library.lat, lng: library.lng }
      );
      if (radiusKm && distanceKm > radiusKm) continue;
    }

    const evalResult = evaluateLibrary(library, date, timeFromMin, timeToMin);
    if (["open", "reduced", "open_override"].indexOf(evalResult.status) === -1) continue;

    results.push({ library: library, evalResult: evalResult, distanceKm: distanceKm });
  }

  results.sort((a, b) => {
    if (a.distanceKm != null && b.distanceKm != null) return a.distanceKm - b.distanceKm;
    return a.library.name.localeCompare(b.library.name);
  });

  renderResults(results);
  renderMap(results);
}

async function init() {
  const libData = await fetch("data/libraries.json").then((r) => r.json());
  const i18n = await fetch("i18n.json").then((r) => r.json());
  state.libraries = libData.libraries;
  state.i18n = i18n;

  const munis = Array.from(
    new Set(state.libraries.map((l) => l.municipality).filter(Boolean))
  ).sort();
  const dl = $("#municipality-list");
  for (const m of munis) {
    const opt = document.createElement("option");
    opt.value = m;
    dl.appendChild(opt);
  }

  const today = new Date();
  $("#date-input").value = ymd(today);

  const updatedEl = document.getElementById("data-updated");
  if (updatedEl) updatedEl.textContent = libData.last_updated || "-";

  applyI18n();
  runQuery();

  document.querySelectorAll("input, select").forEach((el) => {
    el.addEventListener("change", runQuery);
    el.addEventListener("input", runQuery);
  });

  $("#use-location").addEventListener("click", () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      state.userLatLng = [pos.coords.latitude, pos.coords.longitude];
      runQuery();
    });
  });

  $("#lang").addEventListener("change", (e) => {
    state.lang = e.target.value;
    applyI18n();
    runQuery();
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js");
  }
}

init();
