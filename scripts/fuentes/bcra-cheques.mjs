// Central de Deudores del BCRA (API pública, sin clave): situación crediticia y cheques rechazados
// de las empresas seguidas, por CUIT. Lee data/cuits.json y guarda data/bcra-empresas.json. Corre en GitHub Actions.
import { readFile, writeFile } from "node:fs/promises";
const API = "https://api.bcra.gob.ar/CentralDeDeudores/v1.0/Deudas";
const leer = async (f, fb) => { try { return JSON.parse(await readFile(f, "utf8")); } catch { return fb; } };
const cuits = (await leer("data/cuits.json", { empresas: {} })).empresas;
async function get(url) {
  try {
    const r = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(40000) });
    if (r.status === 404) return { vacio: true };
    if (!r.ok) return { error: `HTTP ${r.status}` };
    return await r.json();
  } catch (e) { return { error: e.message }; }
}
const hace12 = new Date(); hace12.setFullYear(hace12.getFullYear() - 1);
const out = { actualizado: new Date().toISOString().slice(0, 10), fuente: "BCRA, Central de Deudores (API pública)", nota: "Situación 1 es normal; 2 a 6 indican atrasos crecientes. Cheques rechazados de los últimos 12 meses.", empresas: [] };
for (const [empresa, { cuit }] of Object.entries(cuits)) {
  const d = await get(`${API}/${cuit}`), ch = await get(`${API}/ChequesRechazados/${cuit}`);
  const r = { empresa, cuit };
  if (d.error) r.error = d.error;
  else if (!d.vacio) {
    const res = d.results || {}; r.denominacion = res.denominacion;
    const per = (res.periodos || [])[0];
    if (per) { r.periodo = per.periodo; r.situacionMax = Math.max(0, ...(per.entidades || []).map(e => +e.situacion || 0)); r.deudaMiles = (per.entidades || []).reduce((a, e) => a + (+e.monto || 0), 0); r.entidades = (per.entidades || []).length; }
  }
  if (ch.error) r.errorCheques = ch.error;
  else {
    const det = ((ch.results || {}).causales || []).flatMap(c => (c.entidades || []).flatMap(e => (e.detalle || []).map(x => ({ ...x, causal: c.causal }))));
    const rec = det.filter(x => x.fechaRechazo && new Date(x.fechaRechazo) >= hace12);
    r.cheques12m = rec.length; r.montoCheques12m = rec.reduce((a, x) => a + (+x.monto || 0), 0);
    r.chequesSinPagar = rec.filter(x => !x.fechaPago).length;
  }
  out.empresas.push(r); console.log(empresa, JSON.stringify(r));
  await new Promise(s => setTimeout(s, 800));
}
await writeFile("data/bcra-empresas.json", JSON.stringify(out, null, 1) + "\n");
