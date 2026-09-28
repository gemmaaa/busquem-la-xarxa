const state = {
  libraries: [],
  lang: "ca",
  i18n: {},
  map: null,
  markers: [],
  userLatLng: null,
  lastUpdated: "-",
};

const $ = (sel) => document.querySelector(sel);

function t(key, vars) {
  let s = (state.i18n[state.lang] || {})[key] || key;
  if (vars) {
    for (const k of Object.keys(vars)) {
      s = s.replace("{" + k + "}", vars[k]);
    }
  }
  return s;
}

function applyI18n() {
  document.documentElement.lang = state.lang;
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  renderFooter();
}

function renderFooter() {
  const el = document.getElementById("footer-text");
  if (!el) return;
  const link = document.createElement("a");
  link.href = "https://dadesobertes.diba.cat/datasets/biblioteques-municipals";
  link.target = "_blank";
  link.rel = "noopener";
  link.textContent = t("footer_source");

  const template = t("footer", {
    source_link: "__LINK__",
    last_updated: state.lastUpdated ? state.lastUpdated.substring(0, 10) : "-",
  });
  const parts = template.split("__LINK__");
  el.innerHTML = "";
  el.appendChild(document.createTextNode(parts[0] || ""));
  el.appendChild(link);
  el.appendChild(document.createTextNode(parts[1] || ""));
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
}

function initTheme() {
  const saved = localStorage.getItem("theme");
  if (saved) {
    document.getElementById("theme").value = saved;
    applyTheme(saved);
    return;
  }
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const initial = prefersDark ? "dark" : "default";
  document.getElementById("theme").value = initial;
  applyTheme(initial);
}

function hhmmToMinutes(hhmm) {
  const parts = hhmm.split(":");
  return Number(parts[0]) * 60 + Number(parts[1]);
}

function nowMinutes() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function dayNamesEn() {
  return ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
}

function pickSeason(library) {
  return library.seasons.hivern ? "hivern" : "estiu";
}

function evaluateLibrary(library, date, timeFromMin, timeToMin, isTimeFilterActive) {
  const seasonKey = pickSeason(library);
  const s = library.seasons[seasonKey];
  if (!s) return { status: "unknown", season: seasonKey };

  const dayKey = dayNamesEn()[date.getDay()];
  const ranges = s.days[dayKey] || [];

  if (!ranges.length) {
    return { status: "closed", season: seasonKey, ranges: [] };
  }

  if (isTimeFilterActive) {
    const from = timeFromMin != null ? timeFromMin : 0;
    const to = timeToMin != null ? timeToMin : 1440;
    const overlap = ranges.some(
      (r) => from < hhmmToMinutes(r.to) && to > hhmmToMinutes(r.from)
    );
    return { status: overlap ? "open" : "closed", season: seasonKey, ranges: ranges };
  }

  const checkMin = nowMinutes();
  const isOpenNow = ranges.some(
    (r) => checkMin >= hhmmToMinutes(r.from) && checkMin < hhmmToMinutes(r.to)
  );
  return { status: isOpenNow ? "open" : "closed", season: seasonKey, ranges: ranges };
}

function evaluateLibraryOnWeekday(library, weekday, timeFromMin, timeToMin, isTimeFilterActive) {
  const seasonKey = pickSeason(library);
  const s = library.seasons[seasonKey];
  if (!s) return { status: "unknown", season: seasonKey };

  const dayKey = dayNamesEn()[weekday];
  const ranges = s.days[dayKey] || [];

  if (!ranges.length) {
    return { status: "closed", season: seasonKey, ranges: [] };
  }

  if (isTimeFilterActive) {
    const from = timeFromMin != null ? timeFromMin : 0;
    const to = timeToMin != null ? timeToMin : 1440;
    const overlap = ranges.some(
      (r) => from < hhmmToMinutes(r.to) && to > hhmmToMinutes(r.from)
    );
    return { status: overlap ? "open" : "closed", season: seasonKey, ranges: ranges };
  }

  return { status: "open", season: seasonKey, ranges: ranges };
}

function haversineKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function renderResults(results) {
  const container = $("#results");
  container.innerHTML = "";
  if (!results.length) {
    const p = document.createElement("p");
    p.className = "no-results";
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
    
    // Clean up title: remove redundant "Biblioteca" prefixes
    let displayName = library.name
      .replace(/^(biblioteca|biblioteques|biblioteca municipal)\s+/i, "")
      .trim();
    displayName = displayName.charAt(0).toUpperCase() + displayName.slice(1);
    
    node.querySelector(".name").textContent = displayName;

    // Literal street address + municipality + distance
    const locationParts = [];
    if (library.address) {
      locationParts.push(library.address);
    }
    if (library.municipality && (!library.address || !library.address.toLowerCase().includes(library.municipality.toLowerCase()))) {
      locationParts.push(library.municipality);
    }

    const metaLine = [locationParts.join(", ")];
    if (distanceKm != null) {
      metaLine.push(distanceKm.toFixed(1) + " km");
    }

    node.querySelector(".meta").textContent = metaLine.filter(Boolean).join(" • ");

    const statusEl = node.querySelector(".status");
    if (evalResult.status === "open") {
      statusEl.textContent = t("open_now");
      statusEl.className = "status open";
    } else {
      statusEl.textContent = t("closed");
      statusEl.className = "status closed";
    }

    const ranges = evalResult.ranges || [];
    node.querySelector(".hours").textContent = ranges.length
      ? ranges.map((r) => r.from + " - " + r.to).join(", ")
      : t("closed");

    const season = library.seasons[evalResult.season];
    const obsBlock = node.querySelector(".obs");
    if (season && season.observations) {
      node.querySelector(".obs-text").textContent = season.observations;
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
  const tpl = $("#card-template");
  for (const item of results) {
    const library = item.library;
    const evalResult = item.evalResult;
    const distanceKm = item.distanceKm;

    const node = tpl.content.cloneNode(true);
    node.querySelector(".name").textContent = library.name;

    const meta = [library.municipality];
    if (distanceKm != null) meta.push(distanceKm.toFixed(1) + " km");
    node.querySelector(".meta").textContent = meta.filter(Boolean).join(" - ");

    const statusEl = node.querySelector(".status");
    if (evalResult.status === "open") {
      statusEl.textContent = t("open_now");
      statusEl.className = "status open";
    } else {
      statusEl.textContent = t("closed");
      statusEl.className = "status closed";
    }

    const ranges = evalResult.ranges || [];
    node.querySelector(".hours").textContent = ranges.length
      ? ranges.map((r) => r.from + " - " + r.to).join(", ")
      : t("closed");

    const season = library.seasons[evalResult.season];
    const obsBlock = node.querySelector(".obs");
    if (season && season.observations) {
      node.querySelector(".obs-text").textContent = season.observations;
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
  const mapWrap = $("#map-wrap");
  mapWrap.hidden = false;

  if (!state.map) {
    state.map = L.map("map").setView([41.3879, 2.1699], 11);
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
    const color = item.evalResult.status === "open" ? "#0a6" : "#c33";
    const marker = L.circleMarker([library.lat, library.lng], {
      radius: 6,
      color: color,
      fillColor: color,
      fillOpacity: 0.8,
    }).addTo(state.map);
    marker.bindPopup(
      "<strong>" + library.name + "</strong><br>" + library.municipality
    );
    state.markers.push(marker);
  }
  if (state.userLatLng) {
    const um = L.circleMarker(state.userLatLng, {
      radius: 8,
      color: "#06f",
      fillColor: "#06f",
      fillOpacity: 0.9,
    }).addTo(state.map);
    state.markers.push(um);
    state.map.setView(state.userLatLng, 13);
  }
}

function calculateCenterOfMunicipality(muniName) {
  const matches = state.libraries.filter(
    (l) => l.municipality.toLowerCase() === muniName.toLowerCase() && l.lat != null && l.lng != null
  );
  if (!matches.length) return null;
  const avgLat = matches.reduce((acc, l) => acc + l.lat, 0) / matches.length;
  const avgLng = matches.reduce((acc, l) => acc + l.lng, 0) / matches.length;
  return { lat: avgLat, lng: avgLng };
}

function runQuery() {
  const dateVal = $("#date-input").value;
  const dayVal = $("#day-input").value;
  const fromVal = $("#time-from").value;
  const toVal = $("#time-to").value;
  const muni = $("#municipality").value.trim().toLowerCase();
  const radiusKm = parseFloat($("#radius").value) || null;

  const timeFromMin = fromVal ? hhmmToMinutes(fromVal) : null;
  const timeToMin = toVal ? hhmmToMinutes(toVal) : null;
  const isTimeFilterActive = timeFromMin !== null || timeToMin !== null;

  const dateSet = !!dateVal;
  const dayOnly = !dateSet && dayVal !== "";
  const weekdayOverride = dayOnly ? parseInt(dayVal, 10) : null;
  const date = dateSet ? new Date(dateVal + "T00:00:00") : new Date();

  // Reference point for distance sorting
  let refPoint = null;
  if (state.userLatLng) {
    refPoint = { lat: state.userLatLng[0], lng: state.userLatLng[1] };
  } else if (muni) {
    refPoint = calculateCenterOfMunicipality(muni);
  }

  const results = [];
  for (const library of state.libraries) {
    if (muni && !(library.municipality || "").toLowerCase().includes(muni)) continue;

    let distanceKm = null;
    if (refPoint && library.lat != null && library.lng != null) {
      distanceKm = haversineKm(refPoint, { lat: library.lat, lng: library.lng });
      if (radiusKm && state.userLatLng && distanceKm > radiusKm) continue;
    }

    const evalResult = dayOnly
      ? evaluateLibraryOnWeekday(library, weekdayOverride, timeFromMin, timeToMin, isTimeFilterActive)
      : evaluateLibrary(library, date, timeFromMin, timeToMin, isTimeFilterActive);

    if (isTimeFilterActive && evalResult.status !== "open") continue;

    results.push({ library: library, evalResult: evalResult, distanceKm: distanceKm });
  }

  // Sort by distance first (if refPoint exists), then by name
  results.sort((a, b) => {
    if (a.distanceKm != null && b.distanceKm != null) return a.distanceKm - b.distanceKm;
    return a.library.name.localeCompare(b.library.name);
  });

  renderResults(results);

  const main = document.querySelector("main");
  if (main.classList.contains("map-visible")) {
    renderMap(results);
    if (state.map) setTimeout(() => state.map.invalidateSize(), 50);
  } else {
    state.pendingResults = results;
  }

  updateViewToggle(results.length > 0, main.classList.contains("map-visible"));
}

function updateViewToggle(hasResults, showingMap) {
  const toggle = $("#view-toggle");
  const btn = $("#toggle-view");
  if (!hasResults) {
    toggle.hidden = true;
    return;
  }
  toggle.hidden = false;
  btn.textContent = showingMap ? t("view_list") : t("view_map");
}

async function init() {
  try {
    const libData = await fetch("data/libraries.json?v=" + Date.now()).then((r) => r.json());
    state.libraries = libData.libraries || [];
    state.lastUpdated = libData.last_updated || "-";
  } catch (e) {
    console.error("Could not load libraries data", e);
  }

  try {
    const i18n = await fetch("i18n.json").then((r) => r.json());
    state.i18n = i18n;
  } catch (e) {
    console.error("Could not load i18n data", e);
  }

  initTheme();

  const munis = Array.from(
    new Set(state.libraries.map((l) => l.municipality).filter(Boolean))
  ).sort();
  const dl = $("#municipality-list");
  for (const m of munis) {
    const opt = document.createElement("option");
    opt.value = m;
    dl.appendChild(opt);
  }

  applyI18n();

  $("#search").addEventListener("click", runQuery);

  $("#reset").addEventListener("click", () => {
    $("#date-input").value = "";
    $("#day-input").value = "";
    $("#time-from").value = "";
    $("#time-to").value = "";
    $("#municipality").value = "";
    $("#radius").value = "5";
    $("#results").innerHTML = "";
    $("#view-toggle").hidden = true;
    $("#map-wrap").hidden = true;
    const p = document.createElement("p");
    p.className = "no-results";
    p.textContent = t("no_results");
    $("#results").appendChild(p);
  });

  $("#use-location").addEventListener("click", () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      state.userLatLng = [pos.coords.latitude, pos.coords.longitude];
      runQuery();
    });
  });

  $("#toggle-view").addEventListener("click", () => {
    const main = document.querySelector("main");
    main.classList.toggle("map-visible");
    const showingMap = main.classList.contains("map-visible");

    if (showingMap && state.pendingResults) {
      renderMap(state.pendingResults);
      setTimeout(() => state.map.invalidateSize(), 50);
    } else {
      $("#map-wrap").hidden = !showingMap;
    }
    updateViewToggle(true, showingMap);
  });

  $("#lang").addEventListener("change", (e) => {
    state.lang = e.target.value;
    applyI18n();
  });

  $("#theme").addEventListener("change", (e) => {
    applyTheme(e.target.value);
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js");
  }

  runQuery();
}

init();
