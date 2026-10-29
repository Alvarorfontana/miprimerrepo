// Busca en OpenStreetMap fábricas y predios industriales metalúrgicos con nombre en Argentina
// y los guarda en data/osm-plantas.json como "plantas candidatas" para cruzar con el padrón UOM.
// Uso: node scripts/actualizar-osm.mjs
import { writeFile } from "node:fs/promises";

const SERVIDORES = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter", "https://overpass.private.coffee/api/interpreter"];
const CLAVES = "metal|acer[oí]a|sider|fundic|tubos|forja|autopart|matricer|Acindar|Ternium|Tenaris|Siderca|Aluar|Gerdau|Pauny|Metalfor|Agrometal|Whirlpool|Newsan|Mirgor|IMPSA|Sidersa|laminad|galvaniz|carrocer|acoplad|maquinaria agr";
const AREA = `area["ISO3166-1"="AR"][admin_level=2]->.a;`;
const PARTES = [
  `nwr["industrial"~"steel|metal|foundry|machine|automotive|machinery"](area.a);`,
  `nwr["man_made"="works"]["product"~"steel|metal|alumin|pipe|tube|machin|vehicle|auto",i](area.a);`,
  `nwr["man_made"="works"]["name"~"${CLAVES}",i](area.a);`,
  `nwr["landuse"="industrial"]["name"~"${CLAVES}",i](area.a);`,
  `nwr["building"="industrial"]["name"~"${CLAVES}",i](area.a);`
];
const espera = ms => new Promise(r => setTimeout(r, ms));

async function consultar(parte) {
  const q = `[out:json][timeout:240];${AREA}(${parte});out center tags;`;
  for (const url of SERVIDORES) {
    try {
      const r = await fetch(url, { method: "POST", body: new URLSearchParams({ data: q }),
        headers: { "User-Agent": "observatorio-uom/1.0 (github.com/Alvarorfontana)", "Accept": "application/json" } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      if (d.remark && /error|timed out|runtime/i.test(d.remark)) throw new Error(d.remark.slice(0, 120));
      console.log(`${url}: ${d.elements.length} elementos`);
      return { elementos: d.elements, url };
    } catch (e) { console.warn(`Falló ${url}: ${e.message}`); await espera(5000); }
  }
  return null;
}

const elementos = [], usados = new Set();
for (const parte of PARTES) {
  const r = await consultar(parte);
  if (r) { elementos.push(...r.elementos); usados.add(r.url); }
  await espera(3000);
}
if (!elementos.length) { console.log("Overpass no devolvió resultados; se mantiene el archivo anterior."); process.exit(0); }
const datos = { elements: elementos }, usado = [...usados].join(", ");

const vistos = new Set();
const plantas = datos.elements.map(e => {
  const t = e.tags || {}, c = e.center || { lat: e.lat, lon: e.lon };
  return { id: `osm-${e.type[0]}${e.id}`, nombre: t.name || t.operator || "", operador: t.operator || "",
    tipo: t.industrial || t.product || t.man_made || t.landuse || t.building || "",
    localidad: t["addr:city"] || "", lat: +c.lat.toFixed(5), lon: +c.lon.toFixed(5),
    url: `https://www.openstreetmap.org/${e.type}/${e.id}` };
}).filter(p => p.nombre && p.lat && !vistos.has(p.nombre.toLowerCase() + Math.round(p.lat * 100)) && vistos.add(p.nombre.toLowerCase() + Math.round(p.lat * 100)));

await writeFile(new URL("../data/osm-plantas.json", import.meta.url), JSON.stringify({
  actualizado: new Date().toISOString().slice(0, 10), fuente: "OpenStreetMap (ODbL), vía Overpass", servidor: usado,
  nota: "Candidatas detectadas por nombre o etiqueta industrial. Hay que confirmar cuáles son plantas metalúrgicas activas y si están representadas por la UOM.",
  plantas }, null, 1));
console.log(`Listo: ${plantas.length} plantas candidatas con nombre.`);
