// Baja las planillas de cobertura de la Superintendencia de Riesgos del Trabajo (SRT):
// empleadores y trabajadores cubiertos por sector de actividad. Guarda los archivos sin tocar en data/fuentes/srt/
// y un listado de enlaces en data/fuentes/srt/enlaces.json. Corre en GitHub Actions.
import { mkdir, writeFile } from "node:fs/promises";
const CAB = { "User-Agent": "Mozilla/5.0 (observatorio)" };
const paginas = [
  "https://www.srt.gob.ar/estadisticas/cf_ultimos_datos.php",
  "https://www.srt.gob.ar/estadisticas/cf_serie_historica_up.php",
  "https://www.srt.gob.ar/estadisticas/cf_boletin_sector.php",
];
await mkdir("data/fuentes/srt", { recursive: true });
const enlaces = {};
for (const p of paginas) {
  try {
    const r = await fetch(p, { headers: CAB, signal: AbortSignal.timeout(60000) });
    const html = await r.text();
    await writeFile("data/fuentes/srt/pagina-" + p.split("/").pop().replace(".php", "") + ".html", html);
    const hrefs = [...html.matchAll(/href=["']([^"']+)["']/gi)].map(m => new URL(m[1], p).href);
    enlaces[p] = { status: r.status, archivos: [...new Set(hrefs.filter(h => /\.(xlsx?|csv|zip|pdf)(\?|$)/i.test(h)))], paginas: [...new Set(hrefs.filter(h => h.includes("/estadisticas/") && h.endsWith(".php")))] };
    console.log(p, r.status, enlaces[p].archivos.length, "archivos");
  } catch (e) { enlaces[p] = { error: e.message }; console.log(p, "error", e.message); }
}
await writeFile("data/fuentes/srt/enlaces.json", JSON.stringify(enlaces, null, 1));
const bajar = [...new Set(Object.values(enlaces).flatMap(e => e.archivos || []))].filter(h => /\.(xlsx?|csv|zip)(\?|$)/i.test(h));
for (const u of bajar.slice(0, 25)) {
  try {
    const r = await fetch(u, { headers: CAB, signal: AbortSignal.timeout(120000) });
    if (!r.ok) { console.log("no", r.status, u); continue; }
    const nombre = decodeURIComponent(u.split("/").pop().split("?")[0]).replace(/[^\w.\-]+/g, "_");
    await writeFile("data/fuentes/srt/" + nombre, Buffer.from(await r.arrayBuffer()));
    console.log("ok", nombre);
  } catch (e) { console.log("error", u, e.message); }
}
