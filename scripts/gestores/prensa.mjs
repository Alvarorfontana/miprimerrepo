// Gestor 3 · Lector de prensa. Solo sector metalúrgico.
// Busca en Google Noticias (RSS gratis) el nombre de cada planta seguida junto a palabras de conflicto laboral,
// y búsquedas generales del sector (UOM, ASIMRA, metalúrgica). No carga nada directo: deja cada hecho
// en data/prensa-pendientes.json y abre un issue "a revisar" en GitHub. Álvaro lo aprueba poniéndole la etiqueta "aprobado".
import { readFile, writeFile } from "node:fs/promises";
const leer = async (f, fb) => { try { return JSON.parse(await readFile(f, "utf8")); } catch { return fb; } };
const norm = s => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const plantas = (await leer("data/plantas.json", { plantas: [] })).plantas;
const eventos = (await leer("data/eventos.json", { eventos: [] })).eventos;
const pend = await leer("data/prensa-pendientes.json", { pendientes: [] });
const yaVisto = new Set([...pend.pendientes.map(p => p.url), ...eventos.map(e => e.url)]);

const marca = p => p.nombre.split(" · ")[0].replace(/\s*\(.*\)/, "");
const palabras = p => norm(marca(p)).split(/\s+/).filter(w => w.length >= 4);
const nombra = (p, t) => palabras(p).some(w => norm(t).includes(w));
const CONFLICTO = "(despidos OR suspensiones OR cierre OR suspende OR despide OR toma OR paro OR retiros OR \"procedimiento preventivo de crisis\" OR concurso OR quiebra)";
const consultas = [
  ...plantas.map(p => ({ q: `"${marca(p)}" ${CONFLICTO}`, plantaId: p.id })),
  { q: `UOM metalúrgica ${CONFLICTO}` }, { q: `"Unión Obrera Metalúrgica" ${CONFLICTO}` }, { q: `ASIMRA supervisores metalúrgicos ${CONFLICTO}` },
  { q: `fábrica metalúrgica ${CONFLICTO}` }, { q: `autopartista ${CONFLICTO}` }, { q: `maquinaria agrícola fábrica ${CONFLICTO}` }, { q: `siderúrgica ${CONFLICTO}` },
];
// filtro de sector: la nota tiene que hablar de industria metalúrgica o de una planta seguida
const METAL = /metal[uú]rg|uom\b|asimra|sider[uú]rg|acer[ií]a|acero|autopart|maquinaria agr|fundici|tornill|metalmec|aluminio|forja|tubos?\b|electrodom|lavarropas|tractor/i;
const tipoDe = t => /quiebra|concurso preventivo/i.test(t) ? "conflicto" : /cierr|cerr[oó]/i.test(t) ? "cierre" : /despid|cesant|desvincul/i.test(t) ? "despidos"
  : /suspend|suspensi/i.test(t) ? "suspensiones" : /retiros/i.test(t) ? "retiros" : /reincorpor/i.test(t) ? "reincorporacion" : "conflicto";
const cantidadDe = t => { const m = t.match(/(\d{1,3}(?:\.\d{3})*|\d+)\s+(?:trabajadores|operarios|empleados|obreros|despidos|suspendidos|puestos)/i); return m ? +m[1].replace(/\./g, "") : null; };
const desde = new Date(); desde.setDate(desde.getDate() - +(process.env.DIAS || 7));

const nuevos = [];
for (const c of consultas) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(c.q + " when:" + (process.env.DIAS || 7) + "d")}&hl=es-419&gl=AR&ceid=AR:es-419`;
  let xml = ""; try { const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (observatorio MIDTM)" }, signal: AbortSignal.timeout(30000) }); xml = await r.text(); } catch (e) { console.log("error", c.q, e.message); continue; }
  for (const it of xml.split("<item>").slice(1)) {
    const g = tag => (it.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`)) || [])[1]?.replace(/<!\[CDATA\[|\]\]>/g, "").trim() || "";
    const titulo = g("title").replace(/&quot;/g, '"').replace(/&amp;/g, "&"), link = g("link"), fecha = new Date(g("pubDate")), medio = g("source");
    if (!link || yaVisto.has(link) || isNaN(fecha) || fecha < desde) continue;
    if (!METAL.test(titulo) && !c.plantaId) continue;
    // si no vino por una planta, ver si el título nombra alguna
    const planta = c.plantaId ? plantas.find(p => p.id === c.plantaId) : plantas.find(p => nombra(p, titulo));
    if (planta && !nombra(planta, titulo)) continue; // el título debe nombrar la empresa
    yaVisto.add(link);
    nuevos.push({ id: `prensa-${Buffer.from(link).toString("base64url").slice(-16)}`, estado: "a revisar", plantaId: planta?.id || null, empresaNueva: planta ? null : true,
      tipo: tipoDe(titulo), fecha: fecha.toISOString().slice(0, 10), cantidad: cantidadDe(titulo), fuente: medio || "Google Noticias", url: link, titulo });
  }
  await new Promise(r => setTimeout(r, 1200));
}
pend.pendientes.push(...nuevos); pend.actualizado = new Date().toISOString().slice(0, 10);
pend.nota = "Hechos del sector metalúrgico detectados en prensa. No cuentan en informes hasta que se aprueban.";
await writeFile("data/prensa-pendientes.json", JSON.stringify(pend, null, 1) + "\n");
console.log("nuevos a revisar:", nuevos.length);

// un issue por hecho, para aprobar con la etiqueta "aprobado"
const TOKEN = process.env.GITHUB_TOKEN, REPO = process.env.GITHUB_REPOSITORY;
if (TOKEN && REPO) for (const n of nuevos.slice(0, 25)) {
  const p = plantas.find(x => x.id === n.plantaId);
  const body = `**${n.titulo}**\n\n- Planta: ${p ? p.nombre : "⚠️ empresa no seguida todavía"}\n- Hecho: ${n.tipo}${n.cantidad ? ` · ${n.cantidad} trabajadores` : ""}\n- Fecha: ${n.fecha}\n- Fuente: [${n.fuente}](${n.url})\n\nPara cargarlo: poné la etiqueta **aprobado**. Para descartarlo: cerrá el issue.\n\n<!-- hecho ${JSON.stringify(n)} -->`;
  await fetch(`https://api.github.com/repos/${REPO}/issues`, { method: "POST", headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/vnd.github+json" },
    body: JSON.stringify({ title: `A revisar: ${n.tipo} · ${p ? p.nombre : n.fuente}`.slice(0, 120), body, labels: ["a revisar", "prensa"] }) }).catch(e => console.log("issue", e.message));
}
