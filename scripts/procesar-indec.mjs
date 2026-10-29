// Procesa los Excel del INDEC que baja el robot (data/fuentes/indec-*) y arma data/indec-series.json:
// capacidad instalada por bloque (2016→), IPI manufacturero por rama metalúrgica (2016→) y venta de maquinaria agrícola nacional vs importada.
// Uso: node scripts/procesar-indec.mjs   (requiere: npm install --no-save xlsx@0.18.5)
import { readdir, writeFile } from "node:fs/promises";
import XLSX from "xlsx";
const R = new URL("../data/", import.meta.url);
const MES = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };
const archivo = async (dir, pat) => { const fs = (await readdir(new URL(`fuentes/${dir}/`, R))).filter(f => pat.test(f)).sort(); return fs.length ? new URL(`fuentes/${dir}/${fs.at(-1)}`, R).pathname : null; };
const filas = (f, hoja) => { const wb = XLSX.readFile(f); const sh = typeof hoja === "number" ? wb.Sheets[wb.SheetNames[hoja]] : wb.Sheets[hoja]; return XLSX.utils.sheet_to_json(sh, { header: 1, defval: "" }); };
const num = v => { const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", ".")); return isFinite(n) ? +n.toFixed(2) : null; };
const series = [];
const serie = (clave, nombre, unidad, datos, extra = {}) => series.push({ clave, nombre, unidad, organismo: "INDEC", origen: "Excel oficial del INDEC (robot)", ...extra, datos });

// 1) Capacidad instalada por bloque
const fc = await archivo("indec-capacidad", /^sh_capacidad.*\.xls/);
if (fc) {
  const F = filas(fc, 0); const cab = F.find(r => String(r[0]).startsWith("Período")).map(c => String(c).replace(/\s+/g, " ").trim().toLowerCase());
  const col = t => cab.findIndex(c => c.startsWith(t));
  const C = { "uci-general": [col("nivel general"), "INDEC · Capacidad usada, nivel general"], "uci-metalicas": [col("industrias metálicas"), "INDEC · Capacidad usada, metálicas básicas"], "uci-automotriz": [col("industria automotriz"), "INDEC · Capacidad usada, automotriz"], "uci-metalmecanica": [col("metalmecánica"), "INDEC · Capacidad usada, metalmecánica sin automotriz"] };
  let anio = null; const D = Object.fromEntries(Object.keys(C).map(k => [k, []]));
  for (const r of F) { const a = String(r[0]).match(/Año (\d{4})/); if (a) { anio = +a[1]; continue; } const m = MES[String(r[0]).replace(/\*/g, "").trim().toLowerCase()]; if (!anio || !m) continue;
    for (const [k, [i]] of Object.entries(C)) { const v = num(r[i]); if (i >= 0 && v != null) D[k].push({ periodo: `${anio}-${String(m).padStart(2, "0")}`, valor: v }); } }
  for (const [k, [, n]] of Object.entries(C)) if (D[k].length) serie(k, n, "%", D[k], { url: "https://www.indec.gob.ar/indec/web/Nivel4-Tema-3-6-15" });
}
// 2) IPI manufacturero, serie original por rama (Cuadro 2, base 2004=100)
const fi = await archivo("indec-ipi", /^sh_ipi_manufacturero.*\.xls/);
if (fi) {
  const F = filas(fi, "Cuadro 2"); const cod = F[2].map(c => String(c).replace(/\.0$/, "")), nom = F[3];
  const RAMAS = { "27": "metalicas-basicas", "27100": "siderurgia", "27201/9": "aluminio", "27310/20": "fundicion", "28": "productos-metal", "28110": "estructuras-metalicas", "28991": "envases-metalicos", "29": "maquinaria-equipo", "29211/2/3": "maquinaria-agropecuaria", "29300": "linea-blanca", "31100/200/300/400/500/900": "electricos", "34": "automotriz-y-autopartes", "34200": "carrocerias-remolques", "34300": "autopartes", "35910": "motocicletas", "29110/20/30/40/50/90": "maquinaria-uso-general" };
  let anio = null; const D = {};
  for (const r of F.slice(4)) { if (num(r[1])) anio = num(r[1]); const m = MES[String(r[2]).replace(/\*/g, "").trim().toLowerCase()]; if (!anio || !m) continue;
    cod.forEach((c, i) => { const k = RAMAS[c]; const v = num(r[i]); if (k && v != null) (D[k] ??= []).push({ periodo: `${anio}-${String(m).padStart(2, "0")}`, valor: v }); }); }
  for (const [c, k] of Object.entries(RAMAS)) { const i = cod.indexOf(c); if (D[k]) serie(`ipi-${k}`, `INDEC · IPI ${String(nom[i]).trim()}`, "índice 2004=100", D[k], { url: "https://www.indec.gob.ar/indec/web/Nivel4-Tema-3-6-14" }); }
}
// 3) Maquinaria agrícola: unidades vendidas nacionales e importadas (trimestral)
const fm = await archivo("indec-maqagricola", /maquinaria_agricola.*\.xls/);
if (fm) {
  for (const [hoja, k, n] of [["Cuadro 2", "cosechadoras", "cosechadoras"], ["Cuadro 3.1", "tractores", "tractores"], ["Cuadro 5", "implementos", "implementos"]]) {
    try { const F = filas(fm, hoja); let anio = null; const nac = [], imp = [];
      for (const r of F) { const a = num(r[0]); if (a && a > 2000 && a < 2100 && String(r[1]) === "") { anio = a; continue; } const t = String(r[0]).match(/(\d)°\s*trim/); if (!anio || !t) continue;
        const p = `${anio}-T${t[1]}`; if (num(r[2]) != null) nac.push({ periodo: p, valor: num(r[2]) }); if (num(r[3]) != null) imp.push({ periodo: p, valor: num(r[3]) }); }
      if (nac.length) { serie(`maqagro-${k}-nacionales`, `INDEC · Venta de ${n} nacionales (unidades)`, "unidades", nac); serie(`maqagro-${k}-importadas`, `INDEC · Venta de ${n} importadas (unidades)`, "unidades", imp); }
    } catch (e) { console.warn(hoja, e.message); }
  }
}
await writeFile(new URL("indec-series.json", R), JSON.stringify({ actualizado: new Date().toISOString().slice(0, 10), fuente: "INDEC, cuadros estadísticos (Excel)", series }, null, 0));
console.log(`Listo: ${series.length} series. ` + series.map(s => `${s.clave}:${s.datos.length}(${s.datos[0]?.periodo}→${s.datos.at(-1)?.periodo})`).join(" "));
