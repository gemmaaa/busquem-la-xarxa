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
  let ranges = s.days
