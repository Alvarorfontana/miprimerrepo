// Supervisor: revisa que cada gestor haya actualizado sus datos a tiempo. Si alguno se atrasó, abre un issue.
import { readFile } from "node:fs/promises";
const MAX = { "boletin-oficial.json": 5, "prensa-pendientes.json": 3, "semaforo.json": 3, "bcra-empresas.json": 35, "energia.json": 35,
  "indicadores-auto.json": 20, "establecimientos.json": 20, "empleo-oede.json": 20, "acero-caa.json": 20 };
const atrasados = [];
for (const [f, dias] of Object.entries(MAX)) {
  let act = null; try { act = JSON.parse(await readFile(`data/${f}`, "utf8")).actualizado; } catch {}
  const edad = act ? (Date.now() - new Date(act)) / 864e5 : Infinity;
  if (edad > dias) atrasados.push(`- \`${f}\`: ${act ? `última actualización ${act} (${Math.floor(edad)} días)` : "sin datos"}; se esperaba cada ${dias} días o menos.`);
}
console.log(atrasados.length ? atrasados.join("\n") : "Todos los gestores al día.");
const TOKEN = process.env.GITHUB_TOKEN, REPO = process.env.GITHUB_REPOSITORY;
if (atrasados.length && TOKEN && REPO) {
  const ya = await (await fetch(`https://api.github.com/repos/${REPO}/issues?labels=supervisor&state=open`, { headers: { Authorization: `Bearer ${TOKEN}` } })).json();
  if (!ya.length) await fetch(`https://api.github.com/repos/${REPO}/issues`, { method: "POST", headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/vnd.github+json" },
    body: JSON.stringify({ title: "Supervisor: hay gestores atrasados", labels: ["supervisor"], body: `Estos datos no se actualizaron a tiempo. Puede que el sitio de origen haya cambiado.\n\n${atrasados.join("\n")}` }) });
}
