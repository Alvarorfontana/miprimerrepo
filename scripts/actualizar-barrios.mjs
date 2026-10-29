// Descarga los límites de los 48 barrios de la Ciudad de Buenos Aires (datos abiertos de la Ciudad)
// y los guarda proyectados para el mapa en data/barrios-caba.json.
// Uso: node scripts/actualizar-barrios.mjs
import { writeFile } from "node:fs/promises";

const URLS = [
  "https://cdn.buenosaires.gob.ar/datosabiertos/datasets/ministerio-de-educacion/barrios/barrios.geojson",
  "https://cdn.buenosaires.gob.ar/datosabiertos/datasets/barrios/barrios.geojson",
  "https://cdn.buenosaires.gob.ar/datosabiertos/datasets/innovacion-transformacion-digital/barrios/barrios.geojson"
];
const K = Math.cos(38 * Math.PI / 180), SC = 20, W0 = -73.6, N0 = -21.7;
const proj = (lon, lat) => [(lon - W0) * K * SC, (N0 - lat) * SC];
const tit = s => s.toLowerCase().replace(/(^|[\s.-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase()).replace(/\b(De|Del|La|Las|Los|Y)\b/g, w => w.toLowerCase()).replace(/^(.)/, c => c.toUpperCase());

let gj = null, usado = null;
for (const u of URLS) {
  try { const r = await fetch(u, { headers: { "User-Agent": "observatorio-uom/1.0" } }); if (!r.ok) throw new Error(`HTTP ${r.status}`); gj = await r.json(); usado = u; break; }
  catch (e) { console.warn(`Falló ${u}: ${e.message}`); }
}
if (!gj || !gj.features?.length) { console.log("No se pudieron bajar los barrios; se mantiene el archivo anterior."); process.exit(0); }

const barrios = gj.features.map(f => {
  const p = f.properties || {}, nombre = p.BARRIO || p.barrio || p.nombre || p.NOMBRE || "";
  const comuna = p.COMUNA || p.comuna || null;
  const polys = f.geometry.type === "MultiPolygon" ? f.geometry.coordinates : [f.geometry.coordinates];
  let d = "", sx = 0, sy = 0, n = 0;
  for (const poly of polys) for (const ring of poly) {
    let last = null; const pts = [];
    for (const c of ring) { const [x, y] = proj(c[0], c[1]); if (last && Math.hypot(x - last[0], y - last[1]) < 0.004) continue; pts.push([x, y]); last = [x, y]; sx += x; sy += y; n++; }
    d += "M" + pts.map(([x, y]) => `${x.toFixed(3)},${y.toFixed(3)}`).join("L") + "Z";
  }
  return { n: tit(String(nombre)), comuna: comuna ? +comuna : null, d, c: [+(sx / n).toFixed(3), +(sy / n).toFixed(3)] };
}).filter(b => b.n);

await writeFile(new URL("../data/barrios-caba.json", import.meta.url), JSON.stringify({
  actualizado: new Date().toISOString().slice(0, 10), fuente: "Gobierno de la Ciudad de Buenos Aires · Datos abiertos (barrios)", url: usado, barrios }));
console.log(`Listo: ${barrios.length} barrios.`);
