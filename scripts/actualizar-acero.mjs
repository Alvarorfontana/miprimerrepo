// Cámara Argentina del Acero: lista sus informes mensuales (WordPress), baja los PDF, extrae el texto (pdftotext)
// y arma data/acero-caa.json con acero crudo, hierro primario y laminados por mes.
// Uso: node scripts/actualizar-acero.mjs   (requiere pdftotext, paquete poppler-utils)
import { writeFile, readFile, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
const UA = { "User-Agent": "observatorio-uom/1.0 (github.com/Alvarorfontana)" };
const dir = new URL("../data/fuentes/acero/", import.meta.url); await mkdir(dir, { recursive: true });
const MES = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };
let media = [];
for (let pg = 1; pg <= 6; pg++) {
  try { const r = await fetch(`https://www.acero.org.ar/wp-json/wp/v2/media?search=INFORME%20MENSUAL&per_page=100&page=${pg}&mime_type=application/pdf&orderby=date`, { headers: UA }); if (!r.ok) break; const j = await r.json(); if (!j.length) break; media.push(...j); } catch { break; }
}
console.log(`Informes encontrados: ${media.length}`);
let prev = {}; try { prev = JSON.parse(await readFile(new URL("../data/acero-caa.json", import.meta.url), "utf8")).meses || {}; } catch {}
const meses = { ...prev }, muestras = [];
const n = s => +String(s).replace(/\./g, "").replace(",", ".");
for (const m of media) {
  const url = m.source_url, nombre = url.split("/").pop();
  try {
    const buf = Buffer.from(await (await fetch(url, { headers: UA })).arrayBuffer()); const f = new URL(nombre, dir).pathname; await writeFile(f, buf);
    const t = execFileSync("pdftotext", ["-layout", f, "-"]).toString("utf8");
    // mes del dato: "producción de acero crudo de <mes> (de <año>)" o el título
    const mm = t.match(/(?:en|de|durante)\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)(?:\s+(?:de\s+)?(20\d\d))?/i);
    const anioPub = +(m.date || "").slice(0, 4);
    if (!mm) { muestras.push({ nombre, texto: t.slice(0, 800) }); continue; }
    const mes = MES[mm[1].toLowerCase()], anio = +(mm[2] || (mes > new Date(m.date).getMonth() + 1 ? anioPub - 1 : anioPub));
    const per = `${anio}-${String(mes).padStart(2, "0")}`;
    const busca = re => { const x = t.match(re); return x ? n(x[1]) : null; };
    const fila = {
      acero_crudo: busca(/acero crudo[^\d\n]{0,80}?([\d.]{3,9}(?:,\d)?)\s*(?:t|tn|toneladas)/i),
      hierro_primario: busca(/hierro primario[^\d\n]{0,80}?([\d.]{3,9}(?:,\d)?)\s*(?:t|tn|toneladas)/i),
      laminados_caliente: busca(/laminados en caliente[^\d\n]{0,80}?([\d.]{3,9}(?:,\d)?)\s*(?:t|tn|toneladas)/i),
      laminados_frio: busca(/laminados en fr[ií]o[^\d\n]{0,80}?([\d.]{3,9}(?:,\d)?)\s*(?:t|tn|toneladas)/i),
      fuente: url
    };
    if (fila.acero_crudo) meses[per] = fila; else muestras.push({ nombre, per, texto: t.slice(0, 1500) });
  } catch (e) { muestras.push({ nombre, error: e.message }); }
}
await writeFile(new URL("../data/acero-caa.json", import.meta.url), JSON.stringify({ actualizado: new Date().toISOString().slice(0, 10), fuente: "Cámara Argentina del Acero, informes mensuales", unidad: "toneladas", meses }, null, 1));
await writeFile(new URL("muestras.json", dir), JSON.stringify(muestras.slice(0, 12), null, 1));
console.log(`Listo: ${Object.keys(meses).length} meses. Sin leer: ${muestras.length}.`);
