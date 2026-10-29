// Cámara Argentina del Acero: lista sus informes mensuales (WordPress), baja los PDF, extrae el texto (pdftotext)
// y arma data/acero-caa.json con acero crudo, hierro primario y laminados por mes.
// Uso: node scripts/actualizar-acero.mjs   (requiere pdftotext, paquete poppler-utils)
import { writeFile, readFile, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
const UA = { "User-Agent": "observatorio-uom/1.0 (github.com/Alvarorfontana)" };
const dir = new URL("../data/fuentes/acero/", import.meta.url); await mkdir(dir, { recursive: true });
const MES = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };
let media = []; const diag = [];
for (const q of ["INFORME-MENSUAL", "INFORME MENSUAL", "informe mensual"]) for (let pg = 1; pg <= 5; pg++) {
  try { const r = await fetch(`https://www.acero.org.ar/wp-json/wp/v2/media?search=${encodeURIComponent(q)}&per_page=50&page=${pg}`, { headers: UA }); diag.push(`${q} p${pg}: ${r.status}`); if (!r.ok) break; const j = await r.json(); if (!j.length) break; media.push(...j.filter(x => /\.pdf$/i.test(x.source_url || ""))); } catch (e) { diag.push(`${q}: ${e.message}`); break; }
}
media = [...new Map(media.map(m => [m.source_url, m])).values()];
console.log(`Informes encontrados: ${media.length}`);
let prev = {}; try { prev = JSON.parse(await readFile(new URL("../data/acero-caa.json", import.meta.url), "utf8")).meses || {}; } catch {}
const meses = { ...prev }, muestras = [];
const n = s => +String(s).replace(/\./g, "").replace(",", ".");
for (const m of media) {
  const url = m.source_url, nombre = url.split("/").pop();
  try {
    const buf = Buffer.from(await (await fetch(url, { headers: UA })).arrayBuffer()); const f = new URL(nombre, dir).pathname; await writeFile(f, buf);
    const t = execFileSync("pdftotext", ["-layout", f, "-"]).toString("utf8");
    // "Con un total de 366.700 toneladas, la producción de acero crudo tuvo una caída 2,9% en agosto respecto de julio"
    const ac = t.match(/total de\s+([\d.]+)\s+toneladas,?\s+la producci[oó]n de acero crudo[\s\S]{0,120}?\sen\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\s+respecto/i);
    if (!ac) { muestras.push({ nombre, texto: t.slice(0, 600) }); continue; }
    const mes = MES[ac[2].toLowerCase()], pub = new Date(m.date), anio = mes > pub.getMonth() + 1 ? pub.getFullYear() - 1 : pub.getFullYear();
    const per = `${anio}-${String(mes).padStart(2, "0")}`;
    const lam = t.match(/producci[oó]n de laminados[^\d]{0,60}?fue de\s+([\d.]+)\s+toneladas/i);
    const ia = t.match(/acero crudo[\s\S]{0,200}?(suba|incremento|crecimiento|ca[ií]da|baja)\s+(?:del\s+)?([\d,]+)%\s+comparado con el mismo mes/i);
    const fila = { acero_crudo: n(ac[1]), laminados: lam ? n(lam[1]) : null, var_interanual: ia ? (/(ca[ií]da|baja)/i.test(ia[1]) ? -1 : 1) * n(ia[2]) : null, fuente: url };
    if (fila.acero_crudo) meses[per] = fila; else muestras.push({ nombre, per, texto: t.slice(0, 1500) });
  } catch (e) { muestras.push({ nombre, error: e.message }); }
}
const ks = Object.keys(meses).sort();
const series = [
  { clave: "caa-acero-crudo", nombre: "CAA · Producción de acero crudo", unidad: "miles de t", organismo: "Cámara Argentina del Acero", url: "https://www.acero.org.ar", datos: ks.map(k => ({ periodo: k, valor: +(meses[k].acero_crudo / 1000).toFixed(1), url: meses[k].fuente })) },
  { clave: "caa-laminados", nombre: "CAA · Producción de laminados (planos y no planos)", unidad: "miles de t", organismo: "Cámara Argentina del Acero", url: "https://www.acero.org.ar", datos: ks.filter(k => meses[k].laminados).map(k => ({ periodo: k, valor: +(meses[k].laminados / 1000).toFixed(1), url: meses[k].fuente })) },
  { clave: "caa-acero-interanual", nombre: "CAA · Acero crudo, variación interanual", unidad: "%", organismo: "Cámara Argentina del Acero", url: "https://www.acero.org.ar", datos: ks.filter(k => meses[k].var_interanual != null).map(k => ({ periodo: k, valor: meses[k].var_interanual, url: meses[k].fuente })) }
].filter(x => x.datos.length);
await writeFile(new URL("../data/acero-caa.json", import.meta.url), JSON.stringify({ actualizado: new Date().toISOString().slice(0, 10), fuente: "Cámara Argentina del Acero, informes mensuales", unidad: "toneladas", meses, series }, null, 1));
await writeFile(new URL("muestras.json", dir), JSON.stringify({ diag, encontrados: media.length, muestras: muestras.slice(0, 8) }, null, 1));
console.log(`Listo: ${Object.keys(meses).length} meses. Sin leer: ${muestras.length}.`);
