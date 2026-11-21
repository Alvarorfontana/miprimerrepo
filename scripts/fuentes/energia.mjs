// Energía como señal de actividad: consumo eléctrico industrial por rama (CAMMESA vía CEP XXI, datos.gob.ar)
// y gas a grandes usuarios industriales (ENARGAS). Guarda series en data/energia.json y lo que encuentra en
// data/fuentes/energia/sondeo.json para revisar. Corre en GitHub Actions.
import { mkdir, readFile, writeFile } from "node:fs/promises";
const CAB = { "User-Agent": "Mozilla/5.0 (observatorio MIDTM)" };
await mkdir("data/fuentes/energia", { recursive: true });
const sondeo = { fecha: new Date().toISOString() };
async function get(url, bin = false) {
  try {
    const r = await fetch(url, { headers: CAB, signal: AbortSignal.timeout(90000) });
    if (!r.ok) return { status: r.status };
    return { status: r.status, body: bin ? Buffer.from(await r.arrayBuffer()) : await r.text(), tipo: r.headers.get("content-type") };
  } catch (e) { return { error: e.message }; }
}
const ckan = async id => { const r = await get(`https://datos.gob.ar/api/3/action/package_show?id=${id}`); try { return JSON.parse(r.body).result; } catch { return { error: r.error || r.status }; } };

// --- 1) electricidad por rama ---
const series = [];
const pk = await ckan("produccion-consumo-electrico-por-sectores-manufactureros");
sondeo.electricidad = { metadata_modified: pk.metadata_modified, recursos: (pk.resources || []).map(r => ({ nombre: r.name, url: r.url, modificado: r.last_modified || r.metadata_modified })) };
const orig = (pk.resources || []).find(r => /original/i.test(r.name)) || (pk.resources || [])[0];
if (orig) {
  const r = await get(orig.url);
  if (r.body) {
    await writeFile("data/fuentes/energia/electricidad-sectores.csv", r.body);
    const filas = r.body.trim().split(/\r?\n/).map(l => l.split(","));
    const cab = filas[0].map(c => c.replace(/"/g, "").trim());
    sondeo.electricidad.columnas = cab; sondeo.electricidad.ultimaFila = filas.at(-1);
    const iF = cab.findIndex(c => /fecha|indice_tiempo|periodo|mes/i.test(c));
    // ramas metalúrgicas: metales básicos, productos de metal, maquinaria, automotriz; y el total
    cab.forEach((c, i) => {
      if (i === iF || !/metal|maquin|autom|vehic|total|equipo/i.test(c)) return;
      series.push({ clave: `elec-${c.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, nombre: `Consumo eléctrico industrial · ${c}`, unidad: "MWh", organismo: "CAMMESA / CEP XXI",
        datos: filas.slice(1).map(f => ({ periodo: (f[iF] || "").replace(/"/g, "").slice(0, 7), valor: +f[i] })).filter(d => /^\d{4}-\d{2}$/.test(d.periodo) && !isNaN(d.valor)) });
    });
  } else sondeo.electricidad.descarga = r;
}

// --- 2) gas a la industria (ENARGAS) ---
const gk = await ckan("energia-datos-operativos-gas-natural");
sondeo.gas = { metadata_modified: gk.metadata_modified, recursos: (gk.resources || []).map(r => ({ nombre: r.name, url: r.url })) };
const paginasGas = [...new Set([...(gk.resources || []).map(r => r.url), "https://www.enargas.gob.ar/secciones/transporte-y-distribucion/datos-operativos.php"])];
sondeo.gas.paginas = {};
for (const p of paginasGas) {
  const r = await get(p);
  if (!r.body) { sondeo.gas.paginas[p] = r; continue; }
  const hrefs = [...r.body.matchAll(/href=["']([^"']+)["']/gi)].map(m => { try { return new URL(m[1], p).href; } catch { return null; } }).filter(Boolean);
  sondeo.gas.paginas[p] = { status: r.status, archivos: [...new Set(hrefs.filter(h => /\.(xlsx?|csv|zip)(\?|$)/i.test(h)))].slice(0, 80),
    subpaginas: [...new Set(hrefs.filter(h => /datos-operativos/i.test(h)))].slice(0, 80) };
}
// baja los archivos que hablan de industria o de gas entregado por tipo de usuario
const cand = [...new Set(Object.values(sondeo.gas.paginas).flatMap(x => x.archivos || []))].filter(h => /indust|entregado|usuario|consumo/i.test(decodeURIComponent(h)));
sondeo.gas.bajados = [];
for (const u of cand.slice(0, 10)) {
  const r = await get(u, true);
  if (!r.body) continue;
  const n = decodeURIComponent(u.split("/").pop().split("?")[0]).replace(/[^\w.\-]+/g, "_");
  await writeFile(`data/fuentes/energia/${n}`, r.body); sondeo.gas.bajados.push(n);
}

await writeFile("data/fuentes/energia/sondeo.json", JSON.stringify(sondeo, null, 1) + "\n");
const prev = JSON.parse(await readFile("data/energia.json", "utf8").catch(() => "{}"));
await writeFile("data/energia.json", JSON.stringify({ ...prev, actualizado: new Date().toISOString().slice(0, 10), fuente: "CAMMESA vía CEP XXI (datos.gob.ar); ENARGAS", series: series.length ? series : prev.series || [] }, null, 1) + "\n");
console.log("electricidad:", series.length, "series; última:", series[0]?.datos.at(-1)); console.log("gas: archivos bajados", sondeo.gas.bajados);
