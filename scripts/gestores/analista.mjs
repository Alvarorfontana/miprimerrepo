// Gestor 5 · Analista. Solo sector metalúrgico.
// Cruza, para cada planta seguida: hechos de los últimos 120 días (prensa aprobada y Boletín Oficial),
// suspensiones homologadas, concursos o quiebras en el Boletín Oficial, y situación en el Banco Central.
// Calcula un semáforo (verde, amarillo, rojo) con sus motivos y lo guarda en data/semaforo.json.
import { readFile, writeFile } from "node:fs/promises";
const leer = async (f, fb) => { try { return JSON.parse(await readFile(f, "utf8")); } catch { return fb; } };
const norm = s => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
const plantas = (await leer("data/plantas.json", { plantas: [] })).plantas;
const eventos = (await leer("data/eventos.json", { eventos: [] })).eventos;
const bo = await leer("data/boletin-oficial.json", { acuerdos: [], menciones: [] });
const bcra = (await leer("data/bcra-empresas.json", { empresas: [] })).empresas;
const hoy = new Date(), hace = d => { const x = new Date(hoy); x.setDate(x.getDate() - d); return x.toISOString().slice(0, 10); };

const PESO = { cierre: 60, despidos: 30, suspensiones: 20, retiros: 15, conflicto: 15, reincorporacion: -15 };
const salida = [];
for (const p of plantas) {
  const motivos = []; let puntos = 0;
  const ev = eventos.filter(e => e.plantaId === p.id && e.fecha >= hace(120));
  for (const e of ev) { puntos += PESO[e.tipo] || 10; motivos.push(`${e.fecha} · ${e.tipo}${e.cantidad ? ` (${e.cantidad})` : ""} · ${e.fuente}`); }
  const clave = norm(p.empresa || p.nombre).split(/[\s·]+/)[0];
  for (const m of bo.menciones.filter(m => m.fecha >= hace(365) && norm(p.nombre + " " + p.empresa).includes(m.clave) && m.tipo !== "societario")) { puntos += m.tipo === "quiebra" ? 60 : 35; motivos.push(`${m.fecha} · ${m.tipo} en el Boletín Oficial`); }
  const b = bcra.find(x => norm(x.empresa).split(" ")[0] === clave || norm(x.denominacion || "").includes(clave));
  if (b) {
    if (b.situacionMax >= 3) { puntos += 30; motivos.push(`Banco Central: situación ${b.situacionMax} (atrasos)`); }
    else if (b.situacionMax === 2) { puntos += 10; motivos.push("Banco Central: situación 2 (riesgo bajo)"); }
    if (b.chequesSinPagar > 0) { puntos += 25; motivos.push(`Banco Central: ${b.chequesSinPagar} cheques rechazados sin pagar en 12 meses`); }
  }
  const color = puntos >= 50 ? "rojo" : puntos >= 20 ? "amarillo" : "verde";
  salida.push({ plantaId: p.id, planta: p.nombre, provincia: p.provincia, rama: p.rama, puntos, color, motivos });
}
salida.sort((a, b) => b.puntos - a.puntos);
// resumen sectorial: acuerdos de suspensión UOM/ASIMRA homologados por mes (todas las empresas metalúrgicas)
const porMes = {}; for (const a of bo.acuerdos.filter(a => a.tipo === "suspensiones")) porMes[a.fecha.slice(0, 7)] = (porMes[a.fecha.slice(0, 7)] || 0) + 1;
await writeFile("data/semaforo.json", JSON.stringify({ actualizado: hoy.toISOString().slice(0, 10), sector: "metalúrgico",
  nota: "Rojo: 50 puntos o más. Amarillo: 20 a 49. Verde: menos de 20. Pesos: cierre 60, despidos 30, suspensiones 20, retiros y conflictos 15 (hechos de los últimos 120 días); quiebra 60 y concurso 35 en el Boletín Oficial; atrasos en el Banco Central 30, cheques sin pagar 25.",
  suspensionesHomologadasPorMes: porMes, plantas: salida }, null, 1) + "\n");
console.log(salida.filter(s => s.color !== "verde").map(s => `${s.color.toUpperCase()} ${s.planta}: ${s.motivos.join("; ")}`).join("\n") || "Todo en verde.");
