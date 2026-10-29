// Convierte el Excel oficial de la OEDE (empleo trimestral a 4 dígitos por provincia)
// en data/empleo-oede.json, el archivo que usa la sección "Empleo" del portal.
// Requiere: npm install xlsx@0.18.5   ·   Uso: node scripts/procesar-oede.mjs
import { readFile, writeFile, readdir } from "node:fs/promises";
import XLSX from "xlsx";

const dir = new URL("../data/fuentes/oede-provincial/", import.meta.url);
const archivo = (await readdir(dir)).find(f => f.includes("empleo_trimestral_4dig"));
if (!archivo) { console.log("No está el Excel de la OEDE todavía; se omite."); process.exit(0); }
const wb = XLSX.read(await readFile(new URL(archivo, dir)), { type: "buffer" });

const GRUPOS = {
  "27": "Metales básicos (siderurgia, aluminio, fundición)", "28": "Productos de metal",
  "29": "Maquinaria y equipo (incl. agrícola y línea blanca)", "31": "Equipo eléctrico", "32": "Electrónica",
  "34p": "Autopartes, carrocerías y remolques", "35": "Otro equipo de transporte",
  "3410": "Terminales automotrices (fuera del universo UOM)"
};
const grupo = c => { if (c === 3410) return "3410"; if (c === 3420 || c === 3430) return "34p"; const d = String(c).slice(0, 2); return ["27", "28", "29", "31", "32", "35"].includes(d) ? d : null; };
const AREAS = { "GBA": ["Buenos Aires", "Partidos del GBA"], "Resto de Buenos Aires": ["Buenos Aires", "Resto de Buenos Aires"] };

const hojas = wb.SheetNames.filter(s => !["Carátula", "Indice", "Metodología"].includes(s));
const filas0 = XLSX.utils.sheet_to_json(wb.Sheets[hojas[0]], { header: 1, raw: true });
const cab = filas0.find(r => r[0] === "Ramas").slice(2);
const per = cab.map(h => { const m = String(h).match(/(\d)° Trim (\d{4})/); return m ? `${m[2]}T${m[1]}` : String(h); });
const nq = per.length, ULT = 13;
const anios = [...new Set(per.map(p => +p.slice(0, 4)))].filter(y => per.filter(p => p.startsWith(y)).length === 4);
const anual = a => anios.map(y => { const v = per.map((p, i) => p.startsWith(y) ? a[i] : null).filter(x => x !== null); return Math.round(v.reduce((x, z) => x + z, 0) / 4); });

const areas = {}, ramas = {};
for (const h of hojas) {
  const acc = {}, sd = {};
  for (const r of XLSX.utils.sheet_to_json(wb.Sheets[h], { header: 1, raw: true })) {
    if (typeof r[0] !== "number") continue;
    const g = grupo(r[0]); if (!g) continue;
    acc[g] ??= Array(nq).fill(0); sd[g] ??= 0;
    ramas[r[0]] ??= { descripcion: String(r[1]).trim().replace(/\s+/g, " "), grupo: g, v: Array(nq).fill(0) };
    for (let i = 0; i < nq; i++) { const v = r[i + 2]; if (typeof v === "number") { acc[g][i] += v; ramas[r[0]].v[i] += v; } else if (i === nq - 1) sd[g]++; }
  }
  const [prov, nombre] = AREAS[h] || [h.replace("Santa Fé", "Santa Fe"), h];
  areas[h] = { provincia: prov, nombre, grupos: Object.fromEntries(Object.entries(acc).map(([g, a]) => [g, { anual: anual(a), trim: a.slice(-ULT), celdas_sd: sd[g] }])) };
}
const salida = {
  actualizado: new Date().toISOString().slice(0, 10),
  fuente: "OEDE, Ministerio de Capital Humano, sobre registros del SIPA. Asalariados registrados del sector privado por rama CIIU rev. 3 a 4 dígitos.",
  url: "https://www.argentina.gob.ar/trabajo/estadisticas/oede-estadisticas-provinciales",
  nota: "Promedio anual de puestos de trabajo. Las celdas con secreto estadístico ('s.d.') no se suman: en provincias chicas las cifras son un piso. 'Universo UOM' excluye las terminales automotrices (CIIU 3410).",
  anios, trimestres: per.slice(-ULT), grupos: GRUPOS, areas,
  ramas: Object.fromEntries(Object.entries(ramas).map(([c, r]) => [c, { descripcion: r.descripcion, grupo: r.grupo, anual: anual(r.v), trim: r.v.slice(-ULT) }]))
};
await writeFile(new URL("../data/empleo-oede.json", import.meta.url), JSON.stringify(salida));
console.log(`Listo: ${hojas.length} áreas, ${Object.keys(ramas).length} ramas, último trimestre ${salida.trimestres.at(-1)}.`);
