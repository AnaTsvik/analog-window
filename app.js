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
    label: "Mars · Jezero & Gale craters",
    note: "Mars: about 0.6 kPa air pressure, no rain, around −60 °C on average.",
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
    note: "Moon's south pole: no atmosphere, low sun, shadowed craters colder than −230 °C (LRO Diviner).",
    presets: {
      "Balanced":               { cold_min: 3, low_light: 2, dryness: 2, thin_air: 1, clear_sky: 1 },
      "Mobility & robotics":    { low_light: 3, cold_min: 2, dryness: 2, temp_swing: 1 },
      "Construction & habitat": { cold_min: 3, temp_swing: 2, low_light: 2, dryness: 1 },
      "Resources (ice)":        { cold_min: 4, cold: 2, low_light: 2 },
      "Human operations":       { cold_min: 2, low_light: 2, thin_air: 2, uv: 1 }
    }
  }
};

const state = {
  target: "mars",
  preset: "Balanced",
  weights: {},
  month: -1,
  hideAntarctica: true,
  selected: null
};

let points = [];
let sites = [];
let map, layer;

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
      : pt.kind === "fine" ? pt.name
      : "Grid point";
  });
}

// ---------- scoring ----------

function monthScore(pt, m) {
  let num = 0, den = 0;
  for (const [f, w] of Object.entries(state.weights)) {
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

function mix(a, b, t) {
  const pa = a.match(/\w\w/g).map(h => parseInt(h, 16));
  const pb = b.match(/\w\w/g).map(h => parseInt(h, 16));
  return "#" + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, "0")).join("");
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

  map.getPane("tilePane").style.filter = "brightness(0.55) saturate(0.7)";
  layer = L.layerGroup().addTo(map);
}

function drawMap() {
  layer.clearLayers();
  const vals = points.filter(p => !isHidden(p) && p.value !== null).map(p => p.value);
  const lo = Math.min(...vals), hi = Math.max(...vals);

  const sorted = [...points].sort((a, b) => (a.value ?? 0) - (b.value ?? 0));
  sorted.forEach(pt => {
    if (pt.value === null) return;
    const hidden = isHidden(pt);
    const t = Math.pow((pt.value - lo) / (hi - lo || 1), 2);
    let opts;

    if (pt.kind === "known") {
      opts = { radius: 6, color: "#060A18", weight: 1.5, fillColor: "#7FB6D1", fillOpacity: 1 };
    } else if (pt.site) {
      opts = { radius: 8, color: "#F28C3A", weight: 2.5, fillColor: "#060A18", fillOpacity: 0.9 };
    } else {
      opts = {
        radius: pt.kind === "fine" ? 2.6 : 3.6,
        stroke: false,
        fillColor: mix("24345F", "F28C3A", t),
        fillOpacity: hidden ? 0.08 : 0.35 + 0.6 * t
      };
    }

    const m = L.circleMarker([pt.lat, pt.lon], opts)
      .bindTooltip(`${pt.label}<br>${coord(pt.lat, pt.lon)} · ${pct(pt.value)}`)
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
    input.oninput = () => {
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
      document.getElementById("month-label").textContent =
        m === -1 ? "Best month for each place" : `How each place scores in ${MONTHS[m]}`;
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
    const bg = mix("16203F", "F28C3A", t);
    const fg = t > 0.6 ? "#060A18" : "#B9C2DA";
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
      <button class="back" id="back">← LIST</button>
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
  box.classList.remove("hidden");
  document.getElementById("back").onclick = closeDetail;
}

function closeDetail() {
  state.selected = null;
  document.getElementById("detail").classList.add("hidden");
  document.getElementById("ranking").classList.remove("hidden");
}

// ---------- main ----------

function update() {
  if (!points.length) return;
  scoreAll();
  drawMap();
  renderRanking();
  if (state.selected) showDetail(state.selected, false);
}

async function start() {
  initMap();
  renderTargets();
  renderMonths();

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
      `${points.length.toLocaleString("en")} POINTS · NASA POWER 2001–2020`;
  } catch (err) {
    document.getElementById("status").textContent = "Could not load data — open with Live Server";
    return;
  }
  setPreset("Balanced");
}

start();
