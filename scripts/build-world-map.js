// ===== Build the world map for the Students page =====
// Turns Natural Earth's country boundaries into one small SVG file: assets/map/world-countries.svg
//
// Source: Natural Earth, "Admin 0 – Countries", 1:50m, release v5.1.2
//   https://github.com/nvkelso/natural-earth-vector/blob/v5.1.2/geojson/ne_50m_admin_0_countries.geojson
//   Licence: public domain (https://www.naturalearthdata.com/about/terms-of-use/). No attribution required,
//   but we credit it on the page and in docs/students-explorer.md.
//
// Run (only needed to rebuild the map; the SVG is committed):
//   1. download the file above
//   2. node scripts/build-world-map.js path/to/ne_50m_admin_0_countries.geojson
//
// What it does: projects every country with the Equal Earth projection (areas are not exaggerated),
// simplifies the outlines, drops Antarctica, and groups each country's shapes under one ISO 3166-1
// alpha-2 code. It uses Natural Earth's ISO_A2_EH field, because ISO_A2 is "-99" for Norway, France and
// Kosovo. Areas without any code (Somaliland, Northern Cyprus, Siachen Glacier) are drawn but cannot be
// selected; see docs/students-explorer.md.

const fs = require("fs");
const path = require("path");

const SOURCE = process.argv[2];
const OUT = path.join(__dirname, "..", "assets", "map", "world-countries.svg");
const WIDTH = 1000;
const TOLERANCE = 0.25; // simplification, in map units (the map is 1000 units wide)

if (!SOURCE) {
  console.error("Usage: node scripts/build-world-map.js path/to/ne_50m_admin_0_countries.geojson");
  process.exit(1);
}

// Equal Earth projection (Šavrič, Patterson, Jenny 2018)
const A1 = 1.340264, A2 = -0.081106, A3 = 0.000893, A4 = 0.003796, M = Math.sqrt(3) / 2;
function equalEarth(lon, lat) {
  const l = (lon * Math.PI) / 180;
  const t = Math.asin(M * Math.sin((lat * Math.PI) / 180));
  const t2 = t * t, t6 = t2 * t2 * t2;
  const x = (2 * Math.sqrt(3) * l * Math.cos(t)) / (3 * (9 * A4 * t6 * t2 + 7 * A3 * t6 + 3 * A2 * t2 + A1));
  const y = A4 * t6 * t2 * t + A3 * t6 * t + A2 * t2 * t + A1 * t;
  return [x, y];
}
const MAX_X = equalEarth(180, 0)[0];
const SCALE = WIDTH / (2 * MAX_X);
const TOP = equalEarth(0, 84)[1]; // nothing interesting north of 84°
const BOTTOM = equalEarth(0, -58)[1]; // Antarctica is dropped
const HEIGHT = Math.ceil((TOP - BOTTOM) * SCALE);
const project = ([lon, lat]) => {
  const [x, y] = equalEarth(lon, lat);
  return [(x + MAX_X) * SCALE, (TOP - y) * SCALE];
};

// Douglas–Peucker line simplification
function simplify(points) {
  if (points.length < 4) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let max = 0, index = -1;
    const [ax, ay] = points[a], [bx, by] = points[b];
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * points[i][0] - dx * points[i][1] + bx * ay - by * ax) / len;
      if (d > max) { max = d; index = i; }
    }
    if (max > TOLERANCE) { keep[index] = 1; stack.push([a, index], [index, b]); }
  }
  return points.filter((_, i) => keep[i]);
}

// A ring starts and ends at the same point, so split it at its farthest point and simplify both halves
function simplifyRing(ring) {
  const [x0, y0] = ring[0];
  let far = 0, max = -1;
  ring.forEach(([x, y], i) => { const d = Math.hypot(x - x0, y - y0); if (d > max) { max = d; far = i; } });
  if (far === 0) return [];
  return [...simplify(ring.slice(0, far + 1)), ...simplify(ring.slice(far)).slice(1)];
}

const area = (ring) => Math.abs(ring.reduce((s, [x, y], i) => {
  const [x2, y2] = ring[(i + 1) % ring.length];
  return s + x * y2 - x2 * y;
}, 0) / 2);

const ringPath = (ring) => "M" + ring.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join("L") + "Z";

const data = JSON.parse(fs.readFileSync(SOURCE, "utf8"));
const byCode = new Map(); // code -> { name, rings: [] }
let uncoded = [];
for (const feature of data.features) {
  const p = feature.properties;
  if (p.CONTINENT === "Antarctica") continue;
  const code = p.ISO_A2_EH && p.ISO_A2_EH !== "-99" ? p.ISO_A2_EH : "";
  const polygons = feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates;
  const rings = [];
  for (const polygon of polygons) {
    for (const ring of polygon) {
      const projected = simplifyRing(ring.map(project));
      if (projected.length >= 4) rings.push(projected);
    }
  }
  // Keep tiny islands only if the country has nothing bigger (so small states stay on the map)
  const largest = Math.max(0, ...rings.map(area));
  const kept = rings.filter((r) => area(r) >= Math.min(0.4, largest));
  if (!kept.length) continue;
  if (!code) { uncoded.push({ name: p.NAME, rings: kept }); continue; }
  if (!byCode.has(code)) byCode.set(code, { name: p.NAME, rings: [] });
  byCode.get(code).rings.push(...kept);
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const lines = [
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" data-projection="equal-earth" data-source="Natural Earth 1:50m admin-0 countries v5.1.2 (public domain)">`,
];
for (const [code, { name, rings }] of [...byCode.entries()].sort()) {
  lines.push(`<path class="map-country" data-code="${code}" data-name="${esc(name)}" d="${rings.map(ringPath).join("")}"/>`);
}
for (const { name, rings } of uncoded) {
  lines.push(`<path class="map-country map-uncoded" data-name="${esc(name)}" d="${rings.map(ringPath).join("")}"/>`);
}
lines.push("</svg>");
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, lines.join("\n") + "\n");

// The projection of a box, for the "Europe" preset in students-config.js
const box = (w, s, e, n) => {
  const pts = [];
  for (let lon = w; lon <= e; lon += 1) for (const lat of [s, n]) pts.push(project([lon, lat]));
  for (let lat = s; lat <= n; lat += 1) for (const lon of [w, e]) pts.push(project([lon, lat]));
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)].map((v) => Math.round(v));
};
console.log(`Wrote ${path.relative(process.cwd(), OUT)}: ${byCode.size} coded countries, ${uncoded.length} uncoded areas (${uncoded.map((u) => u.name).join(", ")}), ${Math.round(fs.statSync(OUT).size / 1024)} KB, viewBox 0 0 ${WIDTH} ${HEIGHT}`);
console.log(`Europe preset viewBox (lon -25..45, lat 34..71): ${box(-25, 34, 45, 71).join(" ")}`);
