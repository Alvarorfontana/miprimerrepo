// Ciudad de Buenos Aires: baja las habilitaciones aprobadas por la AGC (BA Data), se queda con los rubros
// metalúrgicos y los guarda en data/caba-habilitaciones-metal.json. También guarda los CSV crudos en data/fuentes/caba/.
// Uso: node scripts/actualizar-caba.mjs
import { writeFile, mkdir } from "node:fs/promises";
const UA = { "User-Agent": "observatorio-uom/1.0" };
const BASE = "https://cdn.buenosaires.gob.ar/datosabiertos/datasets/agencia-gubernamental-de-control/habilitaciones-aprobadas/";
// Los archivos 2025 en adelante son el padrón vigente, con razón social; se usa el más reciente que responda.
const ANIO = new Date().getFullYear();
const ARCH = [ANIO + 1, ANIO, ANIO - 1, ANIO - 2].map(y => `habilitaciones-aprobadas${y}.csv`);
// Solo fabricación y talleres (no comercio, depósito ni servicios)
const ACTIVIDAD = /^\s*(fab\.?|fabricaci[oó]n|elaboraci[oó]n|forjado|tratamiento y revestimiento de metales|fundici[oó]n|industrias? b[aá]sicas?|taller|herrer[ií]a|torner[ií]a|matricer[ií]a|soldadura|galvaniz|niquelad|cromad|estampad|mecanizad|caldere|armado|ensamble|construcci[oó]n de (maquinaria|carrocer|remolque|buques|embarcac))/i;
const RUBRO_METAL = /metal|hierro|acero|alumin|bronce|cobre|maquin|motor|herramient|cuchill|autopart|piezas.*veh|veh[ií]culo|carrocer|remolque|el[eé]ctric|electr[oó]n|transformador|generador|bomba|v[aá]lvula|grifo|horno|caldera|tanque|estructura|forj|fundic|tornill|bul[oó]n|resorte|cerradur|instrumento|aparato|equipo|cable|l[aá]mpara|ilumin|acumulador|bater[ií]a|herrer|torner|matric|soldad|galvan|niquel|cromad|estamp|mecaniz|envases met|muebles met|bicicleta|moto/i;
const EXCLUIR = /^\s*(com\.|comercio|venta|dep[oó]sito|deposito|mantenimiento|reparaci[oó]n|servicio|alquiler|estaci[oó]n|terminal|oficina|consignar|pero de|kiosco)|reparaci[oó]n|computador|inform[aá]tica|oficina, contabilidad|joya|bijou|relo|[oó]ptic|fotogr[aá]f|m[eé]dic|ortop|quir[uú]rg|instrumentos y aparatos para medir|control de procesos|textil|prendas|calzado|aliment|panader|bebida|papel|imprenta|editor|madera(?!.*metal)|pl[aá]stic(?!.*metal)|qu[ií]mic|farmac|cosm[eé]t/i;

function partir(l, sep) { const o = []; let c = "", q = false; for (let i = 0; i < l.length; i++) { const ch = l[i]; if (ch === '"') { if (q && l[i + 1] === '"') { c += '"'; i++; } else q = !q; } else if (ch === sep && !q) { o.push(c); c = ""; } else c += ch; } o.push(c); return o; }
await mkdir(new URL("../data/fuentes/caba/", import.meta.url), { recursive: true });
const out = [], resumen = [];
for (const a of ARCH) {
  try {
    const r = await fetch(BASE + a, { headers: UA }); if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const buf = Buffer.from(await r.arrayBuffer()); await writeFile(new URL(`../data/fuentes/caba/${a}`, import.meta.url), buf);
    let t = buf.toString("utf8"); if (t.includes("�")) t = buf.toString("latin1");
    const ls = t.split(/\r?\n/).filter(Boolean); const sep = (ls[0].match(/;/g) || []).length > (ls[0].match(/,/g) || []).length ? ";" : ",";
    const cab = partir(ls[0].replace(/^﻿/, ""), sep).map(c => c.trim().toLowerCase());
    const col = (...ns) => cab.findIndex(c => ns.some(n => c.includes(n)));
    const iR = [col("descripcionrubro", "descripcion_rubro"), col("rubro"), col("descrip", "actividad")].find(i => i >= 0) ?? -1, iRS = col("razon_social", "razón social", "razonsocial"), iSub = col("descripcionsubrubro"), iD = col("direcc", "domicilio", "calle", "ubicac"), iB = col("barrio"), iC = col("comuna"), iF = col("fecha"), iS = col("superf", "m2"), iX = col("lat", "coord_y", "y"), iY = col("lon", "lng", "coord_x", "x"), iT = col("tipo", "trámite", "tramite");
    let n = 0;
    for (const l of ls.slice(1)) {
      const v = partir(l, sep); const rubro = ((iR >= 0 ? v[iR] : l) || "") + (iSub >= 0 && v[iSub] ? " · " + v[iSub] : "");
      if (!ACTIVIDAD.test(rubro) || !RUBRO_METAL.test(rubro) || EXCLUIR.test(rubro)) continue; n++;
      out.push({ archivo: a, razon_social: iRS >= 0 ? (v[iRS] || "").trim() : "", rubro: rubro.trim(), direccion: iD >= 0 ? (v[iD] || "").trim() : "", barrio: iB >= 0 ? (v[iB] || "").trim() : "", comuna: iC >= 0 ? (v[iC] || "").trim() : "",
        fecha: iF >= 0 ? (v[iF] || "").trim() : "", superficie: iS >= 0 ? (v[iS] || "").trim() : "", tipo: iT >= 0 ? (v[iT] || "").trim() : "", lat: iX >= 0 ? +v[iX] || null : null, lon: iY >= 0 ? +v[iY] || null : null });
    }
    resumen.push({ archivo: a, filas: ls.length - 1, metalurgicas: n, columnas: cab });
    console.log(`✓ ${a}: ${ls.length - 1} habilitaciones, ${n} de rubros metalúrgicos. Columnas: ${cab.join(" | ")}`);
    if (iRS >= 0 && n) break; // con el padrón más reciente alcanza
  } catch (e) { resumen.push({ archivo: a, error: e.message }); console.warn(`✗ ${a}: ${e.message}`); }
}
// sacar repetidos (mismo nombre, domicilio y rubro), quedándose con el archivo más reciente
const vistos = new Map(); for (const h of out) { const k = `${h.razon_social}|${h.direccion}`.toLowerCase().replace(/\s+/g, " "); if (!vistos.has(k)) vistos.set(k, h); }
const unicas = [...vistos.values()];
// ubicar con el normalizador de direcciones de la Ciudad (USIG), con pausa para no saturarlo
let geo = 0;
const cache = new Map();
for (const h of unicas) {
  if (cache.has(h.direccion)) { Object.assign(h, cache.get(h.direccion)); continue; }
  if (h.lat || !h.direccion || geo > 4000) continue;
  try {
    const u = `https://servicios.usig.buenosaires.gob.ar/normalizar/?direccion=${encodeURIComponent(h.direccion + ", CABA")}&geocodificar=TRUE&srid=4326`;
    const j = await (await fetch(u, { headers: UA })).json(); const d = (j.direccionesNormalizadas || [])[0];
    if (d && d.coordenadas) { h.lat = +(+d.coordenadas.y).toFixed(5); h.lon = +(+d.coordenadas.x).toFixed(5); h.direccion_normalizada = d.direccion; geo++; cache.set(h.direccion, { lat: h.lat, lon: h.lon, direccion_normalizada: h.direccion_normalizada }); }
  } catch {}
  await new Promise(r => setTimeout(r, 120));
}
console.log(`Ubicadas en el mapa: ${geo} de ${unicas.length}.`);
out.length = 0; out.push(...unicas);
if (!out.length && !resumen.some(r => r.filas)) { console.log("Sin datos nuevos; se mantiene el archivo anterior."); process.exit(0); }
await writeFile(new URL("../data/caba-habilitaciones-metal.json", import.meta.url), JSON.stringify({
  actualizado: new Date().toISOString().slice(0, 10), fuente: "Agencia Gubernamental de Control (GCBA), Habilitaciones aprobadas · BA Data",
  url: "https://data.buenosaires.gob.ar/dataset/habilitaciones-aprobadas", nota: "Habilitaciones otorgadas en la Ciudad cuyo rubro corresponde a actividades metalúrgicas (filtro por palabras clave del rubro). No es un padrón completo: incluye solo los locales que tramitaron habilitación en cada año.",
  resumen, habilitaciones: out }, null, 0));
console.log(`Listo: ${out.length} habilitaciones metalúrgicas.`);
