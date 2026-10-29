// Descarga el padrón georreferenciado de establecimientos productivos del CEP XXI
// y guarda en data/establecimientos.json solo los de ramas metalúrgicas.
// Uso: node scripts/actualizar-establecimientos.mjs
import { writeFile, readFile } from "node:fs/promises";

const URL_CSV = process.env.CEP_ESTABLECIMIENTOS_URL ||
  "https://cdn.produccion.gob.ar/cdn-cep/establecimientos-productivos/distribucion_establecimientos_productivos_sexo.csv";
const PREFIJOS = ["24", "25", "26", "27", "28", "293", "30"];

const fuentes = JSON.parse(await readFile(new URL("../data/fuentes.json", import.meta.url), "utf8"));
const ramaDe = c => {
  const r = fuentes.ramasClae.slice().sort((a, b) => b.prefijo.length - a.prefijo.length).find(r => c.startsWith(r.prefijo));
  return r ? r.prefijo : null;
};

function partirLinea(l) { // CSV simple con comillas
  const out = []; let cur = "", q = false;
  for (let i = 0; i < l.length; i++) {
    const ch = l[i];
    if (ch === '"') { if (q && l[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
    else if (ch === "," && !q) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur); return out;
}

console.log("Descargando", URL_CSV);
const res = await fetch(URL_CSV);
if (!res.ok) throw new Error(`No se pudo descargar: HTTP ${res.status}`);

const dec = new TextDecoder("utf-8");
let resto = "", cab = null, idx = {}, filas = [], total = 0; const vistos = new Set();
const buscar = (nombres) => cab.findIndex(c => nombres.some(n => c.toLowerCase().trim() === n));

for await (const trozo of res.body) {
  resto += dec.decode(trozo, { stream: true });
  const lineas = resto.split(/\r?\n/); resto = lineas.pop();
  for (const l of lineas) {
    if (!l) continue;
    const v = partirLinea(l);
    if (!cab) {
      cab = v.map(s => s.replace(/^﻿/, ""));
      idx = {
        lat: buscar(["lat", "latitud"]), lon: buscar(["lon", "lng", "longitud"]),
        clae: buscar(["clae6", "clae", "actividad"]),
        empleo: buscar(["empleo", "tramo_empleo", "rango_empleo"]),
        prov: buscar(["provincia", "provincia_id", "in_provincias", "prov"]),
        depto: buscar(["departamento", "in_departamentos", "departamento_id", "depto"])
      };
      console.log("Columnas:", cab.join(", "));
      if (idx.lat < 0 || idx.lon < 0 || idx.clae < 0) throw new Error("No encontré lat/lon/clae6 en el archivo. Revisar columnas.");
      continue;
    }
    total++;
    const clae = String(v[idx.clae] || "").padStart(6, "0");
    const rama = ramaDe(clae);
    if (!rama) continue;
    const lat = +v[idx.lat], lon = +v[idx.lon];
    if (!isFinite(lat) || !isFinite(lon) || lat === 0) continue;
    const fila = [+lat.toFixed(4), +lon.toFixed(4), clae, idx.empleo >= 0 ? v[idx.empleo] : null,
      idx.prov >= 0 ? v[idx.prov] : null, idx.depto >= 0 ? v[idx.depto] : null];
    const k = fila.join("|"); if (vistos.has(k)) continue; vistos.add(k); filas.push(fila);
  }
}

await writeFile(new URL("../data/establecimientos.json", import.meta.url), JSON.stringify({
  actualizado: new Date().toISOString().slice(0, 10),
  origen: "CEP XXI · Distribución geográfica de los establecimientos productivos",
  url: URL_CSV,
  campos: ["lat", "lon", "clae6", "empleo", "provincia", "departamento"],
  totalLeidos: total,
  filas
}));
console.log(`Listo: ${filas.length} establecimientos metalúrgicos de ${total} leídos.`);
