// Boletín Oficial de la Nación: busca suspensiones y acuerdos homologados por Trabajo donde firma la UOM o ASIMRA
// (supervisores metalúrgicos), y menciones de las empresas seguidas en la segunda sección (sociedades, concursos, quiebras).
// Guarda data/boletin-oficial.json, suma hechos a data/eventos.json cuando la empresa es una planta seguida,
// y anota CUIT encontrados en data/cuits.json. Corre en GitHub Actions. Uso: DIAS=45 node scripts/fuentes/boletin-oficial.mjs
import { readFile, writeFile } from "node:fs/promises";

const BASE = "https://www.boletinoficial.gob.ar";
const CAB = { "User-Agent": "Mozilla/5.0 (observatorio MIDTM; datos publicos)" };
const DIAS = +(process.env.DIAS || 10);
const hoy = new Date();
const leer = async (f, fb) => { try { return JSON.parse(await readFile(f, "utf8")); } catch { return fb; } };
const guardar = (f, d) => writeFile(f, JSON.stringify(d, null, 1) + "\n");
const pausa = ms => new Promise(r => setTimeout(r, ms));
const texto = html => html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;/g, " ").replace(/&aacute;/g, "á").replace(/&eacute;/g, "é").replace(/&iacute;/g, "í").replace(/&oacute;/g, "ó")
  .replace(/&uacute;/g, "ú").replace(/&ntilde;/g, "ñ").replace(/&Ntilde;/g, "Ñ").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const norm = s => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
async function get(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: CAB, signal: AbortSignal.timeout(45000) });
      if (r.ok) return await r.text();
      if (r.status === 404) return null;
    } catch (e) { if (i === 2) console.log("error", url, e.message); }
    await pausa(2000 * (i + 1));
  }
  return null;
}
const ymd = d => d.toISOString().slice(0, 10).replace(/-/g, "");

const GREMIO = /UNI[OÓ]N OBRERA METAL[UÚ]RGICA|UOMRA|SUPERVISORES DE LA INDUSTRIA METALMEC[AÁ]NICA|ASIMRA/i;
const plantas = (await leer("data/plantas.json", { plantas: [] })).plantas;
// claves de búsqueda por empresa seguida: nombre comercial y razones sociales conocidas
const ALIAS = { ACINDAR: ["ACINDAR"], ARCELORMITTAL: ["ACINDAR"], TENARIS: ["SIDERCA", "SIAT", "TENARIS"], ALUAR: ["ALUAR"], GERDAU: ["GERDAU", "SIPAR"],
  IMPSA: ["IMPSA", "INDUSTRIAS METALURGICAS PESCARMONA"], WHIRLPOOL: ["WHIRLPOOL"], TERNIUM: ["TERNIUM"], PAUNY: ["PAUNY"], METALFOR: ["METALFOR"],
  AGROMETAL: ["AGROMETAL"], NEWSAN: ["NEWSAN"], MIRGOR: ["MIRGOR", "IATEC", "BRIGHTSTAR"], DANA: ["DANA ARGENTINA"] };
const clavesDe = p => { const k = norm(p.empresa || p.nombre).split(/[\s·]+/)[0]; return ALIAS[k] || [k]; };
const CLAVES = [...new Set(plantas.flatMap(clavesDe))].filter(k => k.length >= 4);
const plantaDe = (empresa, seccional) => {
  const e = norm(empresa); const cand = plantas.filter(p => clavesDe(p).some(k => e.includes(k)));
  if (!cand.length) return null;
  const s = norm(seccional); return cand.find(p => s && (norm(p.seccional).includes(s) || norm(p.localidad).includes(s))) || (cand.length === 1 ? cand[0] : null);
};

const bo = await leer("data/boletin-oficial.json", { acuerdos: [], menciones: [] });
const vistos = new Set([...bo.acuerdos, ...bo.menciones].map(x => x.url));
const ev = await leer("data/eventos.json", { eventos: [] });
const cuits = await leer("data/cuits.json", { nota: "CUIT de empresas seguidas, solo de fuentes públicas.", empresas: {} });
let nuevosAc = 0, nuevosMe = 0, nuevosEv = 0;

for (let k = 0; k < DIAS; k++) {
  const d = new Date(hoy); d.setDate(d.getDate() - k);
  if ([0, 6].includes(d.getDay())) continue;
  const f = ymd(d);
  // --- primera sección: acuerdos de Trabajo ---
  const html = await get(`${BASE}/seccion/primera/${f}`);
  if (html) {
    const links = [...html.matchAll(/href="([^"]*\/detalleAviso\/primera\/(\d+)\/(\d{8})[^"]*)"[^>]*>([\s\S]{0,600}?)<\/a>/gi)];
    const deTrabajo = links.filter(m => /RELACIONES|DNRYRT|SSRT|ST#M|TRABAJO|CONVENCI/i.test(texto(m[4])));
    for (const m of deTrabajo) {
      const url = `${BASE}/detalleAviso/primera/${m[2]}/${m[3]}`;
      if (vistos.has(url)) continue; vistos.add(url);
      const det = await get(url); await pausa(400);
      if (!det) continue;
      const t = texto(det);
      if (!GREMIO.test(t)) continue;
      const norma = (t.match(/(Disposici[oó]n|Resoluci[oó]n)\s+\d+\/\d{4}/i) || [""])[0];
      const empresa = (t.match(/(?:la firma|la empresa|la sociedad)\s+([^,]{3,120}?)\s*(?:\(C\.?\s?U\.?\s?I\.?\s?T\.?[^)]*\))?\s*,?\s*por la parte empleadora/i) || [])[1] || "";
      const cuit = ((t.match(/C\.?\s?U\.?\s?I\.?\s?T\.?\s*(?:N[°º]?)?\s*:?\s*(\d{2}-?\d{8}-?\d)/i) || [])[1] || "").replace(/-/g, "");
      const gremio = /SUPERVISORES|ASIMRA/i.test(t) ? "ASIMRA" : "UOM";
      const seccional = ((t.match(/Seccional\s+([A-ZÁÉÍÓÚÑa-záéíóúñ .]{3,40}?)\s+de la UNI[OÓ]N OBRERA/i) || [])[1] || "").trim();
      const tipo = /223\s*bis/i.test(t) ? "suspensiones" : /despid/i.test(t) ? "despidos" : "acuerdo";
      const enAnexo = !empresa && /Anexo/i.test(t);
      const item = { fecha: `${f.slice(0, 4)}-${f.slice(4, 6)}-${f.slice(6)}`, norma, empresa: empresa.trim(), cuit, gremio, seccional, tipo, enAnexo, url };
      bo.acuerdos.push(item); nuevosAc++;
      console.log("acuerdo", item.fecha, gremio, item.empresa || "(en anexo)", seccional);
      const p = item.empresa && plantaDe(item.empresa, seccional);
      if (p) {
        if (cuit && !cuits.empresas[p.empresa]) cuits.empresas[p.empresa] = { cuit, fuente: url };
        const id = `bo-${m[2]}`;
        if (!ev.eventos.some(e => e.id === id)) {
          ev.eventos.push({ id, plantaId: p.id, tipo: tipo === "acuerdo" ? "conflicto" : tipo, fecha: item.fecha, cantidad: null, fuente: "Boletín Oficial", url,
            nota: `${norma}: Trabajo homologó un acuerdo ${tipo === "suspensiones" ? "de suspensiones (art. 223 bis)" : ""} entre ${item.empresa} y ${gremio}${seccional ? " seccional " + seccional : ""}.`.replace(/\s+/g, " ") });
          nuevosEv++;
        }
      }
    }
  }
  // --- segunda sección: menciones de empresas seguidas (sociedades, concursos, quiebras) ---
  const h2 = await get(`${BASE}/seccion/segunda/${f}`);
  if (h2) {
    for (const m of h2.matchAll(/href="([^"]*\/detalleAviso\/segunda\/(\d+)\/(\d{8})[^"]*)"[^>]*>([\s\S]{0,400}?)<\/a>/gi)) {
      const tx = norm(texto(m[4])); const clave = CLAVES.find(c => new RegExp(`\\b${c}\\b`).test(tx));
      if (!clave) continue;
      const url = `${BASE}/detalleAviso/segunda/${m[2]}/${m[3]}`;
      if (vistos.has(url)) continue; vistos.add(url);
      const det = await get(url); const t = det ? texto(det) : "";
      const tipo = /QUIEBRA/i.test(t) ? "quiebra" : /CONCURSO PREVENTIVO/i.test(t) ? "concurso" : "societario";
      bo.menciones.push({ fecha: `${f.slice(0, 4)}-${f.slice(4, 6)}-${f.slice(6)}`, clave, titulo: texto(m[4]).slice(0, 160), tipo, url }); nuevosMe++;
      console.log("mención", clave, tipo, url);
    }
  }
  await pausa(600);
}

bo.actualizado = hoy.toISOString().slice(0, 10);
bo.fuente = "Boletín Oficial de la República Argentina (primera y segunda sección)";
bo.nota = "Acuerdos homologados por la Secretaría de Trabajo donde firma la UOM o ASIMRA, y avisos de la segunda sección que nombran empresas seguidas. Cuando la empresa figura solo en el anexo, se marca enAnexo.";
bo.acuerdos.sort((a, b) => b.fecha.localeCompare(a.fecha)); bo.menciones.sort((a, b) => b.fecha.localeCompare(a.fecha));
await guardar("data/boletin-oficial.json", bo);
if (nuevosEv) { ev.eventos.sort((a, b) => b.fecha.localeCompare(a.fecha)); ev.actualizado = bo.actualizado; await guardar("data/eventos.json", ev); }
await guardar("data/cuits.json", cuits);
console.log(`Listo: ${nuevosAc} acuerdos metalúrgicos, ${nuevosMe} menciones, ${nuevosEv} hechos nuevos en plantas.`);
