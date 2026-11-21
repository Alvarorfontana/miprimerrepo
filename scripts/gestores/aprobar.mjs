// Pasa a data/eventos.json el hecho de un issue que Álvaro etiquetó "aprobado". Lo llama el workflow al etiquetar.
import { readFile, writeFile } from "node:fs/promises";
const body = process.env.ISSUE_BODY || "";
const m = body.match(/<!-- hecho ([\s\S]*?) -->/);
if (!m) { console.log("El issue no trae un hecho."); process.exit(0); }
const h = JSON.parse(m[1]);
if (!h.plantaId) { console.log("Empresa no seguida: hay que sumarla a plantas.json antes de aprobar."); process.exit(1); }
const ev = JSON.parse(await readFile("data/eventos.json", "utf8"));
if (!ev.eventos.some(e => e.id === h.id || e.url === h.url)) {
  ev.eventos.push({ id: h.id, plantaId: h.plantaId, tipo: h.tipo, fecha: h.fecha, cantidad: h.cantidad, fuente: h.fuente, url: h.url, nota: h.titulo });
  ev.eventos.sort((a, b) => b.fecha.localeCompare(a.fecha)); ev.actualizado = new Date().toISOString().slice(0, 10);
  await writeFile("data/eventos.json", JSON.stringify(ev, null, 1) + "\n");
}
const pend = JSON.parse(await readFile("data/prensa-pendientes.json", "utf8"));
for (const p of pend.pendientes) if (p.id === h.id) p.estado = "aprobado";
await writeFile("data/prensa-pendientes.json", JSON.stringify(pend, null, 1) + "\n");
console.log("Aprobado:", h.titulo);
