// Incorpora hechos de prensa a los datos del observatorio (las notas periodísticas son una fuente más).
// Una nota que retoma un hecho ya registrado se suma como "otra fuente" de ese hecho, no como uno nuevo.
import { readFile, writeFile } from "node:fs/promises";
const leer = async (f, fb) => { try { return JSON.parse(await readFile(f, "utf8")); } catch { return fb; } };
const dias = (a, b) => Math.abs(new Date(a) - new Date(b)) / 864e5;
export async function incorporar(nuevos) {
  const ev = await leer("data/eventos.json", { eventos: [] });
  const sector = await leer("data/hechos-sector.json", { hechos: [] });
  let nuevosEv = 0, nuevosSec = 0, repetidos = 0;
  for (const n of [...nuevos].sort((a, b) => a.fecha.localeCompare(b.fecha))) {
    const base = { fecha: n.fecha, tipo: n.tipo, cantidad: n.cantidad, fuente: n.fuente, url: n.url, nota: n.titulo.replace(/\s+-\s+[^-]+$/, ""), origen: "prensa", otras: n.otras || [] };
    const lista = n.plantaId ? ev.eventos.filter(e => e.plantaId === n.plantaId) : sector.hechos;
    // el mismo hecho: mismo tipo y (a 10 días, o misma cantidad en el año, o un cierre ya registrado)
    const tit = t => (t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+-\s+[^-]+$/, "").slice(0, 50);
    const previo = n.plantaId
      ? lista.find(e => e.url === n.url || (e.tipo === n.tipo && (dias(e.fecha, n.fecha) <= 10 || (n.cantidad && e.cantidad === n.cantidad && dias(e.fecha, n.fecha) <= 365) || n.tipo === "cierre")))
      : lista.find(e => e.url === n.url || tit(e.nota) === tit(n.titulo)); // resto del sector: sin planta, solo se junta la misma nota
    if (previo) { previo.otras = [...(previo.otras || []), { fuente: n.fuente, url: n.url, fecha: n.fecha }].slice(-12); repetidos++; continue; }
    if (n.plantaId) { ev.eventos.push({ id: n.id, plantaId: n.plantaId, ...base }); nuevosEv++; }
    else { sector.hechos.push({ id: n.id, ...base }); nuevosSec++; }
  }
  const hoy = new Date().toISOString().slice(0, 10);
  ev.eventos.sort((a, b) => b.fecha.localeCompare(a.fecha)); ev.actualizado = hoy;
  sector.hechos.sort((a, b) => b.fecha.localeCompare(a.fecha)); sector.actualizado = hoy;
  sector.nota = "Hechos del sector metalúrgico en empresas que todavía no están en el mapa de plantas, relevados de la prensa. Cada uno con su medio y su link.";
  await writeFile("data/eventos.json", JSON.stringify(ev, null, 1) + "\n");
  await writeFile("data/hechos-sector.json", JSON.stringify(sector, null, 1) + "\n");
  return { nuevosEv, nuevosSec, repetidos };
}
