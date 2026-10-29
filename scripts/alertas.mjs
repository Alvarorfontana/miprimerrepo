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
for (const f of ["acero-caa.json", "indec-series.json", "indicadores-auto.json", "indicadores.json"]) {
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
const PROV_DE = { "Partidos del GBA": "Buenos Aires", "Resto de Buenos Aires": "Buenos Aires", GBA: "Buenos Aires" };
const add = (a) => A.push({ fecha: hoy.toISOString().slice(0, 10), provincia: a.provincia || PROV_DE[a.ambito] || (a.ambito === "Nacional" ? null : a.ambito), ...a });
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

// 7. Importaciones (acumulado del año contra igual período del año anterior, para evitar el ruido mensual)
for (const s of imp?.series || []) {
  const u = s.datos.at(-1); if (!u) continue; const [y, m] = u.periodo.split("-").map(Number);
  const ac = yy => s.datos.filter(d => d.periodo.startsWith(yy + "-") && +d.periodo.slice(5) <= m).reduce((a, d) => a + d.valor, 0);
  const a1 = ac(y), a0 = ac(y - 1); if (!a0) continue; const v = (a1 / a0 - 1) * 100;
  if (v >= U.importaciones_suba_media) add({ nivel: v >= U.importaciones_suba_alta ? "alta" : "media", tema: "Importaciones", ambito: "Nacional", variable: s.nombre, periodo: u.periodo, valor: +v.toFixed(1),
    titulo: `Importaciones de ${s.nombre.replace(/\s*\(.*\)$/, "").toLowerCase()}: ${fmt(v)}% en lo que va del año`, detalle: `USD ${a1.toFixed(0)} millones entre enero y ${u.periodo.slice(5)}/${y}, contra USD ${a0.toFixed(0)} millones un año antes.`, fuente: "INDEC (comercio exterior)" });
}

// 8. Datos desactualizados
for (const [k, s] of Object.entries(S)) { const p = ultimos(s).at(-1); if (p && mesesAtras(p) > U.meses_sin_dato) add({ nivel: "info", tema: "Datos", ambito: "Nacional", variable: s.nombre, periodo: p, valor: null, titulo: `Sin dato nuevo de «${s.nombre}» desde ${p}`, detalle: "Revisar la fuente o cargarlo a mano.", fuente: "MIDTM" }); }


// 9. ÍNDICE PONDERADO DE RIESGO POR PROVINCIA (0 a 100)
// Combina señales normalizadas con los pesos de data/alertas-reglas.json → "indice".
const P = R.indice.pesos, N = R.indice.normalizacion;
const escala = (v, bueno, malo) => v == null ? null : Math.max(0, Math.min(100, (v - bueno) / (malo - bueno) * 100));
const IPI_GRUPO = { "27": ["auto-ipi-siderurgia", "auto-ipi-fundicion"], "28": ["auto-ipi-productos-metal"], "29": ["auto-ipi-maquinaria"], "31": ["auto-ipi-electricos"], "34p": ["auto-ipi-autopartes"] };
const iaGrupo = {};
for (const [g, ks] of Object.entries(IPI_GRUPO)) { const v = ks.map(k => S[k] && ia(S[k], ultimos(S[k]).at(-1))).filter(x => x != null); if (v.length) iaGrupo[g] = v.reduce((a, b) => a + b, 0) / v.length; }
const adimraProv = await leer("adimra-provincias.json", { datos: [] });
const ultAdimra = {}; for (const d of adimraProv.datos || []) if (!ultAdimra[d.provincia] || d.periodo > ultAdimra[d.provincia].periodo) ultAdimra[d.provincia] = d;
const INDICE = [];
if (oede) {
  const T = oede.trimestres, n = T.length, UOM = ["27", "28", "29", "31", "32", "34p", "35"], i4 = T.indexOf("2023T4");
  for (const [k, ar] of Object.entries(oede.areas)) {
    const prov = ar.provincia || k; const tot = T.map((_, i) => UOM.reduce((a, g) => a + (ar.grupos[g]?.trim[i] || 0), 0));
    if (tot[n - 5] < U.empleo_minimo_puestos) continue;
    const empIa = (tot[n - 1] / tot[n - 5] - 1) * 100, empAc = (tot[n - 1] / tot[i4] - 1) * 100;
    let racha = 0; for (let i = n - 1; i > 0 && tot[i] < tot[i - 1]; i--) racha++;
    // exposición: peso de cada rama en el empleo de la provincia × caída nacional de su producción
    let expo = 0; for (const g of UOM) { const sh = (ar.grupos[g]?.trim[n - 1] || 0) / (tot[n - 1] || 1); const v = iaGrupo[g]; if (v != null && v < 0) expo += sh * -v; }
    // hechos en planta (últimos N días): trabajadores afectados sobre empleo metalúrgico
    const plp = pl.filter(p => p.provincia === prov);
    const evs = ev.filter(e => (hoy - new Date(e.fecha)) / 864e5 <= R.indice.dias_hechos && plp.some(p => p.id === e.plantaId));
    const afect = evs.reduce((a, e) => a + (e.cantidad || 0) * ({ cierre: 1.5, despidos: 1, suspensiones: .5, retiros: .7 }[e.tipo] ?? .5), 0);
    const hechos = evs.some(e => e.tipo === "cierre") ? 100 : escala(afect / tot[n - 1] * 100, 0, N.hechos_pct_malo);
    const ad = ultAdimra[prov]; const adimraV = ad ? escala(ad.valor, N.adimra_bueno, N.adimra_malo) : null;
    const comp = {
      empleo_interanual: { valor: +empIa.toFixed(1), puntos: escala(empIa, N.empleo_ia_bueno, N.empleo_ia_malo) },
      empleo_acumulado: { valor: +empAc.toFixed(1), puntos: escala(empAc, N.empleo_ac_bueno, N.empleo_ac_malo) },
      tendencia: { valor: racha, puntos: escala(racha, 0, N.racha_mala) },
      exposicion_ramas: { valor: +expo.toFixed(1), puntos: escala(expo, 0, N.exposicion_mala) },
      hechos_planta: { valor: evs.length, puntos: evs.length ? hechos : 0 },
      actividad_adimra: { valor: ad ? ad.valor : null, puntos: adimraV }
    };
    let suma = 0, pesos = 0; for (const [c, o] of Object.entries(comp)) if (o.puntos != null) { suma += o.puntos * P[c]; pesos += P[c]; }
    const puntaje = Math.round(suma / pesos);
    const nv = puntaje >= R.indice.alta ? "alta" : puntaje >= R.indice.media ? "media" : "baja";
    const nombre = ar.nombre && k !== prov ? ar.nombre : k;
    INDICE.push({ area: nombre, provincia: prov, puntaje, nivel: nv, empleo: tot[n - 1], componentes: Object.fromEntries(Object.entries(comp).map(([c, o]) => [c, { ...o, puntos: o.puntos == null ? null : Math.round(o.puntos) }])) });
    if (nv !== "baja") {
      const top = Object.entries(comp).filter(([, o]) => o.puntos != null).sort((a, b) => b[1].puntos * P[b[0]] - a[1].puntos * P[a[0]]).slice(0, 2).map(([c]) => R.indice.nombres[c]);
      add({ nivel: nv, tema: "Índice de riesgo", ambito: nombre, provincia: prov, variable: "Índice ponderado", periodo: T[n - 1], valor: puntaje,
        titulo: `${nombre}: índice de riesgo ${puntaje}/100`, detalle: `Pesa sobre todo: ${top.join(" y ").toLowerCase()}.`, fuente: "MIDTM (ponderado)" });
    }
  }
  INDICE.sort((a, b) => b.puntaje - a.puntaje);

  // 10. Doble señal: la rama cae en producción y en empleo a la vez
  for (const [g, v] of Object.entries(iaGrupo)) {
    const a = UOM.includes(g) ? Object.values(oede.areas).reduce((x, ar) => x + (ar.grupos[g]?.trim[n - 1] || 0), 0) : 0;
    const b = Object.values(oede.areas).reduce((x, ar) => x + (ar.grupos[g]?.trim[n - 5] || 0), 0);
    const e = b ? (a / b - 1) * 100 : null;
    if (v < U.ipi_interanual_media && e != null && e < U.empleo_interanual_media) add({ nivel: "alta", tema: "Producción", ambito: "Nacional", variable: `Doble señal ${g}`, periodo: T[n - 1], valor: +v.toFixed(1),
      titulo: `${oede.grupos[g].split(" (")[0]}: cae la producción (${abs(v)}%) y el empleo (${abs(e)}%)`, detalle: "Doble señal: menos producción y menos puestos al mismo tiempo, el patrón que antecede a ajustes más profundos.", fuente: "INDEC + OEDE" });
  }
  // 11. Pérdida acumulada desde el cambio de ciclo (4T23) y caída generalizada en todas las ramas de un área
  for (const [k, ar] of Object.entries(oede.areas)) {
    const prov = ar.provincia || k; const tot = T.map((_, i) => UOM.reduce((a, g) => a + (ar.grupos[g]?.trim[i] || 0), 0)); if (tot[i4] < U.empleo_minimo_puestos) continue;
    const ac = (tot[n - 1] / tot[i4] - 1) * 100;
    if (ac <= U.empleo_acumulado_alta) add({ nivel: "alta", tema: "Empleo", ambito: ar.nombre && k !== prov ? ar.nombre : k, provincia: prov, variable: "Empleo acumulado", periodo: T[n - 1], valor: +ac.toFixed(1),
      titulo: `${ar.nombre && k !== prov ? ar.nombre : k}: perdió el ${abs(ac)}% del empleo metalúrgico desde fines de 2023`, detalle: `${(tot[n - 1] - tot[i4]).toLocaleString("es-AR")} puestos desde el 4.º trimestre de 2023.`, fuente: "OEDE–SIPA" });
    const gs = UOM.filter(g => (ar.grupos[g]?.trim[n - 5] || 0) >= 100); const caen = gs.filter(g => ar.grupos[g].trim[n - 1] < ar.grupos[g].trim[n - 5]);
    if (gs.length >= 3 && caen.length === gs.length) add({ nivel: "media", tema: "Empleo", ambito: ar.nombre && k !== prov ? ar.nombre : k, provincia: prov, variable: "Caída generalizada", periodo: T[n - 1], valor: caen.length,
      titulo: `${ar.nombre && k !== prov ? ar.nombre : k}: el empleo cae en todas sus ramas metalúrgicas`, detalle: `${caen.length} de ${gs.length} ramas con menos puestos que hace un año.`, fuente: "OEDE–SIPA" });
  }
}
// 12. ADIMRA por provincia
for (const [prov, d] of Object.entries(ultAdimra)) if (d.valor <= U.actividad_interanual_media) add({ nivel: d.valor <= U.ipi_interanual_media ? "alta" : "media", tema: "Producción", ambito: prov, provincia: prov, variable: "Actividad ADIMRA provincial", periodo: d.periodo, valor: d.valor, titulo: `${prov}: la actividad metalúrgica cae ${abs(d.valor)}% interanual`, detalle: "", fuente: "ADIMRA" });

const orden = { alta: 0, media: 1, info: 2 };
const tema = { Plantas: 0, "Índice de riesgo": 0.5, "Producción": 1, "Capacidad instalada": 2, Importaciones: 3, Conflictividad: 4, Empleo: 5, Datos: 6 };
A.sort((a, b) => orden[a.nivel] - orden[b.nivel] || tema[a.tema] - tema[b.tema] || (a.tema === "Índice de riesgo" ? b.valor - a.valor : (a.valor ?? 0) - (b.valor ?? 0)));
await writeFile(new URL("../data/alertas.json", import.meta.url), JSON.stringify({ actualizado: hoy.toISOString().slice(0, 10), total: A.length, alta: A.filter(a => a.nivel === "alta").length, media: A.filter(a => a.nivel === "media").length, alertas: A, indice: INDICE, pesos: R.indice.pesos, nombres: R.indice.nombres }, null, 1));
console.log(`Listo: ${A.length} alertas (${A.filter(a => a.nivel === "alta").length} altas).`);
