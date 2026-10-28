// Trae series del INDEC desde la API de Series de Tiempo de datos.gob.ar
// y las guarda en data/indicadores-auto.json.
// Si una serie tiene "id", se usa ese. Si no, se busca por texto y se anota el id encontrado
// para que puedas fijarlo en scripts/series.json después de revisarlo.
// Uso: node scripts/actualizar-indicadores.mjs
import { readFile, writeFile } from "node:fs/promises";

const API = "https://apis.datos.gob.ar/series/api";
const conf = JSON.parse(await readFile(new URL("./series.json", import.meta.url), "utf8"));

const pedir = async (url) => {
  const r = await fetch(url, { headers: { "User-Agent": "observatorio-uom" } });
  if (!r.ok) throw new Error(`HTTP ${r.status} en ${url}`);
  return r.json();
};

const salida = [];
for (const s of conf.series) {
  try {
    let id = s.id, titulo = s.nombre;
    if (!id) {
      const q = encodeURIComponent(s.busqueda);
      const res = await pedir(`${API}/search/?q=${q}&limit=25`);
      const lista = res.data || [];
      const ok = lista.find(x => {
        const t = `${x.field?.title || ""} ${x.field?.description || ""}`.toLowerCase();
        return (s.debeIncluir || []).every(p => t.includes(p.toLowerCase()));
      });
      if (!ok) { console.warn(`Sin coincidencia para "${s.nombre}"`); continue; }
      id = ok.field.id; titulo = ok.field.description || ok.field.title;
      console.log(`"${s.nombre}" → ${id} (${titulo})`);
    }
    const datos = await pedir(`${API}/series/?ids=${encodeURIComponent(id)}&last=${s.ultimos || 36}&format=json`);
    const filas = (datos.data || []).filter(f => f[1] != null).map(f => ({ periodo: String(f[0]).slice(0, 7), valor: +(+f[1]).toFixed(2) }));
    salida.push({
      clave: s.clave, nombre: s.nombre, unidad: s.unidad, organismo: s.organismo,
      origen: "API Series de Tiempo · datos.gob.ar", idSerie: id, descripcionOficial: titulo,
      url: `${API}/series/?ids=${id}&format=csv`, datos: filas
    });
  } catch (e) { console.warn(`Error en "${s.nombre}":`, e.message); }
}

await writeFile(new URL("../data/indicadores-auto.json", import.meta.url),
  JSON.stringify({ actualizado: new Date().toISOString().slice(0, 10), series: salida }, null, 1));
console.log(`Listo: ${salida.length} series actualizadas.`);
