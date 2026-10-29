// Calcula las alertas del MIDTM a partir de los datos del repo y las guarda en data/alertas.json.
// Cada regla tiene un umbral documentado en data/alertas-reglas.json (editable sin tocar código).
// Uso: node scripts/alertas.mjs
import { readFile, writeFile } from "node:fs/promises";
const leer = async (n, fb = null) => { try { return JSON.parse(await readFile(new URL(`../data/${n}`, import.meta.url), "utf8")); } catch { return fb; } };

const R = await leer("alertas-reglas.json");
const U = R.umbrales;
const oede = await leer("empleo-oede.json");
const conf = await leer("conflictividad.json");
const pl = (await leer("plantas.json", { plantas: [] })).plantas;
const ev = (await leer("eventos.json", { eventos: [] })).eventos;
const imp = await leer("importaciones.json");
const S = {};
for (const f of ["indicadores-auto.json", "indicadores.json", "indec-series.json"]) {
  for (const s of (await leer(f, { series: [] })).series || []) {
    S[s.clave] ??= { nombre: s.nombre, unidad: s.unidad, datos: {} };
    for (const d of s.datos) if (d.valor != null) S[s.clave].datos[d.periodo] ??= d.valor;
  }
}
const alias = { "uci-metalmecanica": "indec-uci-metalmecanica", "uci-automotriz": "indec-uci-automotriz", "uci-metalicas": "auto-uci-metalicas" };
for (const [k, o] of Object.entries(alias)) if (!S[k] && S[o]) S[k] = S[o];

const hoy = new Date(); const A = [];
const abs = (v, d = 1) => Math.abs(v).toFixed(d).replace(".", ",");
const fmt = (v, d = 1) => (v > 0 ? "+" : "") + v.toFixed(d).replace(".", ",");
const ultimos = s => Object.keys(s.datos).sort();
const ia = (s, p) => { const a = s.datos[p], b = s.datos[`${+p.slice(0, 4) - 1}${p.slice(4)}`]; return a != null && b ? (a / b - 1) * 100 : null; };
const nivel = (v, alta, media) => (v <= alta ? "alta" : v <= media ? "media" : null);
const add = (a) => A.push({ fecha: hoy.toISOString().slice(0, 10), ...a });
const mesesAtras = p => (hoy.getFullYear() - +p.slice(0, 4)) * 12 + (hoy.getMonth() + 1 - +p.slice(5, 7));

// 1. Producción por rama (IPI): caída interanual y caídas consecutivas
for (const [k, n] of [["auto-ipi-siderurgia", "Siderurgia"], ["auto-ipi-fundicion", "Fundición"], ["auto-ipi-productos-metal", "Productos de metal"], ["auto-ipi-maquinaria", "Maquinaria y equipo"], ["auto-ipi-electricos", "Equipos eléctricos"], ["auto-ipi-autopartes", "Autopartes"], ["ipi-maquinaria-agropecuaria", "Maquinaria agropecuaria"]]) {
  const s = S[k]; if (!s) continue; const ps = ultimos(s); const p = ps.at(-1); const v = ia(s, p); if (v == null) continue;
  let racha = 0; for (const q of ps.slice().reverse()) { const x = ia(s, q); if (x != null && x < 0) racha++; else break; }
  const nv = nivel(v, U.ipi_interanual_alta, U.ipi_interanual_media) || (racha >= U.meses_consecutivos_caida ? "media" : null);
  if (nv) add({ nivel: nv, tema: "Producción", ambito: "Nacional", variable: `IPI ${n}`, periodo: p, valor: +v.toFixed(1),
    titulo: `${n}: la producción ${v < 0 ? "cae" : "sube"} ${abs(v)}% interanual`, detalle: racha > 1 ? `Lleva ${racha} meses seguidos por debajo del año anterior.` : "", fuente: "INDEC" });
}

// 2. Capacidad instalada
for (const [k, n] of [["uci-metalmecanica", "Metalmecánica"], ["uci-automotriz", "Automotriz"], ["uci-metalicas", "Metálicas básicas"], ["adimra-capacidad", "Metalúrgica (ADIMRA)"]]) {
  const s = S[k]; if (!s) continue; const p = ultimos(s).at(-1); const v = s.datos[p]; const prev = s.datos[`${+p.slice(0, 4) - 1}${p.slice(4)}`];
  const caida = prev != null ? v - prev : null;
  const nv = v < U.capacidad_alta ? "alta" : v < U.capacidad_media ? "media" : (caida != null && caida <= -U.capacidad_caida_puntos ? "media" : null);
  if (nv) add({ nivel: nv, tema: "Capacidad instalada", ambito: "Nacional", variable: `Capacidad ${n}`, periodo: p, valor: v,
    titulo: `${n}: ${String(v).replace(".", ",")}% de la capacidad en uso`, detalle: caida != null ? `${fmt(caida)} puntos contra un año atrás.` : "", fuente: k.startsWith("adimra") ? "ADIMRA" : "INDEC" });
}

// 3. Actividad ADIMRA y acero crudo
for (const [k, n, fuente] of [["adimra-actividad", "Actividad metalúrgica", "ADIMRA"]]) {
  const s = S[k]; if (!s) continue; const ps = ultimos(s); const p = ps.at(-1); const v = s.datos[p];
  let racha = 0; for (const q of ps.slice().reverse()) { if (s.datos[q] < 0) racha++; else break; }
  const nv = nivel(v, U.ipi_interanual_alta, U.actividad_interanual_media);
  if (nv) add({ nivel: nv, tema: "Producción", ambito: "Nacional", variable: n, periodo: p, valor: v, titulo: `${n}: ${fmt(v)}% interanual`, detalle: racha > 1 ? `${racha} meses relevados seguidos en baja.` : "", fuente });
}
if (S["caa-acero-crudo"]) { const s = S["caa-acero-crudo"]; const p = ultimos(s).at(-1); const v = ia(s, p);
  if (v != null && v <= U.ipi_interanual_media) add({ nivel: nivel(v, U.ipi_interanual_alta, U.ipi_interanual_media), tema: "Producción", ambito: "Nacional", variable: "Acero crudo", periodo: p, valor: +v.toFixed(1), titulo: `Acero crudo: ${fmt(v)}% interanual`, detalle: "", fuente: "Cámara Argentina del Acero" }); }

// 4. Empleo registrado por provincia y por rama (OEDE)
if (oede) {
  const T = oede.trimestres, n = T.length, UOM = ["27", "28", "29", "31", "32", "34p", "35"];
  for (const [k, ar] of Object.entries(oede.areas)) {
    let a = 0, b = 0; for (const g of UOM) { const t = ar.grupos[g]?.trim; if (t) { a += t[n - 1] || 0; b += t[n - 5] || 0; } }
    if (b < U.empleo_minimo_puestos) continue; const v = (a / b - 1) * 100; const nv = nivel(v, U.empleo_interanual_alta, U.empleo_interanual_media);
    if (nv) add({ nivel: nv, tema: "Empleo", ambito: k === "GBA" ? "Partidos del GBA" : k, variable: "Empleo metalúrgico registrado", periodo: T[n - 1], valor: +v.toFixed(1),
      titulo: `${ar.nombre || k}: el empleo metalúrgico cae ${abs(v)}% interanual`, detalle: `${(a - b).toLocaleString("es-AR")} puestos en un año (${a.toLocaleString("es-AR")} en ${T[n - 1].replace("T", " T")}).`, fuente: "OEDE–SIPA" });
  }
  for (const [k, r] of Object.entries(oede.ramas)) {
    if (r.grupo === "3410") continue; const a = r.trim[n - 1], b = r.trim[n - 5]; if (!b || b < U.empleo_minimo_puestos) continue;
    const v = (a / b - 1) * 100; const nv = nivel(v, U.empleo_rama_alta, U.empleo_interanual_alta);
    if (nv) add({ nivel: nv, tema: "Empleo", ambito: "Nacional", variable: `CIIU ${k}`, periodo: T[n - 1], valor: +v.toFixed(1),
      titulo: `${r.descripcion.length > 70 ? r.descripcion.slice(0, 68).replace(/[;,]?\s+\S*$/, "") + "…" : r.descripcion}: el empleo cae ${abs(v)}%`, detalle: `${(a - b).toLocaleString("es-AR")} puestos en un año (CIIU ${k}).`, fuente: "OEDE–SIPA" });
  }
}

// 5. Conflictividad por despidos: mes por encima del promedio de los 12 anteriores
if (conf) {
  const rows = conf.rows, u = rows.at(-1), prev = rows.slice(-13, -1).map(r => r[5] || 0); const prom = prev.reduce((x, y) => x + y, 0) / (prev.length || 1);
  if (u[5] > prom * U.conflicto_despidos_factor && u[5] >= 3) add({ nivel: "media", tema: "Conflictividad", ambito: "Nacional", variable: "Conflictos por despidos", periodo: u[0], valor: u[5],
    titulo: `${u[5]} conflictos con paro por despidos en ${u[0]}`, detalle: `El promedio de los 12 meses anteriores fue ${prom.toFixed(1).replace(".", ",")}.`, fuente: "Ministerio de Capital Humano" });
}

// 6. Hechos en plantas (despidos, suspensiones, cierres) recientes
for (const e of ev) {
  const dias = (hoy - new Date(e.fecha)) / 864e5; if (dias > U.dias_hecho_reciente) continue;
  const p = pl.find(x => x.id === e.plantaId) || {};
  add({ nivel: ["cierre", "despidos"].includes(e.tipo) ? "alta" : "media", tema: "Plantas", ambito: p.provincia || "", variable: e.tipo, periodo: e.fecha, valor: e.cantidad ?? null,
    titulo: `${p.nombre || e.plantaId}: ${e.tipo}${e.cantidad ? ` (${e.cantidad} trabajadores)` : ""}`, detalle: e.nota || "", fuente: e.fuente || "Relevamiento propio", url: e.url || null, planta: e.plantaId });
}

// 7. Importaciones (cuando estén conectadas)
for (const s of imp?.series || []) {
  const d = s.datos, u = d.at(-1), b = d.find(x => x.periodo === `${+u.periodo.slice(0, 4) - 1}${u.periodo.slice(4)}`); if (!b?.valor) continue;
  const v = (u.valor / b.valor - 1) * 100;
  if (v >= U.importaciones_suba_media) add({ nivel: v >= U.importaciones_suba_alta ? "alta" : "media", tema: "Importaciones", ambito: "Nacional", variable: s.nombre, periodo: u.periodo, valor: +v.toFixed(1), titulo: `Importaciones de ${s.nombre.toLowerCase()}: ${fmt(v)}% interanual`, detalle: "", fuente: "INDEC" });
}

// 8. Datos desactualizados
for (const [k, s] of Object.entries(S)) { const p = ultimos(s).at(-1); if (p && mesesAtras(p) > U.meses_sin_dato) add({ nivel: "info", tema: "Datos", ambito: "Nacional", variable: s.nombre, periodo: p, valor: null, titulo: `Sin dato nuevo de «${s.nombre}» desde ${p}`, detalle: "Revisar la fuente o cargarlo a mano.", fuente: "MIDTM" }); }

const orden = { alta: 0, media: 1, info: 2 };
const tema = { Plantas: 0, "Producción": 1, "Capacidad instalada": 2, Importaciones: 3, Conflictividad: 4, Empleo: 5, Datos: 6 };
A.sort((a, b) => orden[a.nivel] - orden[b.nivel] || tema[a.tema] - tema[b.tema] || (a.valor ?? 0) - (b.valor ?? 0));
await writeFile(new URL("../data/alertas.json", import.meta.url), JSON.stringify({ actualizado: hoy.toISOString().slice(0, 10), total: A.length, alta: A.filter(a => a.nivel === "alta").length, media: A.filter(a => a.nivel === "media").length, alertas: A }, null, 1));
console.log(`Listo: ${A.length} alertas (${A.filter(a => a.nivel === "alta").length} altas).`);
