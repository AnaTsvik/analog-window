const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const FACTORS = {
  dryness:    "Dryness",
  cold:       "Cold (average)",
  cold_min:   "Extreme cold (night)",
  thin_air:   "Thin air",
  uv:         "UV radiation",
  temp_swing: "Day–night swing",
  clear_sky:  "Clear skies",
  wind_dust:  "Wind & dust",
  low_light:  "Low sunlight"
};

const TARGETS = {
  mars: {
    label: "Mars",
    title: "Places on Earth most like <span>Mars</span>",
    note: "Mars: about 0.64 kPa air pressure (less than 1% of Earth's), no rain, about −59 °C on average (NASA Mars Fact Sheet).",
    presets: {
      "Balanced":               { dryness: 3, cold: 2, thin_air: 1.5, uv: 1, temp_swing: 1, clear_sky: 1, wind_dust: 0.5 },
      "Mobility & robotics":    { dryness: 3, temp_swing: 2, wind_dust: 2, cold: 1, thin_air: 1, clear_sky: 1 },
      "Construction & habitat": { cold: 3, temp_swing: 3, wind_dust: 2, thin_air: 2, dryness: 1 },
      "Resources (ice)":        { cold_min: 3, cold: 2, dryness: 1, thin_air: 1 },
      "Life detection":         { dryness: 4, uv: 3, thin_air: 1, cold: 1 },
      "Human operations":       { thin_air: 3, cold: 2, uv: 2, temp_swing: 1, dryness: 1 }
    }
  },
  moon: {
    label: "Moon · South pole (Artemis)",
    title: "Places on Earth most like the <span>Moon's south pole</span>",
    note: "Moon's south pole: no atmosphere, a low sun, and shadowed crater floors down to about −250 °C (LRO Diviner).",
    presets: {
      "Balanced":               { cold_min: 3, low_light: 2, dryness: 2, thin_air: 1, clear_sky: 1 },
      "Mobility & robotics":    { low_light: 3, cold_min: 2, dryness: 2, temp_swing: 1 },
      "Construction & habitat": { cold_min: 3, temp_swing: 2, low_light: 2, dryness: 1 },
      "Resources (ice)":        { cold_min: 4, cold: 2, low_light: 2 },
      "Human operations":       { cold_min: 2, low_light: 2, thin_air: 2, uv: 1 }
    }
  }
};

// Rough region names for grid points: [latMin, latMax, lonMin, lonMax, name]
const REGIONS = [
  [-90, -60, -180, 180, "Antarctica"],
  [59, 84, -74, -10, "Greenland"],
  [-30, -14, -72, -63, "Altiplano / Puna (Andes)"],
  [-40, -30, -72, -66, "Central Andes"],
  [-56, -40, -76, -63, "Patagonia"],
  [27, 37, 78, 104, "Tibetan Plateau"],
  [34, 40, 66, 78, "Pamir & Hindu Kush"],
  [36, 42, 75, 90, "Taklamakan / Tarim Basin"],
  [38, 50, 90, 120, "Gobi / Mongolia"],
  [25, 38, 44, 66, "Iranian Plateau"],
  [12, 32, 35, 60, "Arabian Peninsula"],
  [15, 34, -17, 35, "Sahara"],
  [5, 15, 34, 45, "Ethiopian Highlands"],
  [-30, -15, 11, 26, "Namib / Kalahari"],
  [-35, -15, 115, 145, "Australian Outback"],
  [30, 42, -120, -103, "US Southwest"],
  [15, 30, -118, -98, "Northern Mexico"],
  [55, 72, -170, -125, "Alaska & Yukon"],
  [60, 84, -125, -74, "Arctic Canada"],
  [40, 55, 50, 90, "Central Asian steppe"],
  [50, 78, 60, 180, "Siberia"]
];

function regionOf(lat, lon) {
  const r = REGIONS.find(([a, b, c, d]) => lat >= a && lat <= b && lon >= c && lon <= d);
  return r ? r[4] : null;
}

const state = {
  target: "mars",
  preset: "Balanced",
  weights: {},
  month: -1,
  hideAntarctica: true,
  selected: null,
  view: "twins",
  skipPhases: new Set(),
  blocked: new Set()
};

const PHASES = {
  mars: [
    { name: "Landing & navigation",   w: { clear_sky: 3, dryness: 2, wind_dust: 1, temp_swing: 1 } },
    { name: "Mobility & robotics",    w: { dryness: 3, temp_swing: 2, wind_dust: 2, cold: 1, thin_air: 1 } },
    { name: "Construction & habitat", w: { cold: 3, temp_swing: 3, wind_dust: 2, thin_air: 2, dryness: 1 } },
    { name: "Resources (ice)",        w: { cold_min: 3, cold: 2, dryness: 1, thin_air: 1 } },
    { name: "Life detection",         w: { dryness: 4, uv: 3, thin_air: 1, cold: 1 } },
    { name: "Human operations",       w: { thin_air: 3, cold: 2, uv: 2, temp_swing: 1, dryness: 1 } }
  ],
  moon: [
    { name: "Landing & navigation",   w: { low_light: 3, clear_sky: 2, dryness: 1 } },
    { name: "Mobility & robotics",    w: { low_light: 3, cold_min: 2, dryness: 2, temp_swing: 1 } },
    { name: "Construction & habitat", w: { cold_min: 3, temp_swing: 2, low_light: 2, dryness: 1 } },
    { name: "Resources (ice)",        w: { cold_min: 4, cold: 2, low_light: 2 } },
    { name: "Human operations",       w: { cold_min: 2, low_light: 2, thin_air: 2, uv: 1 } }
  ]
};

let points = [];
let sites = [];
let map, layer, planLayer;

// ---------- data ----------

async function loadData() {
  const [p, s] = await Promise.all([
    fetch("data/app_points.json").then(r => r.json()),
    fetch("data/sites.json").then(r => r.json())
  ]);
  points = p;
  sites = s;

  points.forEach(pt => {
    pt.site = sites.find(st => st.lat === pt.lat && st.lon === pt.lon) || null;
    pt.label = pt.kind === "known" ? pt.name
      : pt.site ? pt.site.name
      : regionOf(pt.lat, pt.lon) || pt.name || "Grid point";
  });
}

// ---------- scoring ----------

function monthScore(pt, m, weights = state.weights) {
  let num = 0, den = 0;
  for (const [f, w] of Object.entries(weights)) {
    if (!w) continue;
    const v = pt.f[f] ? pt.f[f][m] : null;
    if (v === null || v === undefined) continue;
    num += v * w;
    den += w;
  }
  return den ? num / den : null;
}

function scoreAll() {
  points.forEach(pt => {
    pt.s = MONTHS.map((_, m) => monthScore(pt, m));
    const valid = pt.s.filter(v => v !== null);
    pt.best = valid.length ? Math.max(...valid) : null;
    pt.bestMonth = pt.best === null ? -1 : pt.s.indexOf(pt.best);
    pt.value = state.month === -1 ? pt.best : pt.s[state.month];
  });
}

function isHidden(pt) {
  return state.hideAntarctica && pt.lat < -60 && pt.kind !== "known";
}

function bestWindow(pt) {
  if (pt.best === null) return "–";
  const good = pt.s.map(v => v !== null && v >= pt.best - 0.02);
  const first = good.indexOf(true);
  let last = first;
  while (last + 1 < 12 && good[last + 1]) last++;
  return first === last ? MONTHS[first] : `${MONTHS[first]}–${MONTHS[last]}`;
}

// ---------- formatting ----------

const pct = v => (v === null || v === undefined ? "–" : Math.round(v * 100) + "%");

function coord(lat, lon) {
  const a = `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? "N" : "S"}`;
  const b = `${Math.abs(lon).toFixed(1)}°${lon >= 0 ? "E" : "W"}`;
  return `${a} ${b}`;
}

function scale(t) {
  const stops = getComputedStyle(document.documentElement).getPropertyValue("--scale")
    .split(",").map(s => s.trim().replace("#", ""));
  const x = Math.max(0, Math.min(1, t)) * (stops.length - 1);
  const i = Math.min(Math.floor(x), stops.length - 2);
  return mix(stops[i], stops[i + 1], x - i);
}

function mix(a, b, t) {
  const pa = a.match(/\w\w/g).map(h => parseInt(h, 16));
  const pb = b.match(/\w\w/g).map(h => parseInt(h, 16));
  return "#" + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, "0")).join("");
}

// ---------- theme ----------

const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim().replace("#", "");

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.getElementById("theme-label").textContent = theme === "light" ? "Dark" : "Light";
  try { localStorage.setItem("aw-theme", theme); } catch (e) {}
}

function initTheme() {
  let saved = null;
  try { saved = localStorage.getItem("aw-theme"); } catch (e) {}
  applyTheme(saved || "light");
  document.getElementById("theme-btn").onclick = () => {
    applyTheme(document.documentElement.dataset.theme === "light" ? "dark" : "light");
    update();
  };
}

// ---------- map ----------

function initMap() {
  map = L.map("map", { worldCopyJump: true, minZoom: 2, maxZoom: 8, preferCanvas: true, zoomControl: false })
    .setView([20, 10], 2);
  L.control.zoom({ position: "topright" }).addTo(map);
  map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');

  const gibs = L.tileLayer(
    "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg",
    { maxNativeZoom: 8, attribution: "Imagery: NASA GIBS / Blue Marble" }
  ).addTo(map);

  let errors = 0;
  gibs.on("tileerror", () => {
    if (++errors === 5) {
      map.removeLayer(gibs);
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: "© OpenStreetMap © CARTO"
      }).addTo(map);
    }
  });

  layer = L.layerGroup().addTo(map);
  map.on("zoomend", () => { if (points.length) drawMap(); });
  planLayer = L.layerGroup().addTo(map);
}

function drawMap() {
  layer.clearLayers();
  const vals = points.filter(p => !isHidden(p) && p.value !== null).map(p => p.value);
  const lo = Math.min(...vals), hi = Math.max(...vals);

  const sorted = [...points].sort((a, b) => (a.value ?? 0) - (b.value ?? 0));
  sorted.forEach(pt => {
    if (pt.value === null) return;
    const hidden = isHidden(pt);
    const z = map.getZoom();
    if (pt.kind === "fine" && !pt.site && z < 4) return;
    const t = Math.pow((pt.value - lo) / (hi - lo || 1), 2);
    let opts;

    if (pt.kind === "known") {
      opts = { radius: 3.5 + z * 0.4, color: "#" + css("--panel"), weight: 1.5, fillColor: "#" + css("--bench"), fillOpacity: 1 };
    } else if (pt.site) {
      opts = { radius: 4 + z * 0.6, color: "#" + css("--accent"), weight: 2, fillColor: "#" + css("--panel"), fillOpacity: 1 };
    } else {
      opts = {
        radius: pt.kind === "fine" ? 0.6 + z * 0.5 : 1.2 + z * 0.6,
        stroke: false,
        fillColor: scale(t),
        fillOpacity: hidden ? 0.1 : 0.45 + 0.55 * t
      };
    }

    const m = L.circleMarker([pt.lat, pt.lon], opts)
      .bindTooltip(`${placeName(pt)}<br>${coord(pt.lat, pt.lon)} · ${pct(pt.value)}`)
      .on("click", () => showDetail(pt));
    m.addTo(layer);
  });
}

// ---------- controls ----------

function renderTargets() {
  const box = document.getElementById("targets");
  box.innerHTML = "";
  Object.entries(TARGETS).forEach(([key, t]) => {
    const b = document.createElement("button");
    b.className = "target-btn" + (state.target === key ? " on" : "");
    b.textContent = t.label;
    b.onclick = () => {
      state.target = key;
      state.skipPhases.clear();
      state.blocked.clear();
      setPreset("Balanced");
      renderTargets();
    };
    box.appendChild(b);
  });
}

function setPreset(name) {
  state.preset = name;
  const base = TARGETS[state.target].presets[name];
  state.weights = {};
  Object.keys(FACTORS).forEach(f => (state.weights[f] = base[f] || 0));
  renderPresets();
  renderSliders();
  update();
}

function renderPresets() {
  const box = document.getElementById("presets");
  box.innerHTML = "";
  Object.keys(TARGETS[state.target].presets).forEach(name => {
    const b = document.createElement("button");
    b.className = "chip" + (state.preset === name ? " on" : "");
    b.textContent = name;
    b.onclick = () => setPreset(name);
    box.appendChild(b);
  });
}

function renderSliders() {
  const box = document.getElementById("sliders");
  box.innerHTML = "";
  Object.entries(FACTORS).forEach(([f, label]) => {
    const row = document.createElement("label");
    row.className = "slider";
    row.innerHTML = `
      <span class="row-between"><span>${label}</span><span>${state.weights[f]}</span></span>
      <input type="range" min="0" max="5" step="0.5" value="${state.weights[f]}">`;
    const input = row.querySelector("input");
    const out = row.querySelector(".row-between span:last-child");
    const fill = () => input.style.setProperty("--p", (input.value / 5) * 100 + "%");
    fill();
    input.oninput = () => {
      fill();
      state.weights[f] = parseFloat(input.value);
      out.textContent = input.value;
      state.preset = null;
      renderPresets();
      update();
    };
    box.appendChild(row);
  });
}

function renderMonths() {
  const box = document.getElementById("months");
  box.innerHTML = "";
  ["Best", ...MONTHS].forEach((name, i) => {
    const m = i - 1;
    const b = document.createElement("button");
    b.className = "month-btn" + (state.month === m ? " on" : "");
    b.textContent = name;
    b.onclick = () => {
      state.month = m;
      renderMonths();
      update();
    };
    box.appendChild(b);
  });
}

// ---------- ranking ----------

function renderRanking() {
  const visible = points.filter(p => !isHidden(p) && p.value !== null && p.kind !== "known");
  visible.sort((a, b) => b.value - a.value);

  const picked = [];
  for (const p of visible) {
    if (picked.every(q => Math.hypot(q.lat - p.lat, q.lon - p.lon) > 3)) picked.push(p);
    if (picked.length === 8) break;
  }

  document.getElementById("twins-intro").innerHTML =
    `Places on Earth ranked by how closely their conditions match <b>${TARGETS[state.target].label}</b>. 100% would be the most ${state.target === "mars" ? "Mars" : "Moon"}-like place on Earth. Click a place to see why.`;
  const list = document.getElementById("rank-list");
  list.innerHTML = "";
  picked.forEach((p, i) => {
    const li = document.createElement("li");
    li.className = "rank-item";
    li.innerHTML = `
      <span class="rank-n">${String(i + 1).padStart(2, "0")}</span>
      <span class="rank-main">
        <span class="rank-name">${p.label === "Grid point" ? coord(p.lat, p.lon) : p.label}</span>
        <span class="rank-meta ${p.site ? "site" : ""}">${p.site ? "CANDIDATE SITE" : coord(p.lat, p.lon)} · BEST ${bestWindow(p).toUpperCase()}</span>
      </span>
      <span class="rank-score">${pct(p.value)}</span>`;
    li.onclick = () => showDetail(p);
    list.appendChild(li);
  });

  const all = points.filter(p => !isHidden(p) && p.value !== null).sort((a, b) => b.value - a.value);
  const bench = document.getElementById("bench-list");
  bench.innerHTML = "";
  points.filter(p => p.kind === "known").forEach(p => {
    const rank = all.indexOf(p) + 1;
    const li = document.createElement("li");
    li.className = "bench-item";
    li.innerHTML = `
      <span class="rank-main">
        <span class="rank-name">${p.label}</span>
        <span class="rank-meta">RANK ${rank} OF ${all.length} · BEST ${bestWindow(p).toUpperCase()}</span>
      </span>
      <span class="rank-score">${pct(p.value)}</span>`;
    li.onclick = () => showDetail(p);
    bench.appendChild(li);
  });
}

// ---------- detail ----------

function showDetail(pt, fly = true) {
  state.selected = pt;
  if (fly) map.flyTo([pt.lat, pt.lon], Math.max(map.getZoom(), 5), { duration: 0.8 });

  const m = state.month === -1 ? pt.bestMonth : state.month;
  const raw = k => (pt.raw[k] ? pt.raw[k][m] : null);
  const fmt = (v, unit) => (v === null || v === undefined ? "–" : `${v}${unit}`);
  const tag = pt.kind === "known" ? `<span class="tag bench">KNOWN ANALOG · BENCHMARK</span>`
    : pt.site ? `<span class="tag">NEW CANDIDATE SITE</span>`
    : `<span class="tag">GRID POINT</span>`;

  const strip = pt.s.map((v, i) => {
    const t = v === null ? 0 : Math.max(0, Math.min(1, (v - 0.4) / 0.5));
    const bg = scale(t);
    const fg = t > 0.6 ? "#" + css("--on-accent") : "#" + css("--muted");
    return `<div style="background:${bg};color:${fg}" title="${MONTHS[i]}: ${pct(v)}">${MONTHS[i][0]}</div>`;
  }).join("");

  const bars = Object.entries(state.weights)
    .filter(([, w]) => w > 0)
    .map(([f]) => {
      const v = pt.f[f] ? pt.f[f][m] : null;
      return `<div class="bar-row">
        <span class="row-between"><span>${FACTORS[f]}</span><span>${pct(v)}</span></span>
        <div class="bar"><i style="width:${v === null ? 0 : v * 100}%"></i></div>
      </div>`;
    }).join("");

  const site = pt.site ? `
    <h2 class="label spaced">Surface (NASA Worldview check)</h2>
    <p class="prose">${pt.site.surface}</p>
    <p class="prose">${pt.site.special}</p>
    <div class="lists">
      <div class="list-box"><span class="label ok">Test here</span><ul>${pt.site.testHere.map(x => `<li>${x}</li>`).join("")}</ul></div>
      <div class="list-box"><span class="label no">Not valid for</span><ul>${pt.site.notValid.map(x => `<li>${x}</li>`).join("")}</ul></div>
    </div>` : "";

  const box = document.getElementById("detail");
  box.innerHTML = `
    <div class="detail-head">
      <div>${tag}</div>
      <button class="back" id="back">← Back</button>
    </div>
    <h3 class="detail-title">${pt.label === "Grid point" ? coord(pt.lat, pt.lon) : pt.label}</h3>
    <div class="detail-place">${pt.site ? pt.site.place + " · " : ""}${coord(pt.lat, pt.lon)} · ${Math.round(pt.elev)} m</div>

    <div class="big-score">
      <div><span class="k">TWIN SCORE</span><span class="v">${pct(pt.value)}</span></div>
      <div><span class="k">BEST WINDOW</span><span class="v">${bestWindow(pt)}</span></div>
    </div>

    <h2 class="label spaced">Twin score by month</h2>
    <div class="strip">${strip}</div>

    <h2 class="label spaced">Factors · ${MONTHS[m]}</h2>
    <div class="bars">${bars}</div>

    <h2 class="label spaced">Conditions · ${MONTHS[m]} (NASA POWER)</h2>
    <div class="facts">
      <div class="fact"><span class="k">AVG TEMP</span><div class="v">${fmt(raw("T2M"), " °C")}</div></div>
      <div class="fact"><span class="k">NIGHT MIN</span><div class="v">${fmt(raw("T2M_MIN"), " °C")}</div></div>
      <div class="fact"><span class="k">RAIN</span><div class="v">${fmt(raw("PRECTOTCORR"), " mm/day")}</div></div>
      <div class="fact"><span class="k">HUMIDITY</span><div class="v">${fmt(raw("RH2M"), " %")}</div></div>
      <div class="fact"><span class="k">AIR PRESSURE</span><div class="v">${fmt(raw("PS"), " kPa")}</div></div>
      <div class="fact"><span class="k">UV INDEX</span><div class="v">${fmt(raw("ALLSKY_SFC_UV_INDEX"), "")}</div></div>
    </div>
    ${site}
    <p class="limits">${TARGETS[state.target].note} No place on Earth reproduces low gravity, vacuum, thin Martian air or space radiation.</p>`;

  document.getElementById("ranking").classList.add("hidden");
  document.getElementById("plan").classList.add("hidden");
  box.classList.remove("hidden");
  document.getElementById("back").onclick = closeDetail;
}

function closeDetail() {
  state.selected = null;
  document.getElementById("detail").classList.add("hidden");
  document.getElementById("ranking").classList.toggle("hidden", state.view !== "twins");
  document.getElementById("plan").classList.toggle("hidden", state.view !== "plan");
}


// ---------- rehearsal plan ----------

function placeName(p) {
  return p.label === "Grid point" ? coord(p.lat, p.lon) : p.label;
}

function computePlan() {
  const pool = points.filter(p => !isHidden(p));
  const usedMonths = new Set();
  const stops = [];

  PHASES[state.target].forEach(phase => {
    if (state.skipPhases.has(phase.name)) return;
    let best = null;
    for (const p of pool) {
      if (state.blocked.has(`${phase.name}|${p.lat},${p.lon}`)) continue;
      if (stops.some(s => Math.hypot(s.pt.lat - p.lat, s.pt.lon - p.lon) < 4)) continue;
      for (let m = 0; m < 12; m++) {
        if (usedMonths.has(m)) continue;
        const v = monthScore(p, m, phase.w);
        if (v !== null && (!best || v > best.v)) best = { pt: p, m, v };
      }
    }
    if (!best) return;
    usedMonths.add(best.m);
    const why = Object.entries(phase.w)
      .map(([f, w]) => [f, (best.pt.f[f] ? best.pt.f[f][best.m] : 0) * w])
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([f]) => FACTORS[f].toLowerCase());
    stops.push({ phase: phase.name, why, ...best });
  });

  return stops.sort((a, b) => a.m - b.m);
}

function renderPlan() {
  const stops = computePlan();
  const skipped = PHASES[state.target].filter(p => state.skipPhases.has(p.name));
  const edited = state.skipPhases.size || state.blocked.size;
  const box = document.getElementById("plan");
  box.innerHTML = `
    <div class="row-between"><h2 class="label">Field test plan</h2>
      ${edited ? `<button class="mini-btn" id="plan-reset">Reset plan</button>` : ""}</div>
    <p class="plan-intro">Before a mission, teams test each part of it on Earth, in places that behave like
      <b>${TARGETS[state.target].label}</b>. This plan picks the best place and month for every part,
      one per month, so one team could test the whole mission in a year.</p>
    <div id="plan-stops">
    ${stops.map((s, i) => `
      <div class="stop" data-i="${i}">
        <span class="stop-n">${i + 1}</span>
        <div class="stop-body">
          <div class="stop-month">${MONTHS[s.m].toUpperCase()}</div>
          <div class="stop-phase">${s.phase}</div>
          <div class="stop-place">${placeName(s.pt)}</div>
          <div class="stop-why">Strong on ${s.why.join(" and ")}</div>
          <div class="stop-actions">
            <button class="mini-btn" data-act="swap" data-i="${i}">Other place</button>
            <button class="mini-btn" data-act="skip" data-i="${i}">Skip this phase</button>
          </div>
        </div>
        <span class="stop-score">${pct(s.v)}</span>
      </div>`).join("")}
    </div>
    ${skipped.length ? `<div class="skipped"><span class="label">Skipped phases</span>
      ${skipped.map(p => `<button class="mini-btn" data-act="restore" data-name="${p.name}">+ ${p.name}</button>`).join("")}</div>` : ""}`;

  box.querySelectorAll(".stop").forEach(el =>
    (el.onclick = () => showDetail(stops[+el.dataset.i].pt)));
  box.querySelectorAll("[data-act]").forEach(b => (b.onclick = e => {
    e.stopPropagation();
    const s = stops[+b.dataset.i];
    if (b.dataset.act === "swap") state.blocked.add(`${s.phase}|${s.pt.lat},${s.pt.lon}`);
    if (b.dataset.act === "skip") state.skipPhases.add(s.phase);
    if (b.dataset.act === "restore") state.skipPhases.delete(b.dataset.name);
    update();
  }));
  const reset = document.getElementById("plan-reset");
  if (reset) reset.onclick = () => { state.skipPhases.clear(); state.blocked.clear(); update(); };

  const tl = document.getElementById("plan-timeline");
  tl.innerHTML = `
    <div class="row-between"><h2 class="label">Test calendar</h2>
    <span class="mono accent">${stops.length} phases · ${TARGETS[state.target].label}</span></div>
    <div class="timeline">${MONTHS.map((name, m) => {
      const s = stops.find(x => x.m === m);
      const i = stops.indexOf(s);
      return `<div class="tl-col ${s ? "has" : ""}"><div class="tl-m">${name.toUpperCase()}</div>
        ${s ? `<div class="tl-chip" data-i="${i}"><b>${i + 1}</b>${s.phase}</div>` : ""}</div>`;
    }).join("")}</div>`;
  tl.querySelectorAll(".tl-chip").forEach(el =>
    (el.onclick = () => showDetail(stops[+el.dataset.i].pt)));

  planLayer.clearLayers();
  L.polyline(stops.map(s => [s.pt.lat, s.pt.lon]), {
    color: "#" + css("--accent"), weight: 2, dashArray: "6 6", opacity: 0.9
  }).addTo(planLayer);
  stops.forEach((s, i) => {
    L.marker([s.pt.lat, s.pt.lon], {
      icon: L.divIcon({ className: "", html: `<div class="num-marker">${i + 1}</div>`, iconSize: [26, 26], iconAnchor: [13, 13] })
    }).bindTooltip(`${MONTHS[s.m]} · ${s.phase}<br>${placeName(s.pt)}`)
      .on("click", () => showDetail(s.pt))
      .addTo(planLayer);
  });
}

function setView(view) {
  state.view = view;
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("on", t.dataset.view === view));
  closeDetail();
  update();
}


// ---------- welcome and tour ----------

const STEP = {
  target: { el: "#targets", title: "Choose what to look for",
    text: "Mars or the Moon's south pole. You never leave Earth: every place in the app is on Earth, compared with your target." },
  mission: { el: "#mission-block", title: "Choose the mission type",
    text: "Rover driving, building a habitat, drilling for ice, searching for life or crew operations. Each one cares about different conditions, so the results change." },
  sliders: { el: "#sliders-block", title: "Set what matters",
    text: "Drag a slider to make a condition more or less important. The map, ranking and plan update instantly." },
  antarctica: { el: "#hide-antarctica", parent: ".card", title: "Antarctica filter",
    text: "Antarctica is already well studied, so it is hidden by default to bring lesser-known places forward. Untick it to include it." },
  map: { el: ".map-wrap", view: "twins", title: "Read the map",
    text: "Each dot is a place on Earth. Brighter means more like your target. Rings are candidate sites we checked in NASA satellite images; solid dots are famous analog sites used as benchmarks. Click any dot for details." },
  months: { el: ".months-card", title: "Pick a month",
    text: "Conditions change through the year. 'Best' shows each place in its best month; pick a month to see where to go at that time." },
  twins: { el: "#ranking", view: "twins", title: "Top twins",
    text: "The places on Earth that match your target best, with their score and best month. Click any place to open its profile." },
  detail: { el: "#detail", detail: true, title: "Site profile",
    text: "Everything about one place: the score for every month, each condition, real NASA measurements, a satellite-image description, what you could test there and what it is not good for." },
  bench: { el: "#bench-block", view: "twins", title: "Benchmarks",
    text: "Famous analog sites are scored the same way, to test the method. Dry deserts like the Atacama and Death Valley score well on climate; sites famous for craters or lava (Haughton, Iceland) score low, because the score measures climate, not geology." },
  planIntro: { el: "#plan", view: "plan", title: "Field test plan",
    text: "Before a rover or crew goes to Mars, the team tests each part of the mission on Earth first. This plan picks the best place and month for every part of the mission, one per month." },
  planStop: { el: "#plan-stops .stop", view: "plan", title: "Read a stop",
    text: "When (month), what to test (phase), where (place), how good the match is (%) and why. Click a stop to open the site profile." },
  planEdit: { el: "#plan-stops .stop-actions", view: "plan", title: "Change the plan",
    text: "'Other place' swaps in the next best place, for example if one is hard to reach. 'Skip this phase' removes a part your mission doesn't need. 'Reset plan' undoes all changes." },
  route: { el: ".map-wrap", view: "plan", title: "The route",
    text: "Numbered markers and a dashed line show the stops on the map in calendar order." },
  calendar: { el: "#plan-timeline", view: "plan", title: "The year at a glance",
    text: "Which part of the mission is tested in which month, so you can plan travel and teams." },
  method: { el: "#open-method", title: "How the score works",
    text: "The formula, every NASA data source and the limits. No place on Earth has low gravity, vacuum or Mars's thin air." },
  settings: { el: ".top-right", title: "Light or dark, and help",
    text: "Switch between light and dark mode, and open this guide again any time with 'How it works'." }
};

const TOURS = {
  plan: ["planIntro", "planStop", "planEdit", "route", "calendar", "map", "mission", "target", "sliders", "months", "twins", "detail", "bench", "antarctica", "method", "settings"],
  explore: ["map", "twins", "detail", "bench", "mission", "sliders", "months", "target", "antarctica", "planIntro", "planStop", "planEdit", "route", "calendar", "method", "settings"],
  curious: ["target", "mission", "sliders", "map", "months", "twins", "detail", "bench", "planIntro", "planStop", "planEdit", "route", "calendar", "antarctica", "method", "settings"]
};
let TOUR = TOURS.curious.map(k => STEP[k]);
let tourIndex = 0;

let focusedEl = null;

function placeSpot() {
  if (!focusedEl) return;
  const pad = 10;
  const r = focusedEl.getBoundingClientRect();
  const spot = document.getElementById("tour-spot");
  spot.style.left = r.left - pad + "px";
  spot.style.top = r.top - pad + "px";
  spot.style.width = r.width + pad * 2 + "px";
  spot.style.height = r.height + pad * 2 + "px";

  const card = document.getElementById("tour-card");
  const w = 320, h = card.offsetHeight, gap = 20;
  let left, top;
  if (r.right + pad + gap + w < window.innerWidth) { left = r.right + pad + gap; top = r.top - pad; }
  else if (r.left - pad - gap - w > 0) { left = r.left - pad - gap - w; top = r.top - pad; }
  else { left = r.left + r.width / 2 - w / 2; top = r.bottom + pad + gap; }
  top = Math.max(14, Math.min(top, window.innerHeight - h - 14));
  left = Math.max(14, Math.min(left, window.innerWidth - w - 14));
  card.style.left = left + "px";
  card.style.top = top + "px";
}

function showTourStep() {
  const step = TOUR[tourIndex];
  if (step.view && state.view !== step.view) setView(step.view);
  if (step.detail) {
    const best = points.filter(p => !isHidden(p) && p.value !== null && p.kind !== "known")
      .sort((a, b) => b.value - a.value)[0];
    showDetail(best, false);
  } else if (state.selected) {
    closeDetail();
  }
  focusedEl = document.querySelector(step.el);
  if (step.el === "#targets" || step.parent) focusedEl = focusedEl.closest(".card");
  focusedEl.scrollIntoView({ block: "center", behavior: "smooth" });

  document.getElementById("tour-step").textContent = `STEP ${tourIndex + 1} OF ${TOUR.length}`;
  document.getElementById("tour-title").textContent = step.title.replace(/^\d+\.\s*/, "");
  document.getElementById("tour-text").textContent = step.text;
  document.getElementById("tour-next").textContent = tourIndex === TOUR.length - 1 ? "Finish" : "Next";

  document.getElementById("tour-spot").classList.remove("hidden");
  document.getElementById("tour-card").classList.remove("hidden");
  placeSpot();
  setTimeout(placeSpot, 400);
}

function endTour() {
  focusedEl = null;
  document.getElementById("tour-spot").classList.add("hidden");
  document.getElementById("tour-card").classList.add("hidden");
  document.getElementById("welcome").classList.add("hidden");
}

function startMode(mode) {
  document.getElementById("welcome").classList.add("hidden");
  state.target = "mars";
  renderTargets();
  if (mode === "plan") {
    setPreset("Mobility & robotics");
    setView("plan");
  } else {
    setPreset("Balanced");
    setView("twins");
  }
  TOUR = TOURS[mode === "tour" ? "curious" : mode].map(k => STEP[k]);
  tourIndex = 0;
  setTimeout(showTourStep, 150);
}

function initWelcome() {
  const welcome = document.getElementById("welcome");
  welcome.querySelectorAll(".welcome-opt").forEach(b => (b.onclick = () => startMode(b.dataset.mode)));
  document.getElementById("tour-skip").onclick = endTour;
  document.getElementById("tour-end").onclick = endTour;
  document.getElementById("tour-next").onclick = () => {
    if (++tourIndex >= TOUR.length) endTour();
    else showTourStep();
  };
  document.getElementById("help-btn").onclick = () => welcome.classList.remove("hidden");
  window.addEventListener("resize", placeSpot);
  window.addEventListener("scroll", placeSpot, { passive: true });

  welcome.classList.remove("hidden");
}

// ---------- main ----------

function update() {
  if (!points.length) return;
  document.getElementById("map-title").innerHTML = TARGETS[state.target].title;
  scoreAll();
  drawMap();
  renderRanking();
  const planMode = state.view === "plan";
  document.getElementById("plan-timeline").classList.toggle("hidden", !planMode);
  if (planMode) renderPlan();
  else planLayer.clearLayers();
  if (state.selected) showDetail(state.selected, false);
}

async function start() {
  initTheme();
  initMap();
  renderTargets();
  renderMonths();

  document.querySelectorAll(".tab").forEach(t => (t.onclick = () => setView(t.dataset.view)));
  document.getElementById("hide-antarctica").onchange = e => {
    state.hideAntarctica = e.target.checked;
    update();
  };
  document.getElementById("open-method").onclick = e => {
    e.preventDefault();
    document.getElementById("method").classList.remove("hidden");
  };
  document.getElementById("close-method").onclick = () =>
    document.getElementById("method").classList.add("hidden");

  try {
    await loadData();
    document.getElementById("status").textContent =
      `${points.length.toLocaleString("en")} places · NASA climate data 2001–2020`;
  } catch (err) {
    document.getElementById("status").textContent = "Could not load data — open with Live Server";
    return;
  }
  setPreset("Balanced");
  initWelcome();
}

start();
