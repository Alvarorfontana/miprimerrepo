// Descarga los archivos oficiales (Excel y CSV) de las páginas listadas en scripts/fuentes-descarga.json
// y los guarda sin modificar en data/fuentes/<clave>/, con un índice en data/fuentes/indice.json.
// Uso: node scripts/descargar-fuentes.mjs
import { readFile, writeFile, mkdir } from "node:fs/promises";

const MAX_MB = 60;
const conf = JSON.parse(await readFile(new URL("./fuentes-descarga.json", import.meta.url), "utf8"));
const base = new URL("../data/fuentes/", import.meta.url);
const indice = { actualizado: new Date().toISOString().slice(0, 10), fuentes: [] };

for (const f of conf.fuentes) {
  const reg = { clave: f.clave, nombre: f.nombre, pagina: f.pagina, archivos: [], errores: [] };
  try {
    const html = await (await fetch(f.pagina, { headers: { "User-Agent": "observatorio-uom" } })).text();
    const links = [...new Set([...html.matchAll(/href="([^"]+\.(?:xlsx|xls|csv|zip))"/gi)].map(m => new URL(m[1], f.pagina).href))]
      .filter(u => f.patrones.some(p => u.toLowerCase().includes(p.toLowerCase())));
    if (!links.length) reg.errores.push("No se encontraron archivos que coincidan en la página");
    await mkdir(new URL(`${f.clave}/`, base), { recursive: true });
    for (const u of links) {
      try {
        const r = await fetch(u, { headers: { "User-Agent": "observatorio-uom" } });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const buf = Buffer.from(await r.arrayBuffer());
        const mb = buf.length / 1e6;
        const nombre = decodeURIComponent(u.split("/").pop());
        if (mb > MAX_MB) { reg.errores.push(`${nombre}: ${mb.toFixed(1)} MB, supera el límite`); continue; }
        await writeFile(new URL(`${f.clave}/${nombre}`, base), buf);
        reg.archivos.push({ archivo: `data/fuentes/${f.clave}/${nombre}`, url: u, mb: +mb.toFixed(2) });
        console.log(`✓ ${f.clave}: ${nombre} (${mb.toFixed(1)} MB)`);
      } catch (e) { reg.errores.push(`${u}: ${e.message}`); }
    }
  } catch (e) { reg.errores.push(`Página: ${e.message}`); }
  indice.fuentes.push(reg);
}
await mkdir(base, { recursive: true });
await writeFile(new URL("indice.json", base), JSON.stringify(indice, null, 1));
console.log("Listo:", indice.fuentes.map(f => `${f.clave}=${f.archivos.length}`).join(" "));
