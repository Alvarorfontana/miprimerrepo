// Sondea fuentes nuevas (comercio exterior, Cámara del Acero, ADIMRA) y deja lo que encuentra
// en data/fuentes/sondeo.json para decidir cómo conectarlas. No modifica datos del sitio.
import { writeFile, mkdir } from "node:fs/promises";
const UA = { "User-Agent": "observatorio-uom/1.0 (github.com/Alvarorfontana)" };
const res = { fecha: new Date().toISOString() };
const get = async (u, opt = {}) => { try { const r = await fetch(u, { headers: UA, ...opt }); const t = opt.method === "HEAD" ? "" : await r.text(); return { status: r.status, tipo: r.headers.get("content-type"), largo: r.headers.get("content-length") || t.length, texto: t }; } catch (e) { return { error: e.message }; } };

// 1) INDEC comex: buscar en el sitio y en sus scripts rutas de descarga masiva
const home = await get("https://comex.indec.gob.ar/");
res.comex_home = { status: home.status, error: home.error };
const scripts = [...(home.texto || "").matchAll(/src="([^"]+\.js)"/g)].map(m => new URL(m[1], "https://comex.indec.gob.ar/").href);
res.comex_scripts = scripts;
res.comex_rutas = [];
for (const s of scripts.slice(0, 8)) {
  const js = (await get(s)).texto || "";
  res.comex_rutas.push(...new Set(js.match(/["'`][^"'`\s]*(files|zips|api|download|descarga)[^"'`\s]*["'`]/gi) || []));
}
res.comex_rutas = [...new Set(res.comex_rutas)].slice(0, 120);
res.comex_pruebas = {};
for (const u of ["https://comex.indec.gob.ar/files/zips/impo_2026_M.zip", "https://comex.indec.gob.ar/files/zips/impo_2025_M.zip", "https://comex.indec.gob.ar/files/zips/imports_2025_M.zip", "https://comex.indec.gob.ar/files/zips/import_2025_M.zip"]) {
  const r = await get(u, { method: "HEAD" }); res.comex_pruebas[u] = r.error || `${r.status} ${r.tipo} ${r.largo}`;
}

// 2) Cámara Argentina del Acero y ADIMRA (WordPress): últimos PDF publicados
for (const [k, base, q] of [["acero", "https://www.acero.org.ar", "INFORME-MENSUAL"], ["adimra", "https://www.adimra.org.ar", "actividad"], ["adimra2", "https://adimra.org.ar", "informe"]]) {
  const r = await get(`${base}/wp-json/wp/v2/media?search=${encodeURIComponent(q)}&per_page=30&orderby=date&mime_type=application/pdf`);
  try { res[k] = JSON.parse(r.texto).map(m => ({ fecha: m.date, titulo: m.title?.rendered, url: m.source_url })); }
  catch { res[k] = { status: r.status, error: r.error, muestra: (r.texto || "").slice(0, 300) }; }
}
const ad = await get("https://www.adimra.org.ar/");
res.adimra_home_pdfs = [...new Set((ad.texto || "").match(/https?:[^"'\s]+\.pdf/gi) || [])].slice(0, 40);
res.adimra_home_links = [...new Set((ad.texto || "").match(/href="[^"]*(estudio|informe|coyuntura|actividad)[^"]*"/gi) || [])].slice(0, 40);

await mkdir(new URL("../data/fuentes/", import.meta.url), { recursive: true });
await writeFile(new URL("../data/fuentes/sondeo.json", import.meta.url), JSON.stringify(res, null, 1));
console.log(JSON.stringify(res, null, 1).slice(0, 4000));
