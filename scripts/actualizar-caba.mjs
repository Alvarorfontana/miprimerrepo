// Ciudad de Buenos Aires: baja las habilitaciones aprobadas por la AGC (BA Data), se queda con los rubros
// metalúrgicos y los guarda en data/caba-habilitaciones-metal.json. También guarda los CSV crudos en data/fuentes/caba/.
// Uso: node scripts/actualizar-caba.mjs
import { writeFile, mkdir } from "node:fs/promises";
const UA = { "User-Agent": "observatorio-uom/1.0" };
const BASE = "https://cdn.buenosaires.gob.ar/datosabiertos/datasets/agencia-gubernamental-de-control/habilitaciones-aprobadas/";
const ARCH = ["habilitaciones-aprobadas2026.csv", "habilitaciones-aprobadas2025.csv", "habilitaciones-aprobadas2024.csv", "habilitaciones-aprobadas2023.csv", "habilitaciones-aprobadas2022.csv", "habilitaciones-aprobadas2021.csv", "habilitaciones-aprobadas2020.csv", "habilitaciones-2019.csv", "habilitaciones-2015-a-2018.csv"];
const RUBRO_METAL = /metal|herrer|torner|fundici|matricer|soldad|forj|galvaniz|niquel|cromad|estampad|tornill|bulon|mecaniz|caldere|chapa|hierro|acero|alumin|bronce|cerrajer[ií]a de obra|carpinter[ií]a met|maquinaria|motor|autopart|repuesto.*fabric|resorte|cuchiller|herramient|electromec|transformador|bobin|tablero.*el[eé]ctr/i;
const EXCLUIR = /venta|comercio minorista|kiosco|reparaci[oó]n de (autos|automotores|calzado)|gomer|lavadero|restaurant|bar\b/i;

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
    const iR = col("rubro", "descrip", "actividad"), iD = col("direcc", "domicilio", "calle", "ubicac"), iB = col("barrio"), iC = col("comuna"), iF = col("fecha"), iS = col("superf", "m2"), iX = col("lat", "coord_y", "y"), iY = col("lon", "lng", "coord_x", "x"), iT = col("tipo", "trámite", "tramite");
    let n = 0;
    for (const l of ls.slice(1)) {
      const v = partir(l, sep); const rubro = iR >= 0 ? v[iR] : l;
      if (!RUBRO_METAL.test(rubro) || EXCLUIR.test(rubro)) continue; n++;
      out.push({ archivo: a, rubro: (rubro || "").trim(), direccion: iD >= 0 ? (v[iD] || "").trim() : "", barrio: iB >= 0 ? (v[iB] || "").trim() : "", comuna: iC >= 0 ? (v[iC] || "").trim() : "",
        fecha: iF >= 0 ? (v[iF] || "").trim() : "", superficie: iS >= 0 ? (v[iS] || "").trim() : "", tipo: iT >= 0 ? (v[iT] || "").trim() : "", lat: iX >= 0 ? +v[iX] || null : null, lon: iY >= 0 ? +v[iY] || null : null });
    }
    resumen.push({ archivo: a, filas: ls.length - 1, metalurgicas: n, columnas: cab });
    console.log(`✓ ${a}: ${ls.length - 1} habilitaciones, ${n} de rubros metalúrgicos. Columnas: ${cab.join(" | ")}`);
  } catch (e) { resumen.push({ archivo: a, error: e.message }); console.warn(`✗ ${a}: ${e.message}`); }
}
if (!out.length && !resumen.some(r => r.filas)) { console.log("Sin datos nuevos; se mantiene el archivo anterior."); process.exit(0); }
await writeFile(new URL("../data/caba-habilitaciones-metal.json", import.meta.url), JSON.stringify({
  actualizado: new Date().toISOString().slice(0, 10), fuente: "Agencia Gubernamental de Control (GCBA), Habilitaciones aprobadas · BA Data",
  url: "https://data.buenosaires.gob.ar/dataset/habilitaciones-aprobadas", nota: "Habilitaciones otorgadas en la Ciudad cuyo rubro corresponde a actividades metalúrgicas (filtro por palabras clave del rubro). No es un padrón completo: incluye solo los locales que tramitaron habilitación en cada año.",
  resumen, habilitaciones: out }, null, 0));
console.log(`Listo: ${out.length} habilitaciones metalúrgicas.`);
