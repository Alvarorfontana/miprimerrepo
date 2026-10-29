// OEDE, datos provinciales adicionales para las alertas:
//  - cantidad de empresas metalúrgicas por provincia (anual, desde 1996)
//  - remuneración mediana de las ramas metalúrgicas por provincia (mensual)
//  - empleo y salario de la industria manufacturera por partido o departamento (mensual, desde 2019)
// Salida: data/oede-extra.json   Uso: node scripts/procesar-oede-extra.mjs   (requiere xlsx@0.18.5)
import { readdir, readFile, writeFile } from "node:fs/promises";
import XLSX from "xlsx";
const D = new URL("../data/fuentes/oede-provincial/", import.meta.url);
const fs = await readdir(D); const f = p => fs.filter(x => x.startsWith(p)).sort().at(-1);
const metal = c => /^(27|28|29|31|32|35)/.test(c) || /^34[23]/.test(c);
const num = v => typeof v === "number" ? v : (v === "s.d." || v == null || v === "") ? null : +String(v).replace(",", ".");
const AREA = n => n.replace("Santa Fé", "Santa Fe").trim();
const out = { actualizado: new Date().toISOString().slice(0, 10), fuente: "OEDE, Ministerio de Capital Humano (SIPA)", empresas: {}, remuneraciones: {}, departamentos: {} };

// empresas
if (f("provinciales_serie_empresas3")) {
  const wb = XLSX.readFile(new URL(f("provinciales_serie_empresas3"), D).pathname);
  for (const h of wb.SheetNames.filter(x => !/car[aá]tula|indice|índice|metodolog/i.test(x))) {
    const F = XLSX.utils.sheet_to_json(wb.Sheets[h], { header: 1, defval: null }); const ih = F.findIndex(r => r && String(r[0]).trim() === "Ramas"); if (ih < 0) continue;
    const cols = F[ih].map((x, j) => [parseInt(x), j]).filter(([y, j]) => j >= 2 && y > 1990 && y < 2100); const anios = cols.map(c => c[0]); const tot = anios.map(() => 0), sd = anios.map(() => 0);
    for (const r of F.slice(ih + 1)) { const c = String(r[0] ?? "").trim(); if (!/^\d{3,4}$/.test(c) || !metal(c)) continue; cols.forEach(([, j], i) => { const v = num(r[j]); if (v == null) sd[i]++; else tot[i] += v; }); }
    out.empresas[AREA(h)] = { anios, total: tot, celdas_sd: sd };
  }
}
// remuneraciones (mediana de ramas metalúrgicas con dato)
if (f("provinciales_serie_remuneraciones_mensual_4dig")) {
  const wb = XLSX.readFile(new URL(f("provinciales_serie_remuneraciones_mensual_4dig"), D).pathname, { cellDates: true });
  for (const h of wb.SheetNames.filter(x => !/car[aá]tula|indice|índice|metodolog/i.test(x))) {
    const F = XLSX.utils.sheet_to_json(wb.Sheets[h], { header: 1, defval: null }); const ih = F.findIndex(r => r && String(r[1]).trim() === "Ramas"); if (ih < 0) continue;
    const meses = F[ih].slice(3).map(x => x instanceof Date ? x.toISOString().slice(0, 7) : null); const n = meses.findLastIndex(Boolean) + 1;
    const filas = F.slice(ih + 1).filter(r => /^\d{4}$/.test(String(r[1] ?? "").trim()) && metal(String(r[1]).trim()));
    const med = []; for (let i = 0; i < n; i++) { const v = filas.map(r => num(r[3 + i])).filter(x => x != null && x > 0).sort((a, b) => a - b); med.push(v.length >= 2 ? Math.round(v[Math.floor(v.length / 2)]) : null); }
    const k = med.findLastIndex(x => x != null); out.remuneraciones[AREA(h)] = { meses: meses.slice(Math.max(0, k - 36), k + 1), mediana: med.slice(Math.max(0, k - 36), k + 1), ramas: filas.length };
  }
}
// industria manufacturera por departamento
if (f("departamento_series_empleo_y_salarios_mensual_sector")) {
  const t = (await readFile(new URL(f("departamento_series_empleo_y_salarios_mensual_sector"), D))).toString("utf8").split(/\r?\n/);
  const cab = t[0].split(";"); const ix = n => cab.indexOf(n); const I = { prov: ix("Provincia"), dep: ix("Departamento"), sec: ix("Sector"), per: ix("Periodo"), emp: ix("Empleo"), sal: ix("Salario") };
  const m = {};
  for (const l of t.slice(1)) { const v = l.split(";"); if (v[I.sec] !== "Industria manufacturera") continue; const k = `${v[I.prov]}|${v[I.dep]}`; (m[k] ??= {})[v[I.per]] = [+v[I.emp] || 0, +String(v[I.sal]).replace(",", ".") || 0]; }
  for (const [k, s] of Object.entries(m)) { const ps = Object.keys(s).sort(), u = ps.at(-1), a = String(+u.slice(0, 4) - 1) + u.slice(4); if (!s[a]) continue;
    out.departamentos[k] = { periodo: `${u.slice(0, 4)}-${u.slice(4)}`, empleo: s[u][0], empleo_anterior: s[a][0], salario: Math.round(s[u][1]), salario_anterior: Math.round(s[a][1]) }; }
}
await writeFile(new URL("../data/oede-extra.json", import.meta.url), JSON.stringify(out));
console.log(`Listo: empresas ${Object.keys(out.empresas).length} áreas, remuneraciones ${Object.keys(out.remuneraciones).length}, departamentos ${Object.keys(out.departamentos).length}.`);
