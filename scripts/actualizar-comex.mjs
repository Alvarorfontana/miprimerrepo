// INDEC, comercio exterior: baja las importaciones mensuales por posición NCM (comex.indec.gob.ar)
// y suma las de productos metalúrgicos que compiten con la producción local → data/importaciones.json
// Uso: node scripts/actualizar-comex.mjs   (requiere unzip)
import { writeFile, readFile, mkdir, readdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
const UA = { "User-Agent": "observatorio-uom/1.0" };
const dir = new URL("../data/fuentes/comex/", import.meta.url); await mkdir(dir, { recursive: true });
// grupos por capítulo o partida NCM (prefijos)
const GRUPOS = [
  ["siderurgia", "Hierro y acero (cap. 72)", ["72"]],
  ["manufacturas-acero", "Manufacturas de hierro y acero (cap. 73)", ["73"]],
  ["aluminio", "Aluminio y sus manufacturas (cap. 76)", ["76"]],
  ["herramientas", "Herramientas y cuchillería (cap. 82)", ["82"]],
  ["maquinaria-agricola", "Maquinaria agrícola (8432, 8433, 8701.9)", ["8432", "8433"]],
  ["linea-blanca", "Línea blanca (8418, 8450, 8516)", ["8418", "8450", "8516"]],
  ["autopartes", "Autopartes (8708)", ["8708"]],
  ["maquinaria-general", "Bombas, compresores, válvulas y máquinas herramienta (8413, 8414, 8481, 8456-8466)", ["8413", "8414", "8481", "8456", "8457", "8458", "8459", "8460", "8461", "8462", "8463", "8464", "8465", "8466"]],
  ["electricos", "Motores, transformadores, tableros y cables (8501-8504, 8535-8538, 8544)", ["8501", "8502", "8503", "8504", "8535", "8536", "8537", "8538", "8544"]]
];
const anio = new Date().getFullYear(), anios = [anio - 3, anio - 2, anio - 1, anio];
const res = {}, log = [];
for (const a of anios) {
  for (const nombre of [`imports_${a}_M.zip`]) {
    const z = new URL(nombre, dir).pathname;
    try {
      const r = await fetch(`https://comex.indec.gob.ar/files/zips/${nombre}`, { headers: UA }); if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await writeFile(z, Buffer.from(await r.arrayBuffer()));
      const sub = new URL(`${a}/`, dir).pathname; await mkdir(sub, { recursive: true }); execFileSync("unzip", ["-o", "-q", z, "-d", sub]);
      const fs = (await readdir(sub)).filter(f => /\.(csv|txt)$/i.test(f));
      for (const f of fs) {
        let t = (await readFile(sub + f)).toString("latin1"); const ls = t.split(/\r?\n/).filter(Boolean);
        const sep = [";", ",", "\t", "|"].sort((x, y) => ls[0].split(y).length - ls[0].split(x).length)[0];
        const cab = ls[0].split(sep).map(c => c.replace(/"/g, "").trim().toLowerCase());
        const ic = (...ns) => cab.findIndex(c => ns.some(n => c === n || c.includes(n)));
        const iN = ic("ncm", "posic"), iM = ic("mes", "month"), iA = ic("año", "anio", "year"), iV = ic("cif", "valor", "fob", "u$s", "usd"), iK = ic("pnet", "peso", "kg", "kilo");
        log.push({ archivo: `${a}/${f}`, filas: ls.length, cabecera: cab, columnas: { ncm: iN, mes: iM, anio: iA, valor: iV, kg: iK }, muestra: ls.slice(1, 3) });
        if (iN < 0 || iV < 0) continue;
        for (const l of ls.slice(1)) {
          const v = l.split(sep).map(x => x.replace(/"/g, "").trim()); const ncm = v[iN].replace(/\D/g, "");
          const g = GRUPOS.find(([, , ps]) => ps.some(p => ncm.startsWith(p))); if (!g) continue;
          const mes = iM >= 0 ? String(parseInt(v[iM])).padStart(2, "0") : "00"; const per = `${iA >= 0 ? v[iA] : a}-${mes}`;
          const val = +String(v[iV]).replace(/\./g, "").replace(",", ".") || +v[iV] || 0; const kg = iK >= 0 ? (+String(v[iK]).replace(/\./g, "").replace(",", ".") || 0) : 0;
          const k = `${g[0]}|${per}`; res[k] = res[k] || { v: 0, kg: 0 }; res[k].v += val; res[k].kg += kg;
        }
      }
    } catch (e) { log.push({ archivo: nombre, error: e.message }); }
  }
}
const series = GRUPOS.map(([k, nombre]) => ({ clave: `impo-${k}`, nombre, unidad: "millones de USD (CIF)", datos: Object.entries(res).filter(([kk]) => kk.startsWith(k + "|")).map(([kk, x]) => ({ periodo: kk.split("|")[1], valor: +(x.v / 1e6).toFixed(2), toneladas: +(x.kg / 1000).toFixed(0) })).sort((a, b) => a.periodo.localeCompare(b.periodo)) })).filter(s => s.datos.length);
await writeFile(new URL("diagnostico.json", dir), JSON.stringify(log, null, 1));
if (!series.length) { console.log("Sin series (ver data/fuentes/comex/diagnostico.json)"); process.exit(0); }
await writeFile(new URL("../data/importaciones.json", import.meta.url), JSON.stringify({ actualizado: new Date().toISOString().slice(0, 10), fuente: "INDEC, Sistema de consulta de comercio exterior de bienes (importaciones por NCM)", descripcion: "Importaciones de productos metalúrgicos que compiten con la producción local, en millones de dólares CIF por mes.", series }, null, 1));
console.log(`Listo: ${series.length} series. ` + series.map(s => `${s.clave}:${s.datos.length}`).join(" "));
