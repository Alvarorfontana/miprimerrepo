// Observatorio Metalúrgico · UOM — aplicación del portal
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = n => (n == null || n === "" || isNaN(n)) ? "—" : Number(n).toLocaleString("es-AR");
const dec = (v, d = 1) => (v == null || isNaN(v)) ? "—" : Number(v).toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d });
const hoy = () => new Date().toISOString().slice(0, 10);
const NS = "http://www.w3.org/2000/svg";
function toast(m) { const t = document.createElement("div"); t.className = "toast"; t.textContent = m; document.body.appendChild(t); setTimeout(() => t.remove(), 2800); }
const norm = s => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/* ---------- constantes del dominio ---------- */
const K = Math.cos(38 * Math.PI / 180), SC = 20, W0 = -73.6, N0 = -21.7;
const proj = (lon, lat) => [(lon - W0) * K * SC, (N0 - lat) * SC];
const unproj = (x, y) => [x / (K * SC) + W0, N0 - y / SC];
const REGION = { "CABA": "AMBA", "Buenos Aires": "Buenos Aires", "Santa Fe": "Litoral", "Entre Ríos": "Litoral", "Córdoba": "Centro", "La Pampa": "Centro", "Mendoza": "Cuyo", "San Juan": "Cuyo", "San Luis": "Cuyo", "La Rioja": "NOA", "Catamarca": "NOA", "Tucumán": "NOA", "Salta": "NOA", "Jujuy": "NOA", "Santiago del Estero": "NOA", "Chaco": "NEA", "Corrientes": "NEA", "Misiones": "NEA", "Formosa": "NEA", "Neuquén": "Patagonia", "Río Negro": "Patagonia", "Chubut": "Patagonia", "Santa Cruz": "Patagonia", "Tierra del Fuego": "Patagonia" };
const PROV_COD = { "02": "CABA", "06": "Buenos Aires", "10": "Catamarca", "14": "Córdoba", "18": "Corrientes", "22": "Chaco", "26": "Chubut", "30": "Entre Ríos", "34": "Formosa", "38": "Jujuy", "42": "La Pampa", "46": "La Rioja", "50": "Mendoza", "54": "Misiones", "58": "Neuquén", "62": "Río Negro", "66": "Salta", "70": "San Juan", "74": "San Luis", "78": "Santa Cruz", "82": "Santa Fe", "86": "Santiago del Estero", "90": "Tucumán", "94": "Tierra del Fuego" };
const AMBA = ["Avellaneda", "Lanús", "Lomas de Zamora", "Quilmes", "La Matanza", "Morón", "Tres de Febrero", "San Martín", "Vicente López", "San Isidro", "Tigre", "Esteban Echeverría", "Almirante Brown", "Berazategui", "Florencio Varela", "Merlo", "Moreno", "Malvinas Argentinas", "José C. Paz", "San Miguel", "Hurlingham", "Ituzaingó", "Ezeiza", "Pilar", "Escobar", "San Fernando"];
const regionOf = p => (p.provincia === "Buenos Aires" && AMBA.includes(p.partido)) ? "AMBA" : (REGION[p.provincia] || "Otra");
const RAMAS = ["Siderurgia", "Aluminio y no ferrosos", "Tubos", "Fundición", "Autopartes", "Maquinaria agrícola", "Bienes de capital", "Línea blanca", "Electrónica", "Carrocerías y remolques", "Otros productos metálicos"];
const ESTADOS = { cierre: ["Cierre", "--closed"], despidos: ["Despidos", "--bad"], suspensiones: ["Suspensiones", "--warn"], normal: ["Sin conflicto", "--ok"], sin: ["Sin reporte reciente", "--nodata"] };
const TIPOS = { despidos: "Despidos", suspensiones: "Suspensiones", cierre: "Cierre", retiros: "Retiros voluntarios", reincorporacion: "Reincorporación", conflicto: "Conflicto o medida de fuerza" };
const RAMA_COLOR = { "24": "#1b4b8a", "25": "#2f8f9d", "26": "#8a5cc2", "27": "#c2417a", "28": "#5c8f2f", "293": "#c98a12", "30": "#6b6b6b" };
const PRESETS = [["País", [-73.6, -55.1, -53.6, -21.7]], ["AMBA", [-59.1, -35.05, -57.85, -34.35]], ["Litoral", [-61.3, -34.5, -58.6, -32.6]], ["Centro", [-65.2, -34, -61.3, -30.8]], ["Cuyo", [-70, -35.5, -64.5, -31]], ["Patagonia", [-72, -55.1, -63, -38]]];
const cssv = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

/* ---------- estado ---------- */
const S = { geo: null, plantas: [], eventos: [], reportes: [], series: [], est: { filas: [] }, fuentes: { fuentes: [], ramasClae: [] }, sel: null, tab: "informe", picking: false, capas: { plantas: true, est: true, osm: true, nombres: true } };
let sb = null; // cliente Supabase opcional

/* ---------- carga de datos ---------- */
const getJSON = async (u, fb) => { try { const r = await fetch(u, { cache: "no-cache" }); if (!r.ok) throw 0; return await r.json(); } catch { return fb; } };
async function cargar() {
  const [geo, pl, ev, rep, ind, auto, est, fu, emp, oede, conf, osm] = await Promise.all([
    getJSON("data/provincias.json"), getJSON("data/plantas.json", { plantas: [] }), getJSON("data/eventos.json", { eventos: [] }),
    getJSON("data/reportes.json", { reportes: [] }), getJSON("data/indicadores.json", { series: [] }), getJSON("data/indicadores-auto.json", { series: [] }),
    getJSON("data/establecimientos.json", { filas: [] }), getJSON("data/fuentes.json", { fuentes: [], ramasClae: [] }), getJSON("data/empresas.json", { empresas: [] }), getJSON("data/empleo-oede.json", null), getJSON("data/conflictividad.json", null), getJSON("data/osm-plantas.json", { plantas: [] })]);
  S.geo = geo; S.plantas = pl.plantas; S.eventos = ev.eventos; S.reportes = rep.reportes; S.est = est; S.fuentes = fu; S.empresas = emp.empresas || []; S.oede = oede; S.conf = conf; S.osm = osm;
  S.series = [...(ind.series || []).map(s => ({ ...s, auto: false })), ...(auto.series || []).map(s => ({ ...s, auto: true }))];
  S.actualizado = { plantas: pl.actualizado, indicadores: ind.actualizado, auto: auto.actualizado, est: est.actualizado };
  await conectarSupabase();
  aplicarBorradores();
}
async function conectarSupabase() {
  const c = window.OBSERVATORIO || {};
  if (!c.supabaseUrl || !c.supabaseAnonKey) return;
  try {
    await new Promise((ok, mal) => { const s = document.createElement("script"); s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js"; s.onload = ok; s.onerror = mal; document.head.appendChild(s); });
    sb = window.supabase.createClient(c.supabaseUrl, c.supabaseAnonKey);
    const unir = (base, filas) => { const m = new Map(base.map(x => [x.id, x])); for (const f of filas || []) m.set(f.id, { ...m.get(f.id), ...f }); return [...m.values()]; };
    const [p, e, r, i] = await Promise.all(["plantas", "eventos", "reportes", "indicadores"].map(t => sb.from(t).select("*")));
    S.plantas = unir(S.plantas, p.data); S.eventos = unir(S.eventos, e.data); S.reportes = unir(S.reportes, r.data);
    for (const row of i.data || []) { let s = S.series.find(x => x.clave === row.serie); if (!s) { s = { clave: row.serie, nombre: row.nombre || row.serie, unidad: row.unidad, organismo: row.fuente, datos: [], auto: false }; S.series.push(s); } s.datos = s.datos.filter(d => d.periodo !== row.periodo).concat({ periodo: row.periodo, valor: row.valor, fuente: row.fuente, url: row.url }); }
  } catch (e) { console.warn("Supabase no disponible", e); sb = null; }
}
const BORR = "observatorio_borradores";
const leerBorr = () => { try { return JSON.parse(localStorage.getItem(BORR) || "{}"); } catch { return {}; } };
function aplicarBorradores() { if (sb) return; const b = leerBorr(); for (const k of ["plantas", "eventos", "reportes"]) for (const x of b[k] || []) { const i = S[k].findIndex(y => y.id === x.id); if (i >= 0) S[k][i] = x; else S[k].push({ ...x, borrador: true }); } }
async function guardar(tabla, fila) {
  if (sb) { const { error } = await sb.from(tabla).upsert(fila); if (error) throw error; }
  else { const b = leerBorr(); b[tabla] = (b[tabla] || []).filter(x => x.id !== fila.id).concat(fila); try { localStorage.setItem(BORR, JSON.stringify(b)); } catch { } }
  const lista = tabla === "indicadores" ? null : S[tabla];
  if (lista) { const i = lista.findIndex(x => x.id === fila.id); if (i >= 0) lista[i] = fila; else lista.push({ ...fila, borrador: !sb }); }
  else { let s = S.series.find(x => x.clave === fila.serie); if (!s) { s = { clave: fila.serie, nombre: fila.nombre, unidad: fila.unidad, organismo: fila.fuente, datos: [], auto: false }; S.series.push(s); } s.datos = s.datos.filter(d => d.periodo !== fila.periodo).concat(fila); }
}

/* ---------- lógica ---------- */
const mesesAtras = n => { const d = new Date(); d.setMonth(d.getMonth() - n); return d.toISOString().slice(0, 10); };
const eventosDe = id => S.eventos.filter(e => e.plantaId === id).sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
const reportesDe = id => S.reportes.filter(r => r.plantaId === id).sort((a, b) => (b.periodo || "").localeCompare(a.periodo || ""));
function estado(p) {
  const todos = eventosDe(p.id), ev = todos.filter(e => (e.fecha || "") >= mesesAtras(6));
  const cierre = todos.find(e => e.tipo === "cierre"), reabre = cierre && todos.find(e => e.tipo === "reincorporacion" && e.fecha > cierre.fecha);
  if (cierre && !reabre) return "cierre";
  if (ev.some(e => e.tipo === "despidos")) return "despidos";
  const r = reportesDe(p.id)[0];
  if (ev.some(e => e.tipo === "suspensiones") || (r && r.suspendidos > 0 && r.periodo >= mesesAtras(3).slice(0, 7))) return "suspensiones";
  return (r && r.periodo >= mesesAtras(3).slice(0, 7)) ? "normal" : "sin";
}
const F = () => ({ r: $("fReg").value, pv: $("fProv").value, sc: $("fSec").value, ra: $("fRama").value });
function filtradas() { const f = F(); return S.plantas.filter(p => (!f.r || regionOf(p) === f.r) && (!f.pv || p.provincia === f.pv) && (!f.sc || p.seccional === f.sc) && (!f.ra || p.rama === f.ra)); }
function ambito() { const f = F(); const a = f.sc ? "Seccional " + f.sc : f.pv ? f.pv : f.r ? "Región " + f.r : "Total país"; return f.ra ? `${a} · ${f.ra}` : a; }
function stats(list) {
  const ids = new Set(list.map(p => p.id)), desde = mesesAtras(12);
  const ev = S.eventos.filter(e => ids.has(e.plantaId) && (e.fecha || "") >= desde);
  const suma = t => ev.filter(e => e.tipo === t).reduce((a, e) => a + (+e.cantidad || 0), 0);
  let dot = 0, conDot = 0, cap = [];
  for (const p of list) { const r = reportesDe(p.id)[0]; if (r) { if (r.dotacion != null && r.dotacion !== "") { dot += +r.dotacion; conDot++; } if (r.capacidad != null && r.capacidad !== "") cap.push(+r.capacidad); } }
  const cierres = ev.filter(e => e.tipo === "cierre");
  return { n: list.length, provs: new Set(list.map(p => p.provincia)).size, dot, conDot, cap: cap.length ? cap.reduce((a, b) => a + b, 0) / cap.length : null, capN: cap.length,
    despidos: suma("despidos"), susp: suma("suspensiones"), retiros: suma("retiros"), cierres: cierres.length, enCierres: cierres.reduce((a, e) => a + (+e.cantidad || 0), 0), ev,
    afectadas: new Set(ev.filter(e => ["despidos", "suspensiones", "cierre", "retiros"].includes(e.tipo)).map(e => e.plantaId)).size };
}
const ultimo = clave => { const s = S.series.find(x => x.clave === clave); if (!s || !s.datos.length) return null; const d = s.datos.slice().sort((a, b) => a.periodo.localeCompare(b.periodo)).at(-1); return { ...d, unidad: s.unidad, nombre: s.nombre }; };
const mesTxt = p => { const [y, m] = p.split("-"); return ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"][+m - 1] + " " + y; };
const provDeEst = v => { if (v == null) return null; const s = String(v).padStart(2, "0"); if (PROV_COD[s]) return PROV_COD[s]; const n = norm(v); return Object.keys(REGION).find(p => norm(p) === n) || (n.includes("ciudad") ? "CABA" : null); };
const ramaDeClae = c => { const s = String(c).padStart(6, "0"); return ["293", "24", "25", "26", "27", "28", "30"].find(p => s.startsWith(p)); };

/* ---------- portada ---------- */
function portada() {
  const svg = $("heroMap"); let h = "";
  for (const d of Object.values(S.geo.p)) h += `<path d="${d}" fill="#ffffff" stroke="#9fb1c6" stroke-width="0.8"/>`;
  const filas = S.est.filas || [];
  for (let i = 0; i < filas.length; i += Math.max(1, Math.floor(filas.length / 4000))) { const [lat, lon] = filas[i]; const [x, y] = proj(lon, lat); h += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="0.9" fill="#1b4b8a" fill-opacity=".35"/>`; }
  for (const p of S.plantas) { const [x, y] = proj(p.lon, p.lat); h += `<circle cx="${x}" cy="${y}" r="7" fill="#e05a12" fill-opacity=".18"/><circle cx="${x}" cy="${y}" r="3.4" fill="#e05a12" stroke="#fff" stroke-width="1.2"/>`; }
  const lab = (t, lon, lat, dx = 10) => { const [x, y] = proj(lon, lat); return `<text x="${x + dx}" y="${y + 4}" font-size="10.5" font-family="IBM Plex Sans,sans-serif" font-weight="600" fill="#0e2a4f" paint-order="stroke" stroke="#fff" stroke-width="3">${t}</text>`; };
  h += lab("Villa Constitución", -60.33, -33.23) + lab("Campana", -58.96, -34.17) + lab("AMBA", -58.4, -34.7, 10) + lab("Córdoba", -62.4, -32.4, 10) + lab("Mendoza", -68.85, -32.93, 10) + lab("Puerto Madryn", -65.04, -42.77) + lab("Tierra del Fuego", -67.7, -53.79);
  svg.innerHTML = h;
  $("heroTag").textContent = `${S.plantas.length} plantas UOM relevadas` + (filas.length ? ` · ${fmt(filas.length)} establecimientos metalúrgicos (CEP XXI)` : "");
  const b = [["adimra-actividad", "Actividad metalúrgica interanual", "ADIMRA", true], ["adimra-capacidad", "Capacidad instalada usada en la metalurgia", "ADIMRA"], ["indec-uci-metalmecanica", "Capacidad usada en metalmecánica, el bloque más bajo de la industria", "INDEC"], ["caa-acero-crudo", "Miles de toneladas de acero crudo en el mes", "Cámara Argentina del Acero"]];
  $("band").innerHTML = b.map(([k, t, f, signo]) => { const u = ultimo(k); if (!u) return ""; const v = u.unidad === "%" ? (signo && u.valor > 0 ? "+" : "") + dec(u.valor) + "%" : dec(u.valor); return `<div class="stat"><b class="${u.valor < 0 ? "neg" : ""}">${v}</b><span>${t}</span><small>${f} · ${mesTxt(u.periodo)}</small></div>`; }).join("");
}

/* ---------- mapa ---------- */
let svg, vb = [0, 0, 316, 668], canvas, ctx;
function fitBox(lw, ls, le, ln) { const [x1, y1] = proj(lw, ln), [x2, y2] = proj(le, ls); const b = svg.getBoundingClientRect(); const ar = (b.width || 500) / (b.height || 640); let w = x2 - x1, h = y2 - y1; if (w / h < ar) { const nw = h * ar; return [x1 - (nw - w) / 2, y1, nw, h]; } const nh = w / ar; return [x1, y1 - (nh - h) / 2, w, nh]; }
function setVB(b) { vb = b; svg.setAttribute("viewBox", b.map(v => v.toFixed(2)).join(" ")); dibujarPuntos(); dibujarEst(); }
function baseMapa() {
  svg = $("map"); vb = [0, 0, S.geo.w, S.geo.h];
  let h = `<g id="provs">`; for (const [n, d] of Object.entries(S.geo.p)) h += `<path class="prov" data-name="${esc(n)}" d="${d}"><title>${esc(n)}</title></path>`;
  h += `</g><g id="labs"></g><g id="pts"></g>`; svg.innerHTML = h;
  canvas = document.createElement("canvas"); canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none";
  $("mapbox").insertBefore(canvas, $("mapbox").querySelector(".zoomctl")); ctx = canvas.getContext("2d");
  let drag = null;
  svg.addEventListener("pointerdown", e => { drag = { x: e.clientX, y: e.clientY, vb: [...vb], mov: false }; svg.setPointerCapture(e.pointerId); });
  svg.addEventListener("pointermove", e => { if (!drag) return; const b = svg.getBoundingClientRect(); if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 4) drag.mov = true; if (drag.mov) setVB([drag.vb[0] - (e.clientX - drag.x) * vb[2] / b.width, drag.vb[1] - (e.clientY - drag.y) * vb[3] / b.height, vb[2], vb[3]]); });
  svg.addEventListener("pointerup", e => { if (drag && !drag.mov && !S.picking && S.capas.est && e.target.tagName !== "circle") fichaEst(e); if (drag && !drag.mov && S.picking) { const b = svg.getBoundingClientRect(); const [lon, lat] = unproj(vb[0] + (e.clientX - b.left) / b.width * vb[2], vb[1] + (e.clientY - b.top) / b.height * vb[3]); $("np_lat").value = lat.toFixed(4); $("np_lon").value = lon.toFixed(4); S.picking = false; $("mapbox").classList.remove("picking"); toast("Ubicación marcada"); $("cargar").scrollIntoView({ behavior: "smooth" }); } drag = null; });
  svg.addEventListener("wheel", e => { e.preventDefault(); const b = svg.getBoundingClientRect(); zoom(e.deltaY < 0 ? .8 : 1.25, (e.clientX - b.left) / b.width, (e.clientY - b.top) / b.height); }, { passive: false });
  $("zin").onclick = () => zoom(.6, .5, .5); $("zout").onclick = () => zoom(1.6, .5, .5);
  $("zoomPresets").innerHTML = ""; for (const [n, b] of PRESETS) { const c = document.createElement("button"); c.className = "chip"; c.type = "button"; c.textContent = n; c.onclick = () => setVB(fitBox(...b)); $("zoomPresets").appendChild(c); }
  const capas = [["plantas", "Plantas UOM"], ["osm", "Candidatas con nombre (OSM)"], ["est", "Establecimientos CEP XXI"], ["nombres", "Nombres de provincias"]];
  $("capas").innerHTML = `<span class="small muted" style="width:100%">Capas del mapa · en azul se ven, en blanco están ocultas. Tocá para cambiar.</span>` + capas.map(([k, t]) => `<button class="chip" type="button" data-c="${k}" aria-pressed="${S.capas[k]}"><span aria-hidden="true">${S.capas[k] ? "✓ " : ""}</span>${t}</button>`).join("");
  $("capas").querySelectorAll("button").forEach(b => b.onclick = () => { S.capas[b.dataset.c] = !S.capas[b.dataset.c]; b.setAttribute("aria-pressed", S.capas[b.dataset.c]); b.firstChild.textContent = S.capas[b.dataset.c] ? "✓ " : ""; dibujarPuntos(); dibujarEst(); });
  new ResizeObserver(() => { setVB(vb); }).observe($("mapbox"));
}
function fichaEst(e) {
  const b = svg.getBoundingClientRect(), mx = e.clientX - b.left, my = e.clientY - b.top, sx = b.width / vb[2], sy = b.height / vb[3];
  let best = null, bd = 12;
  for (const row of S.est.filas || []) { const [x, y] = proj(row[1], row[0]); const d = Math.hypot((x - vb[0]) * sx - mx, (y - vb[1]) * sy - my); if (d < bd) { bd = d; best = row; } }
  if (!best) return;
  const ram = (S.fuentes.ramasClae.find(x => x.prefijo === ramaDeClae(best[2])) || {}).rama || "";
  const cerca = S.plantas.filter(p => Math.hypot((p.lat - best[0]) * 111, (p.lon - best[1]) * 92) < 2);
  $("ficha").innerHTML = `<div class="ficha" style="border-left-color:${RAMA_COLOR[ramaDeClae(best[2])] || "#555"}"><h4 style="margin:0;font-size:17px">Establecimiento del padrón oficial</h4>
   <p class="small" style="margin:4px 0">${esc(ram)} · actividad CLAE ${esc(best[2])} · <b>${esc(String(best[3] || "").slice(3))} trabajadores</b> · ${esc(provDeEst(best[4]) || "")}</p>
   <p class="small muted" style="margin:0 0 6px">El padrón del CEP XXI no publica el nombre de la empresa (secreto estadístico). ${cerca.length ? `Está a menos de 2 km de: <b>${cerca.map(p => esc(p.nombre)).join(", ")}</b>.` : "No coincide con ninguna planta ya relevada."}</p>
   <div class="row"><a class="chip" href="https://www.openstreetmap.org/?mlat=${best[0]}&mlon=${best[1]}#map=17/${best[0]}/${best[1]}" target="_blank" rel="noopener">Ver qué hay en este lugar</a><a class="chip" href="https://www.google.com/maps/search/industria/@${best[0]},${best[1]},17z" target="_blank" rel="noopener">Buscar empresas en la zona</a></div></div>`;
}
function zoom(f, fx, fy) { const nw = Math.min(Math.max(vb[2] * f, .12), S.geo.w * 1.8), nh = nw * vb[3] / vb[2]; setVB([vb[0] + (vb[2] - nw) * fx, vb[1] + (vb[3] - nh) * fy, nw, nh]); }
function dibujarPuntos() {
  const g = $("pts"), L = $("labs"); if (!g) return; g.innerHTML = ""; L.innerHTML = "";
  const k = vb[2] / 316, pv = F().pv;
  document.querySelectorAll(".prov").forEach(p => p.classList.toggle("sel", !!pv && p.dataset.name === pv));
  if (S.capas.nombres) for (const [n, [x, y]] of Object.entries(S.geo.c)) { if (n === "CABA" && vb[2] > 30) continue; const t = document.createElementNS(NS, "text"); t.setAttribute("x", x); t.setAttribute("y", y); t.setAttribute("text-anchor", "middle"); t.setAttribute("class", "plab"); t.setAttribute("font-size", (6.2 * k).toFixed(2)); t.style.strokeWidth = (2.2 * k).toFixed(2) + "px"; t.textContent = n; L.appendChild(t); }
  const r = Math.max(4.6 * k, .07);
  if (S.capas.osm) for (const o of (S.osm && S.osm.plantas) || []) {
    if (F().pv && !(o.lat && o.lon)) continue; const [x, y] = proj(o.lon, o.lat);
    const q = document.createElementNS(NS, "rect"); q.setAttribute("x", x - r * .6); q.setAttribute("y", y - r * .6); q.setAttribute("width", r * 1.2); q.setAttribute("height", r * 1.2);
    q.setAttribute("fill", "none"); q.setAttribute("stroke", "#7a3fb0"); q.setAttribute("stroke-width", "1.4"); q.setAttribute("vector-effect", "non-scaling-stroke");
    const t = document.createElementNS(NS, "title"); t.textContent = `Candidata: ${o.nombre}${o.localidad ? " · " + o.localidad : ""} (OpenStreetMap)`; q.appendChild(t); g.appendChild(q);
  }
  if (!S.capas.plantas) return;
  for (const p of filtradas()) {
    if (p.lat == null) continue; const [x, y] = proj(p.lon, p.lat), st = estado(p);
    const c = document.createElementNS(NS, "circle"); c.setAttribute("cx", x); c.setAttribute("cy", y); c.setAttribute("r", r);
    c.setAttribute("fill", cssv(ESTADOS[st][1])); c.setAttribute("class", "pt" + (S.sel === p.id ? " on" : "")); c.setAttribute("tabindex", "0");
    const t = document.createElementNS(NS, "title"); t.textContent = `${p.nombre} · ${p.localidad} · ${ESTADOS[st][0]}`; c.appendChild(t);
    c.addEventListener("click", e => { e.stopPropagation(); elegir(p.id); }); c.addEventListener("keydown", e => { if (e.key === "Enter") elegir(p.id); });
    g.appendChild(c);
  }
  const est = S.est.filas || [];
  $("maplegend").innerHTML = (S.capas.osm && S.osm && S.osm.plantas.length ? `<span><i style="border:1.5px solid #7a3fb0;border-radius:2px;background:none"></i>Candidata con nombre (OSM)</span>` : "") + (S.capas.plantas ? Object.values(ESTADOS).map(([l, v]) => `<span><i style="background:${cssv(v)}"></i>${l}</span>`).join("") : "") +
    (S.capas.est && est.length ? `<span style="margin-top:4px;font-weight:600">Establecimientos por rama</span>` + S.fuentes.ramasClae.map(r => `<span><i style="background:${RAMA_COLOR[r.prefijo]};width:7px;height:7px"></i>${esc(r.rama.split(" (")[0])}</span>`).join("") : "");
}
function dibujarEst() {
  if (!canvas) return; const b = canvas.getBoundingClientRect(), dpr = devicePixelRatio || 1;
  canvas.width = b.width * dpr; canvas.height = b.height * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, b.width, b.height);
  if (!S.capas.est) return; const f = F(); const sx = b.width / vb[2], sy = b.height / vb[3];
  const rad = Math.min(3, Math.max(1.1, 1.1 * 316 / vb[2] * .35));
  for (const row of S.est.filas || []) {
    const rama = ramaDeClae(row[2]); if (f.pv && provDeEst(row[4]) !== f.pv) continue;
    const [x, y] = proj(row[1], row[0]); const px = (x - vb[0]) * sx, py = (y - vb[1]) * sy;
    if (px < -4 || py < -4 || px > b.width + 4 || py > b.height + 4) continue;
    const big = row[3] === "e. 500+" ? 2.4 : row[3] === "d. 200-499" ? 1.8 : row[3] === "c. 50-199" ? 1.3 : 1;
    ctx.fillStyle = RAMA_COLOR[rama] || "#555"; ctx.globalAlpha = big > 1.5 ? .85 : .5; ctx.beginPath(); ctx.arc(px, py, rad * big, 0, 6.283); ctx.fill();
    if (big > 1.5) { ctx.globalAlpha = 1; ctx.strokeStyle = "#fff"; ctx.lineWidth = 1; ctx.stroke(); }
  }
  ctx.globalAlpha = 1;
}

/* ---------- filtros, cifras e informe ---------- */
function opciones(sel, vals, todas) { const v = sel.value; sel.innerHTML = `<option value="">${todas}</option>` + vals.map(x => `<option${x === v ? " selected" : ""}>${esc(x)}</option>`).join(""); if (!vals.includes(v)) sel.value = ""; }
function filtros() {
  opciones($("fReg"), [...new Set([...Object.values(REGION), "AMBA"])].sort(), "Todas");
  const r = $("fReg").value;
  opciones($("fProv"), Object.keys(S.geo.p).filter(p => !r || REGION[p] === r || (r === "AMBA" && ["CABA", "Buenos Aires"].includes(p))).sort((a, b) => a.localeCompare(b, "es")), "Todas");
  opciones($("fSec"), [...new Set(S.plantas.filter(p => (!r || regionOf(p) === r) && (!$("fProv").value || p.provincia === $("fProv").value)).map(p => p.seccional).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es")), "Todas");
  opciones($("fRama"), RAMAS, "Todas");
}
function kpis() {
  const s = stats(filtradas());
  $("kpis").innerHTML = [[fmt(s.n), `plantas UOM · ${s.provs} provincias`, ""], [s.conDot ? fmt(s.dot) : "—", s.conDot ? `trabajadores en ${s.conDot} plantas con reporte` : "dotación: a cargar por las seccionales", ""],
  [fmt(s.despidos), "despidos, últimos 12 meses", "bad"], [fmt(s.susp), "suspensiones, últimos 12 meses", "warn"], [fmt(s.cierres), `cierres, últimos 12 meses${s.enCierres ? ` · ${fmt(s.enCierres)} trab.` : ""}`, "bad"],
  [s.cap != null ? dec(s.cap) + "%" : "—", s.capN ? `capacidad usada, ${s.capN} plantas` : "capacidad: a cargar", ""]].map(([b, l, c]) => `<div class="kpi ${c}"><b>${b}</b><span>${l}</span></div>`).join("");
}
function textoInforme() {
  const L = [], s = stats(filtradas());
  L.push(`INFORME DE SITUACIÓN — ${ambito().toUpperCase()}`, `Observatorio Metalúrgico UOM · ${new Date().toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })}`, "");
  L.push(`Plantas relevadas: ${s.n}, en ${s.provs} provincia${s.provs === 1 ? "" : "s"}.`);
  L.push(s.conDot ? `Dotación informada: ${fmt(s.dot)} trabajadores en ${s.conDot} plantas con reporte mensual.` : "Dotación: las seccionales todavía no cargaron reportes mensuales para este ámbito.");
  if (s.cap != null) L.push(`Capacidad instalada usada: ${dec(s.cap)}% en promedio (${s.capN} plantas).`);
  L.push("", `Últimos 12 meses: ${fmt(s.despidos)} despidos, ${fmt(s.susp)} suspensiones, ${fmt(s.retiros)} retiros voluntarios y ${s.cierres} cierre${s.cierres === 1 ? "" : "s"} de planta${s.enCierres ? ` que afectaron a ${fmt(s.enCierres)} trabajadores` : ""}. Plantas con hechos registrados: ${s.afectadas}.`);
  const top = s.ev.filter(e => e.tipo !== "reincorporacion").sort((a, b) => (+b.cantidad || 0) - (+a.cantidad || 0)).slice(0, 5);
  if (top.length) { L.push("Hechos de mayor impacto:"); for (const e of top) { const p = S.plantas.find(x => x.id === e.plantaId); L.push(`• ${e.fecha.split("-").reverse().join("/")} · ${p ? p.nombre : "Planta"} (${p ? p.localidad : ""}): ${TIPOS[e.tipo] || e.tipo}${e.cantidad ? `, ${e.cantidad} trabajadores` : ""}. Fuente: ${e.fuente || "s/d"}.`); } }
  const n = (S.est.filas || []).filter(r => !F().pv || provDeEst(r[4]) === F().pv).length;
  if (n) L.push("", `Establecimientos metalúrgicos registrados en el ámbito (CEP XXI): ${fmt(n)}.`);
  L.push("", "Contexto sectorial:");
  for (const k of ["adimra-actividad", "adimra-capacidad", "indec-uci-metalmecanica", "indec-uci-metalicas", "caa-acero-crudo"]) { const u = ultimo(k); if (u) L.push(`• ${u.nombre}: ${dec(u.valor)} ${u.unidad} (${mesTxt(u.periodo)}).`); }
  L.push("", "Fuentes: seccionales UOM, ADIMRA, INDEC, CEP XXI y Cámara Argentina del Acero.");
  return L.join("\n");
}
function barras(filas) {
  if (!filas.length) return `<div class="empty">Sin hechos registrados en este ámbito en los últimos 12 meses.</div>`;
  const ks = ["despidos", "suspensiones", "retiros", "cierre"], col = { despidos: cssv("--bad"), suspensiones: cssv("--warn"), retiros: cssv("--steel"), cierre: cssv("--closed") };
  const max = Math.max(...filas.map(r => ks.reduce((a, k) => a + (r.v[k] || 0), 0)), 1), W = 560, lh = 30, l = 140, H = filas.length * lh + 30, w = W - l - 50;
  let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Trabajadores afectados por ámbito">`;
  for (const t of [0, max / 2, max].map(Math.round)) { const x = l + w * t / max; s += `<line x1="${x}" x2="${x}" y1="4" y2="${H - 22}" stroke="${cssv("--line")}"/><text x="${x}" y="${H - 6}" font-size="11" text-anchor="middle" fill="${cssv("--muted")}">${fmt(t)}</text>`; }
  filas.forEach((r, i) => { const y = 6 + i * lh; let x = l, tot = 0; s += `<text x="${l - 8}" y="${y + 16}" font-size="12.5" text-anchor="end" fill="${cssv("--ink")}">${esc(r.label.length > 20 ? r.label.slice(0, 19) + "…" : r.label)}</text>`;
    for (const k of ks) { const v = r.v[k] || 0; if (!v) continue; const ww = w * v / max; s += `<rect x="${x}" y="${y + 4}" width="${ww}" height="18" rx="2" fill="${col[k]}"><title>${TIPOS[k]}: ${v}</title></rect>`; x += ww; tot += v; }
    s += `<text x="${x + 6}" y="${y + 17}" font-size="12" font-family="IBM Plex Mono,monospace" fill="${cssv("--muted")}">${fmt(tot)}</text>`; });
  return s + `</svg><div class="legend">${ks.map(k => `<span><i style="background:${col[k]}"></i>${k === "cierre" ? "Trabajadores en cierres" : TIPOS[k]}</span>`).join("")}</div>`;
}
function informe() {
  const list = filtradas(), s = stats(list), f = F();
  const por = f.pv ? "seccional" : f.r ? "provincia" : "region", clave = p => por === "seccional" ? (p.seccional || "Sin asignar") : por === "provincia" ? p.provincia : regionOf(p);
  const g = {}; for (const p of list) (g[clave(p)] = g[clave(p)] || []).push(p);
  const nombre = { region: "región", provincia: "provincia", seccional: "seccional" }[por];
  const filas = Object.entries(g).map(([k, ps]) => { const st = stats(ps); return { label: k, v: { despidos: st.despidos, suspensiones: st.susp, retiros: st.retiros, cierre: st.enCierres }, st }; }).filter(r => r.st.ev.length).sort((a, b) => Object.values(b.v).reduce((x, y) => x + y) - Object.values(a.v).reduce((x, y) => x + y));
  const tabla = Object.entries(g).sort((a, b) => b[1].length - a[1].length).map(([k, ps]) => { const st = stats(ps); return `<tr><td>${esc(k)}</td><td class="n">${st.n}</td><td class="n">${st.conDot ? fmt(st.dot) : "—"}</td><td class="n">${fmt(st.despidos)}</td><td class="n">${fmt(st.susp)}</td><td class="n">${st.cierres}</td><td class="n">${st.cap != null ? dec(st.cap, 0) + "%" : "—"}</td></tr>`; }).join("");
  const ev = s.ev.slice().sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 12).map(e => { const p = S.plantas.find(x => x.id === e.plantaId); return `<tr class="click" data-p="${esc(e.plantaId)}"><td class="n">${esc(e.fecha.split("-").reverse().join("/"))}</td><td>${esc(p ? p.nombre : "")}<div class="small muted">${esc(p ? p.localidad + ", " + p.provincia : "")}</div></td><td>${esc(TIPOS[e.tipo] || e.tipo)}</td><td class="n">${e.cantidad ? fmt(e.cantidad) : "—"}</td><td>${e.url ? `<a href="${esc(e.url)}" target="_blank" rel="noopener">${esc(e.fuente || "fuente")}</a>` : esc(e.fuente || "")}</td></tr>`; }).join("");
  $("p-informe").innerHTML = `
   <div class="row" style="justify-content:space-between"><h4 style="font-size:16px">${esc(ambito())}</h4>
   <div class="row no-print"><button class="chip" type="button" id="bCopiar">Copiar</button><button class="chip" type="button" id="bImprimir">Imprimir o PDF</button><button class="chip" type="button" id="bCsv">Descargar CSV</button></div></div>
   <div class="report" id="repTxt">${esc(textoInforme())}</div>
   <h4>Trabajadores afectados por ${nombre}, últimos 12 meses</h4>${barras(filas)}
   <h4>Resumen por ${nombre}</h4>
   <div class="tblwrap"><table><thead><tr><th>${nombre[0].toUpperCase() + nombre.slice(1)}</th><th class="n">Plantas</th><th class="n">Dotación</th><th class="n">Despidos</th><th class="n">Susp.</th><th class="n">Cierres</th><th class="n">Cap.</th></tr></thead><tbody>${tabla || `<tr><td colspan="7" class="muted">Sin plantas en este ámbito.</td></tr>`}</tbody></table></div>
   <h4>Últimos hechos</h4>${ev ? `<div class="tblwrap"><table><thead><tr><th>Fecha</th><th>Planta</th><th>Hecho</th><th class="n">Trab.</th><th>Fuente</th></tr></thead><tbody>${ev}</tbody></table></div>` : `<div class="empty">Sin hechos en los últimos 12 meses.</div>`}`;
  $("bCopiar").onclick = () => navigator.clipboard.writeText(textoInforme()).then(() => toast("Informe copiado"), () => toast("No se pudo copiar"));
  $("bImprimir").onclick = () => window.print();
  $("bCsv").onclick = csv;
  $("p-informe").querySelectorAll("tr.click").forEach(tr => tr.onclick = () => elegir(tr.dataset.p));
}
function csv() {
  const q = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const cab = ["planta", "empresa", "rama", "localidad", "partido", "provincia", "region", "seccional", "lat", "lon", "estado", "ultimo_periodo", "dotacion", "capacidad_pct", "suspendidos", "despidos_12m", "suspensiones_12m", "cierres_12m"];
  const filas = filtradas().map(p => { const r = reportesDe(p.id)[0] || {}, st = stats([p]); return [p.nombre, p.empresa, p.rama, p.localidad, p.partido, p.provincia, regionOf(p), p.seccional, p.lat, p.lon, ESTADOS[estado(p)][0], r.periodo, r.dotacion, r.capacidad, r.suspendidos, st.despidos, st.susp, st.cierres].map(q).join(","); });
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + cab.join(",") + "\n" + filas.join("\n")], { type: "text/csv" }));
  a.download = `observatorio-uom-${norm(ambito()).replace(/[^a-z0-9]+/g, "-")}-${hoy()}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function plantas() {
  const q = norm($("pq")?.value || ""), keep = $("pq")?.value || "";
  const list = filtradas().filter(p => !q || norm([p.nombre, p.empresa, p.localidad, p.seccional].join(" ")).includes(q)).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  $("p-plantas").innerHTML = `<label class="f" for="pq">Buscar planta, empresa o localidad<input id="pq" type="search" value="${esc(keep)}" placeholder="Ej.: Acindar, Campana"></label><p class="small muted">${list.length} plantas · ${esc(ambito())}</p>` +
    (list.length ? `<div class="tblwrap"><table><thead><tr><th>Planta</th><th>Rama</th><th>Ubicación</th><th>Seccional</th><th>Estado</th></tr></thead><tbody>${list.map(p => { const st = estado(p); return `<tr class="click" data-p="${esc(p.id)}"><td><b>${esc(p.nombre)}</b><div class="small muted">${esc(p.empresa)}</div></td><td>${esc(p.rama)}</td><td>${esc(p.localidad)}<div class="small muted">${esc(p.provincia)}</div></td><td>${esc(p.seccional || "—")}${p.seccional_confirmada === false ? `<div class="small muted">a confirmar</div>` : ""}</td><td><span class="pill" style="background:${cssv(ESTADOS[st][1])}">${ESTADOS[st][0]}</span></td></tr>`; }).join("")}</tbody></table></div>` : `<div class="empty">No hay plantas en este ámbito.</div>`);
  const i = $("pq"); i.oninput = () => { const pos = i.selectionStart; plantas(); const n = $("pq"); n.focus(); n.setSelectionRange(pos, pos); };
  $("p-plantas").querySelectorAll("tr.click").forEach(tr => tr.onclick = () => elegir(tr.dataset.p));
}
function ramas() {
  const filas = (S.est.filas || []).filter(r => !F().pv || provDeEst(r[4]) === F().pv);
  if (!filas.length) { $("p-ramas").innerHTML = `<div class="empty"><b>Capa de establecimientos del CEP XXI.</b><br>Se completa sola con la primera actualización automática del repositorio (GitHub Actions, días 5 y 20 de cada mes). Trae la ubicación y la rama de cada establecimiento metalúrgico registrado del país, sin nombre de empresa. Con eso el mapa muestra dónde hay industria metalúrgica más allá de las plantas que ya relevó la UOM.</div>`; return; }
  const porRama = {}, porProv = {}; for (const r of filas) { const k = ramaDeClae(r[2]); porRama[k] = (porRama[k] || 0) + 1; const p = provDeEst(r[4]) || "Sin dato"; porProv[p] = (porProv[p] || 0) + 1; }
  const max = Math.max(...Object.values(porRama));
  $("p-ramas").innerHTML = `<p class="small muted">${fmt(filas.length)} establecimientos metalúrgicos registrados · ${esc(F().pv || "todo el país")} · CEP XXI, actualizado ${esc(S.actualizado.est || "")}</p>
   ${S.fuentes.ramasClae.map(r => `<div style="display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,2fr) 60px;gap:8px;align-items:center;font-size:13px"><span>${esc(r.rama)}</span><span style="background:var(--soft);border-radius:3px;height:14px"><span style="display:block;height:14px;border-radius:3px;width:${(porRama[r.prefijo] || 0) / max * 100}%;background:${RAMA_COLOR[r.prefijo]}"></span></span><span class="n" style="font-family:var(--mono);text-align:right">${fmt(porRama[r.prefijo] || 0)}</span></div>`).join("")}
   ${(() => { const km = (a, b, c, d) => Math.hypot((a - c) * 111, (b - d) * 111 * Math.cos(a * Math.PI / 180));
      const g = filas.filter(r => r[3] === "e. 500+" || r[3] === "d. 200-499"), sin = g.filter(r => !S.plantas.some(p => km(r[0], r[1], p.lat, p.lon) < 6));
      const ram = Object.fromEntries(S.fuentes.ramasClae.map(x => [x.prefijo, x.rama.split(" (")[0]]));
      return `<h4>Grandes establecimientos por identificar</h4><p class="small muted" style="margin:0 0 6px">${g.length} establecimientos con más de 200 trabajadores en este ámbito; ${g.length - sin.length} están cerca de una planta ya relevada y <b>${sin.length} todavía no tienen nombre</b> en el observatorio. Abrí cada uno en el mapa para identificarlo y sumarlo como planta.</p>
      <div class="tblwrap" style="max-height:340px;overflow:auto"><table><thead><tr><th>Provincia</th><th>Rama</th><th>Trabajadores</th><th>Ubicación</th></tr></thead><tbody>${sin.sort((a, b) => (b[3] > a[3]) - (b[3] < a[3])).map(r => `<tr><td>${esc(provDeEst(r[4]) || "")}</td><td>${esc(ram[ramaDeClae(r[2])] || "")}<div class="small muted">CLAE ${esc(r[2])}</div></td><td>${esc(r[3].slice(3))}</td><td><a href="https://www.openstreetmap.org/?mlat=${r[0]}&mlon=${r[1]}#map=16/${r[0]}/${r[1]}" target="_blank" rel="noopener">Ver en el mapa</a></td></tr>`).join("")}</tbody></table></div>`; })()}
   ${F().pv ? "" : `<h4>Por provincia</h4><div class="tblwrap"><table><tbody>${Object.entries(porProv).sort((a, b) => b[1] - a[1]).map(([p, n]) => `<tr><td>${esc(p)}</td><td class="n">${fmt(n)}</td></tr>`).join("")}</tbody></table></div>`}`;
}
function ficha() {
  const p = S.plantas.find(x => x.id === S.sel); if (!p) { $("ficha").innerHTML = `<p class="small muted">Tocá una planta o un punto del padrón para ver su ficha.</p>`; return; }
  const st = estado(p), reps = reportesDe(p.id).slice(0, 6), evs = eventosDe(p.id).slice(0, 6);
  $("ficha").innerHTML = `<div class="ficha"><div class="row" style="justify-content:space-between"><h4 style="margin:0;font-size:18px">${esc(p.nombre)}</h4><span class="pill" style="background:${cssv(ESTADOS[st][1])}">${ESTADOS[st][0]}</span></div>
   <p class="small muted" style="margin:3px 0 8px">${esc(p.empresa)} · ${esc(p.rama)} · ${esc([p.localidad, p.partido, p.provincia].filter(Boolean).join(", "))} · Seccional ${esc(p.seccional || "sin asignar")}${p.convenio ? " · " + esc(p.convenio) : ""}${p.ubicacion === "aproximada" ? " · ubicación aproximada" : ""}</p>
   ${p.procesos ? `<p class="small" style="margin:0 0 6px"><b>Procesos:</b> ${esc(p.procesos)}</p>` : ""}
   ${(p.referencias || []).length ? `<h4>Datos de referencia</h4><ul class="small" style="margin:4px 0 8px;padding-left:18px">${p.referencias.map(r => `<li><b>${esc(r.variable)}:</b> ${typeof r.valor === "number" ? fmt(r.valor) : esc(r.valor)} ${esc(r.unidad || "")} <span class="muted">(${esc(r.periodo)} · <a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.fuente)}</a>)</span></li>`).join("")}</ul>` : ""}
   ${(() => { const e = (S.empresas || []).find(e => e.plantas.includes(p.id)); return e ? `<details class="small" style="margin-bottom:8px"><summary><b>Datos de la empresa: ${esc(e.nombre)}</b></summary><ul style="margin:4px 0;padding-left:18px">${e.datos.map(r => `<li>${esc(r.variable)}: ${typeof r.valor === "number" ? dec(r.valor, r.valor % 1 ? 1 : 0) : esc(r.valor)} ${esc(r.unidad || "")} <span class="muted">(${esc(r.periodo)} · <a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.fuente)}</a>)</span></li>`).join("")}</ul></details>` : ""; })()}
   ${reps.length ? `<div class="tblwrap"><table><thead><tr><th>Mes</th><th class="n">Dotación</th><th class="n">Cap.</th><th class="n">Susp.</th><th class="n">Producción</th></tr></thead><tbody>${reps.map(r => `<tr><td class="n">${esc(r.periodo)}</td><td class="n">${fmt(r.dotacion)}</td><td class="n">${r.capacidad != null ? r.capacidad + "%" : "—"}</td><td class="n">${fmt(r.suspendidos)}</td><td class="n">${r.produccion != null ? fmt(r.produccion) + " " + esc(r.unidad || "") : "—"}</td></tr>`).join("")}</tbody></table></div>` : `<p class="small muted">Sin reportes mensuales todavía.</p>`}
   ${evs.length ? `<h4>Hechos</h4><ul class="small" style="margin:4px 0;padding-left:18px">${evs.map(e => `<li><span class="muted">${esc(e.fecha.split("-").reverse().join("/"))}</span> · ${esc(TIPOS[e.tipo] || e.tipo)}${e.cantidad ? ` · ${fmt(e.cantidad)} trab.` : ""}${e.url ? ` · <a href="${esc(e.url)}" target="_blank" rel="noopener">${esc(e.fuente)}</a>` : ""}${e.nota ? `<div class="muted">${esc(e.nota)}</div>` : ""}</li>`).join("")}</ul>` : ""}
   <div class="row" style="margin-top:8px"><button class="chip" type="button" id="irRep">Cargar reporte de esta planta</button><button class="chip" type="button" id="irEv">Cargar hecho</button></div></div>`;
  $("irRep").onclick = () => irForm("rep"); $("irEv").onclick = () => irForm("ev");
}
function elegir(id) { S.sel = id; ficha(); dibujarPuntos(); }
function tab(t) { S.tab = t; for (const n of ["informe", "plantas", "ramas"]) { $("t-" + n).setAttribute("aria-selected", n === t); $("p-" + n).hidden = n !== t; } ({ informe, plantas, ramas })[t](); }


/* ---------- empleo OEDE ---------- */
const trimTxt = t => `${t.slice(5)}.º trim. ${t.slice(0, 4)}`;
function empleo() {
  const O = S.oede; if (!O) { $("empKpis").innerHTML = `<div class="kpi"><span>Datos de empleo no disponibles todavía.</span></div>`; return; }
  const UOM = Object.keys(O.grupos).filter(g => g !== "3410");
  const Q = O.trimestres, iRef = Q.indexOf("2023T4"), iUlt = Q.length - 1;
  const sumArea = (a, k, i) => UOM.reduce((x, g) => x + (a.grupos[g] ? a.grupos[g][k][i] : 0), 0);
  const nacQ = i => Object.values(O.areas).reduce((x, a) => x + sumArea(a, "trim", i), 0);
  const nacA = i => Object.values(O.areas).reduce((x, a) => x + sumArea(a, "anual", i), 0);
  const anual = O.anios.map((y, i) => ({ y, v: nacA(i) }));
  const ref = nacQ(iRef), ult = nacQ(iUlt), dif = ult - ref, pico = anual.reduce((m, x) => x.v > m.v ? x : m);
  $("empKpis").innerHTML = [[fmt(ult), `puestos metalúrgicos registrados, ${trimTxt(Q[iUlt])}`, ""], [(dif > 0 ? "+" : "") + fmt(dif), `puestos desde el ${trimTxt(Q[iRef])}`, dif < 0 ? "bad" : ""],
    [dec((ult / ref - 1) * 100) + "%", "variación en el mismo período", dif < 0 ? "bad" : ""], [fmt(pico.v), `máximo de la serie, promedio ${pico.y}`, ""]].map(([b, l, c]) => `<div class="kpi ${c}"><b>${b}</b><span>${l}</span></div>`).join("");
  // histórico
  const W = 620, H = 260, l = 54, r = 20, t = 18, b = 30, xs = anual.length, maxv = 320000;
  const X = i => l + i * (W - l - r) / xs, Yv = v => t + (1 - v / maxv) * (H - t - b);
  const ink = cssv("--ink"), mut = cssv("--muted"), line = cssv("--line"), acc = cssv("--steel"), mol = cssv("--molten");
  let h = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Empleo metalúrgico registrado 1996 a ${Q[iUlt]}">`;
  for (const v of [0, 100000, 200000, 300000]) h += `<line x1="${l}" x2="${W - r}" y1="${Yv(v)}" y2="${Yv(v)}" stroke="${line}"/><text x="${l - 6}" y="${Yv(v) + 4}" font-size="11" text-anchor="end" fill="${mut}">${v / 1000} mil</text>`;
  anual.forEach((a, i) => { const hl = a.y === 2002 || a.y === pico.y; h += `<rect x="${X(i) + 1}" y="${Yv(a.v)}" width="${(W - l - r) / xs - 3}" height="${Yv(0) - Yv(a.v)}" fill="${hl ? mol : acc}" fill-opacity="${hl ? 1 : .75}"><title>${a.y}: ${fmt(a.v)}</title></rect>`;
    if ((a.y % 4 === 0 && a.y < 2023) || a.y === 2025) h += `<text x="${X(i) + (W - l - r) / xs / 2}" y="${H - 10}" font-size="11" text-anchor="middle" fill="${mut}">${a.y}</text>`; });
  const i02 = anual.findIndex(a => a.y === 2002), ip = anual.findIndex(a => a.y === pico.y);
  h += `<text x="${X(i02) + (W - l - r) / xs / 2}" y="${Yv(Math.max(anual[i02 - 1].v, anual[i02 + 1].v)) - 6}" font-size="11.5" font-weight="600" fill="${mol}" text-anchor="middle">${fmt(anual[i02].v)}</text><text x="${X(ip) + (W - l - r) / xs / 2}" y="${Yv(anual[ip].v) - 6}" font-size="11.5" font-weight="600" fill="${mol}" text-anchor="middle">${fmt(anual[ip].v)}</text>`;
  $("empHist").innerHTML = h + `</svg><p class="small muted" style="margin:6px 0 0">En naranja: el piso de la crisis de 2002 y el máximo de la serie. Último dato trimestral: ${fmt(ult)} puestos (${trimTxt(Q[iUlt])}).</p>`;
  // ramas
  const ramas = Object.entries(O.ramas).filter(([c, r]) => c !== "3410").map(([c, r]) => ({ c, d: r.descripcion, a: r.trim[iRef], b: r.trim[iUlt], dif: r.trim[iUlt] - r.trim[iRef] })).filter(r => r.a > 300);
  ramas.sort((x, y) => x.dif - y.dif); const sel = [...ramas.slice(0, 8), ...ramas.slice(-4).reverse()];
  const mx = Math.max(...sel.map(r => Math.abs(r.dif))), W2 = 620, lh = 28, H2 = sel.length * lh + 16, mid = 400, half = 190;
  const corto = d => { d = d.replace(/^Fabricación de /, "").replace(/ n\.c\.p\./, ""); d = d[0].toUpperCase() + d.slice(1); return d.length > 46 ? d.slice(0, 45) + "…" : d; };
  let rb = `<svg viewBox="0 0 ${W2} ${H2}" width="100%" role="img" aria-label="Variación del empleo por rama">`;
  rb += `<line x1="${mid}" x2="${mid}" y1="4" y2="${H2 - 8}" stroke="${mut}"/>`;
  sel.forEach((r, i) => { const y = 8 + i * lh, w = half * Math.abs(r.dif) / mx, neg = r.dif < 0, c = neg ? cssv("--bad") : cssv("--ok");
    rb += `<text x="${neg ? mid - w - 6 : mid - 6}" y="${y + 14}" font-size="11.5" text-anchor="end" fill="${ink}">${esc(corto(r.d))}</text>`;
    rb += `<rect x="${neg ? mid - w : mid}" y="${y + 3}" width="${w}" height="16" rx="2" fill="${c}"><title>${esc(r.d)}: ${fmt(r.a)} → ${fmt(r.b)}</title></rect>`;
    rb += `<text x="${neg ? mid + 6 : mid + w + 6}" y="${y + 15}" font-size="11.5" font-family="IBM Plex Mono,monospace" fill="${c}">${r.dif > 0 ? "+" : ""}${fmt(r.dif)} (${dec((r.b / r.a - 1) * 100)}%)</text>`; });
  $("empRamas").innerHTML = rb + "</svg>"; $("empRamasSub").textContent = `Puestos ganados o perdidos entre el ${trimTxt(Q[iRef])} y el ${trimTxt(Q[iUlt])} · ramas con más de 300 puestos`;
  // provincias
  const filas = Object.entries(O.areas).map(([k, a]) => ({ k, n: a.nombre, a: sumArea(a, "trim", iRef), b: sumArea(a, "trim", iUlt), sd: UOM.reduce((x, g) => x + (a.grupos[g] ? a.grupos[g].celdas_sd : 0), 0) })).sort((x, y) => y.b - x.b);
  $("empProv").innerHTML = `<table><thead><tr><th>Provincia o área</th><th class="n">${trimTxt(Q[iRef])}</th><th class="n">${trimTxt(Q[iUlt])}</th><th class="n">Diferencia</th><th class="n">Var. %</th><th>Peso</th></tr></thead><tbody>${filas.map(f => { const v = f.a ? (f.b / f.a - 1) * 100 : 0, c = v < -0.5 ? "var(--bad)" : v > 0.5 ? "var(--ok)" : "var(--muted)"; return `<tr><td>${esc(f.n)}${f.sd >= 6 && f.b < 5000 ? ` <span class="small muted" title="Varias ramas con secreto estadístico">*</span>` : ""}</td><td class="n">${fmt(f.a)}</td><td class="n">${fmt(f.b)}</td><td class="n" style="color:${c}">${f.b - f.a > 0 ? "+" : ""}${fmt(f.b - f.a)}</td><td class="n" style="color:${c}">${dec(v)}%</td><td style="min-width:90px"><span style="display:block;height:8px;border-radius:2px;background:var(--steel);width:${(f.b / filas[0].b * 100).toFixed(1)}%"></span></td></tr>`; }).join("")}</tbody></table>`;
  $("empProvSub").textContent = "Puestos metalúrgicos registrados, universo UOM. Buenos Aires aparece separada en Partidos del GBA y resto de la provincia.";
  $("empNota").innerHTML = `* Provincias con varias ramas bajo secreto estadístico: la cifra es un piso y la variación puede no reflejar cambios reales. Fuente: <a href="${esc(O.url)}" target="_blank" rel="noopener">OEDE, Ministerio de Capital Humano</a>, sobre registros del SIPA. Actualizado ${esc(O.actualizado)}.`;
}


function conflictividad() {
  const C = S.conf; if (!C) return;
  const an = {}; for (const [m, c, h, j, ci, cd] of C.rows) { const y = +m.slice(0, 4), a = an[y] ??= { c: 0, ci: 0, cd: 0, n: 0 }; a.c += c; a.ci += ci; a.cd += cd; a.n++; }
  const ys = Object.keys(an).map(Number).filter(y => an[y].n === 12), W = 760, H = 250, l = 46, r = 20, t = 16, b = 30, mx = Math.ceil(Math.max(...ys.map(y => an[y].c)) / 100) * 100;
  const X = i => l + i * (W - l - r) / ys.length, bw = (W - l - r) / ys.length, Yv = v => t + (1 - v / mx) * (H - t - b);
  const mut = cssv("--muted"), line = cssv("--line");
  let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Conflictos con paro en el sector privado por año">`;
  for (const v of [0, mx / 2, mx]) s += `<line x1="${l}" x2="${W - r}" y1="${Yv(v)}" y2="${Yv(v)}" stroke="${line}"/><text x="${l - 6}" y="${Yv(v) + 4}" font-size="11" text-anchor="end" fill="${mut}">${v}</text>`;
  ys.forEach((y, i) => { const a = an[y];
    s += `<rect x="${X(i) + 2}" y="${Yv(a.c)}" width="${bw - 4}" height="${Yv(0) - Yv(a.c)}" fill="${cssv("--steel")}" fill-opacity=".35"><title>${y}: ${a.c} conflictos con paro en el sector privado</title></rect>`;
    s += `<rect x="${X(i) + 2}" y="${Yv(a.ci)}" width="${bw - 4}" height="${Yv(0) - Yv(a.ci)}" fill="${cssv("--steel")}"><title>${y}: ${a.ci} en la industria</title></rect>`;
    s += `<circle cx="${X(i) + bw / 2}" cy="${Yv(a.cd)}" r="4" fill="${cssv("--molten")}"><title>${y}: ${a.cd} por despidos</title></circle>`;
    if (y % 3 === 0 || y === ys.at(-1)) s += `<text x="${X(i) + bw / 2}" y="${H - 10}" font-size="11" text-anchor="middle" fill="${mut}">${y}</text>`; });
  s += `<polyline fill="none" stroke="${cssv("--molten")}" stroke-width="1.6" points="${ys.map((y, i) => `${X(i) + bw / 2},${Yv(an[y].cd)}`).join(" ")}"/>`;
  $("confChart").innerHTML = s + `</svg><div class="legend"><span><i style="background:var(--steel);opacity:.35"></i>Sector privado, total</span><span><i style="background:var(--steel)"></i>Industria manufacturera</span><span><i style="background:var(--molten);border-radius:50%"></i>Reclamo principal: despidos</span></div>`;
  const u = ys.at(-1), pk = ys.reduce((m, y) => an[y].c > an[m].c ? y : m, ys[0]);
  $("confNota").innerHTML = `En ${u} hubo ${an[u].c} conflictos con paro en el sector privado, el menor número de la serie que empieza en ${ys[0]} (el máximo fue ${an[pk].c}, en ${pk}). La fuente no abre la industria por rama, así que el dato industrial incluye todas las ramas. Fuente: <a href="${esc(C.url)}" target="_blank" rel="noopener">Ministerio de Capital Humano, conflictividad laboral</a>.`;
}

/* ---------- sector ---------- */
function linea(pts, unidad) {
  const W = 540, H = 190, l = 46, r = 18, t = 18, b = 30; const ys = pts.map(p => +p.valor);
  let lo = Math.min(...ys), hi = Math.max(...ys); if (unidad === "%") { lo = Math.min(lo, 0); } const pad = (hi - lo) * .15 || 1; lo = lo < 0 || unidad !== "%" ? lo - pad : lo; hi += pad;
  const X = i => l + (pts.length === 1 ? (W - l - r) / 2 : i * (W - l - r) / (pts.length - 1)), Y = v => t + (hi - v) / (hi - lo) * (H - t - b);
  const ink = cssv("--ink"), mut = cssv("--muted"), line = cssv("--line"), acc = cssv("--steel");
  let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img">`;
  for (const v of [lo, (lo + hi) / 2, hi]) s += `<line x1="${l}" x2="${W - r}" y1="${Y(v)}" y2="${Y(v)}" stroke="${line}"/><text x="${l - 6}" y="${Y(v) + 4}" font-size="11" text-anchor="end" fill="${mut}">${dec(v, Math.abs(hi - lo) < 30 ? 1 : 0)}</text>`;
  if (lo < 0 && hi > 0) s += `<line x1="${l}" x2="${W - r}" y1="${Y(0)}" y2="${Y(0)}" stroke="${mut}" stroke-width="1.2"/>`;
  const path = pts.map((p, i) => `${X(i)},${Y(+p.valor)}`).join(" ");
  s += `<polygon points="${l},${Y(Math.max(lo, Math.min(0, hi)))} ${path} ${X(pts.length - 1)},${Y(Math.max(lo, Math.min(0, hi)))}" fill="${acc}" fill-opacity=".08"/>`;
  s += `<polyline fill="none" stroke="${acc}" stroke-width="2.4" stroke-linejoin="round" points="${path}"/>`;
  pts.forEach((p, i) => { const last = i === pts.length - 1; s += `<circle cx="${X(i)}" cy="${Y(+p.valor)}" r="${last ? 5 : 3.2}" fill="${last ? cssv("--molten") : acc}" stroke="${cssv("--panel")}" stroke-width="1.5"><title>${mesTxt(p.periodo)}: ${dec(p.valor)} ${unidad}</title></circle>`;
    if (pts.length <= 9 || i % Math.ceil(pts.length / 8) === 0 || last) s += `<text x="${X(i)}" y="${H - 9}" font-size="11" text-anchor="middle" fill="${mut}">${mesTxt(p.periodo)}</text>`; });
  return s + "</svg>";
}
function sector() {
  const ord = ["adimra-actividad", "adimra-capacidad", "indec-uci-metalmecanica", "indec-uci-metalicas", "indec-uci-automotriz", "caa-acero-crudo"];
  const ss = S.series.filter(s => s.datos && s.datos.length).sort((a, b) => ((ord.indexOf(a.clave) + 1) || 99) - ((ord.indexOf(b.clave) + 1) || 99));
  $("series").innerHTML = ss.map(s => { const d = s.datos.slice().sort((a, b) => a.periodo.localeCompare(b.periodo)), u = d.at(-1); const fts = [...new Map(d.filter(x => x.url).map(x => [x.url, x])).values()].slice(-3);
    return `<div class="card serie"><div class="row" style="justify-content:space-between"><span class="badge ${s.auto ? "auto" : "manual"}">${s.auto ? "automática" : "carga mensual"}</span><span class="small muted">${esc(s.organismo || "")}</span></div>
    <h4 style="font-size:16px;margin:0">${esc(s.nombre)}</h4><div class="row" style="gap:10px;align-items:baseline"><span class="big">${dec(u.valor)}${s.unidad === "%" ? "%" : ""}</span><span class="small muted">${s.unidad !== "%" ? esc(s.unidad) + " · " : ""}${mesTxt(u.periodo)}</span></div>
    ${linea(d.slice(-24), s.unidad)}<p class="small muted" style="margin:0">Fuente: ${s.auto ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">API Series de Tiempo, serie ${esc(s.idSerie)}</a>` : fts.map(x => `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.fuente)} (${mesTxt(x.periodo)})</a>`).join(" · ")}</p></div>`; }).join("") || `<div class="empty">Sin series cargadas.</div>`;
}

/* ---------- fuentes y modelo ---------- */
function fuentes() {
  const est = { "automático": "auto", "manual": "manual", "próximo": "prox", "listo": "listo" };
  $("srcGrid").innerHTML = S.fuentes.fuentes.map(f => `<div class="card src-card"><div class="row" style="justify-content:space-between"><span class="badge ${est[f.estado]}">${esc(f.estado)}</span><span class="small muted">${esc(f.frecuencia)}</span></div>
   <h4 style="font-size:16px;margin:0">${f.url ? `<a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.nombre)}</a>` : esc(f.nombre)}</h4>
   <p class="small muted" style="margin:0">${esc(f.tipo)} · ${esc(f.conexion)} · nivel: ${esc(f.nivel)}</p><ul>${f.variables.map(v => `<li>${esc(v)}</li>`).join("")}</ul></div>`).join("");
  const box = (x, y, w, t, sub, campos, acc) => `<g><rect x="${x}" y="${y}" width="${w}" height="${44 + campos.length * 17}" rx="8" fill="${acc ? "var(--molten-soft)" : "var(--panel)"}" stroke="${acc ? "var(--molten)" : "var(--steel)"}" stroke-width="${acc ? 2 : 1.3}"/><text x="${x + 12}" y="${y + 22}" font-family="Barlow Condensed,sans-serif" font-weight="700" font-size="17" fill="var(--ink)" letter-spacing=".5">${t}</text><text x="${x + 12}" y="${y + 37}" font-size="10.5" fill="var(--muted)">${sub}</text>${campos.map((c, i) => `<text x="${x + 12}" y="${y + 56 + i * 17}" font-size="11.5" font-family="IBM Plex Mono,monospace" fill="var(--ink)">${c}</text>`).join("")}</g>`;
  const ar = (d) => `<path d="${d}" fill="none" stroke="var(--muted)" stroke-width="1.3" marker-end="url(#fl)"/>`;
  $("modelo").innerHTML = `<svg viewBox="0 0 1000 470" style="min-width:820px;width:100%" role="img" aria-label="Modelo de datos del observatorio"><defs><marker id="fl" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(--muted)"/></marker></defs>
   ${box(360, 20, 270, "PLANTA", "una fábrica · carga UOM", ["id, nombre, empresa, rama", "provincia, partido, localidad", "seccional → SECCIONAL", "lat, lon, convenio"], true)}
   ${box(20, 20, 270, "SECCIONAL", "unidad territorial UOM", ["nombre, provincia", "partidos que abarca", "responsable de datos"])}
   ${box(700, 20, 280, "REPORTE MENSUAL", "una planta × un mes", ["planta → PLANTA, periodo", "dotación, producción, unidad", "capacidad %, horas", "suspendidos, contratados"])}
   ${box(700, 250, 280, "HECHO", "algo que pasó, con fecha y fuente", ["planta → PLANTA, fecha, tipo", "despidos · suspensiones · cierre", "retiros · conflicto", "cantidad, fuente, enlace"])}
   ${box(360, 250, 270, "ESTABLECIMIENTO CEP XXI", "padrón oficial, sin nombre", ["lat, lon, clae6 (rama)", "tramo de empleo", "provincia, departamento"])}
   ${box(20, 250, 270, "INDICADOR", "serie nacional mensual", ["serie, periodo, valor, unidad", "INDEC (API) · ADIMRA", "Cámara del Acero · SIPA"])}
   ${ar("M290 60 H356")}${ar("M630 70 H696")}${ar("M560 154 C 620 200, 660 260, 696 290")}
   <path d="M495 154 V246" stroke="var(--molten)" stroke-width="1.6" stroke-dasharray="5 4" fill="none"/><text x="485" y="205" font-size="11.5" fill="var(--molten)" font-weight="600" text-anchor="end">cruce por ubicación y rama</text>
   <path d="M290 300 H356" stroke="var(--muted)" stroke-width="1.3" stroke-dasharray="5 4" fill="none"/><text x="296" y="292" font-size="11" fill="var(--muted)">contexto</text>
   <text x="20" y="440" font-size="12.5" fill="var(--muted)">Línea llena: relación directa entre registros. Punteada: cruce analítico (misma zona y rama, o el indicador que le da contexto al dato de planta).</text></svg>`;
}

/* ---------- carga ---------- */
function opcPlantas(sel) { return `<option value="">Elegí una planta</option>` + S.plantas.slice().sort((a, b) => a.nombre.localeCompare(b.nombre, "es")).map(p => `<option value="${esc(p.id)}"${p.id === sel ? " selected" : ""}>${esc(p.nombre)} · ${esc(p.localidad || p.provincia)}</option>`).join(""); }
function formularios() {
  const modo = sb ? `<p class="note">Conectado a la base de datos: lo que guardes queda disponible para toda la organización.</p>` :
    `<div class="empty" style="font-size:13px"><b>Modo borrador.</b> La base de datos compartida todavía no está configurada, así que lo que cargues queda guardado solo en este navegador. Podés exportarlo para sumarlo al repositorio. Para activar la carga compartida, seguí los pasos de <code>docs/supabase.sql</code> y completá <code>js/config.js</code>.</div>`;
  $("p-cargar").innerHTML = `${modo}
  <div class="row" id="ftabs"><button class="chip" type="button" aria-pressed="true" data-f="rep">Reporte mensual</button><button class="chip" type="button" aria-pressed="false" data-f="ev">Hecho</button><button class="chip" type="button" aria-pressed="false" data-f="np">Nueva planta</button><button class="chip" type="button" aria-pressed="false" data-f="ind">Indicador</button>${sb ? "" : `<button class="chip" type="button" id="bExport" style="margin-left:auto">Exportar borradores (JSON)</button>`}</div>
  <form class="form" id="f-rep"><p class="note">La situación de una planta en un mes. Completá lo que sepas.</p>
   <label class="f" for="r_planta">Planta<select id="r_planta" required>${opcPlantas(S.sel)}</select></label>
   <div class="grid2"><label class="f" for="r_per">Mes<input id="r_per" type="month" required value="${hoy().slice(0, 7)}"></label><label class="f" for="r_dot">Dotación total<input id="r_dot" type="number" min="0" inputmode="numeric"></label><label class="f" for="r_cap">Capacidad usada (%)<input id="r_cap" type="number" min="0" max="100" step="0.1"></label><label class="f" for="r_susp">Suspendidos<input id="r_susp" type="number" min="0"></label><label class="f" for="r_prod">Producción del mes<input id="r_prod" type="number" min="0" step="any"></label><label class="f" for="r_uni">Unidad<input id="r_uni" placeholder="toneladas, unidades"></label><label class="f" for="r_hs">Horas trabajadas<input id="r_hs" type="number" min="0"></label><label class="f" for="r_con">Contratados o eventuales<input id="r_con" type="number" min="0"></label></div>
   <label class="f" for="r_nota">Observaciones<textarea id="r_nota" placeholder="Turnos reducidos, falta de insumos, importaciones que compiten"></textarea></label><button class="btn pri" type="submit">Guardar reporte</button></form>
  <form class="form" id="f-ev" hidden><p class="note">Un hecho concreto con fecha. Solo cantidades, nunca nombres.</p>
   <label class="f" for="e_planta">Planta<select id="e_planta" required>${opcPlantas(S.sel)}</select></label>
   <div class="grid2"><label class="f" for="e_tipo">Tipo<select id="e_tipo">${Object.entries(TIPOS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></label><label class="f" for="e_fecha">Fecha<input id="e_fecha" type="date" required value="${hoy()}"></label><label class="f" for="e_cant">Trabajadores afectados<input id="e_cant" type="number" min="0"></label><label class="f" for="e_fte">Fuente<input id="e_fte" placeholder="Delegado, acta, Ministerio, prensa"></label></div>
   <label class="f" for="e_url">Enlace (opcional)<input id="e_url" type="url" placeholder="https://"></label><label class="f" for="e_nota">Detalle<textarea id="e_nota"></textarea></label><button class="btn pri" type="submit">Guardar hecho</button></form>
  <form class="form" id="f-np" hidden><div class="grid2"><label class="f" for="np_nom">Nombre de la planta<input id="np_nom" required></label><label class="f" for="np_emp">Empresa<input id="np_emp"></label><label class="f" for="np_rama">Rama<select id="np_rama">${RAMAS.map(r => `<option>${r}</option>`).join("")}</select></label><label class="f" for="np_prov">Provincia<select id="np_prov">${Object.keys(S.geo.p).sort((a, b) => a.localeCompare(b, "es")).map(p => `<option>${p}</option>`).join("")}</select></label><label class="f" for="np_part">Partido o departamento<input id="np_part"></label><label class="f" for="np_loc">Localidad<input id="np_loc"></label><label class="f" for="np_sec">Seccional UOM<input id="np_sec"></label><label class="f" for="np_lat">Latitud<input id="np_lat" type="number" step="any" required></label><label class="f" for="np_lon">Longitud<input id="np_lon" type="number" step="any" required></label></div>
   <div class="row"><button class="btn" type="button" id="bPick">Marcar ubicación en el mapa</button><button class="btn pri" type="submit">Guardar planta</button></div></form>
  <form class="form" id="f-ind" hidden><p class="note">Un dato mensual de una serie del sector, por ejemplo el informe de ADIMRA o de la Cámara del Acero.</p>
   <label class="f" for="i_serie">Serie<select id="i_serie">${S.series.filter(s => !s.auto).map(s => `<option value="${esc(s.clave)}">${esc(s.nombre)}</option>`).join("")}</select></label>
   <div class="grid2"><label class="f" for="i_per">Mes<input id="i_per" type="month" required></label><label class="f" for="i_val">Valor<input id="i_val" type="number" step="any" required></label><label class="f" for="i_fte">Fuente<input id="i_fte" placeholder="ADIMRA, informe mensual"></label><label class="f" for="i_url">Enlace<input id="i_url" type="url"></label></div><button class="btn pri" type="submit">Guardar indicador</button></form>`;
  $("ftabs").querySelectorAll("[data-f]").forEach(b => b.onclick = () => { $("ftabs").querySelectorAll("[data-f]").forEach(x => x.setAttribute("aria-pressed", x === b)); for (const f of ["rep", "ev", "np", "ind"]) $("f-" + f).hidden = f !== b.dataset.f; });
  if ($("bExport")) $("bExport").onclick = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(leerBorr(), null, 1)], { type: "application/json" })); a.download = `borradores-observatorio-${hoy()}.json`; a.click(); };
  $("bPick").onclick = () => { S.picking = true; $("mapbox").classList.add("picking"); $("mapa").scrollIntoView({ behavior: "smooth" }); toast("Tocá el mapa donde está la planta"); };
  const num = id => $(id).value === "" ? null : +$(id).value, txt = id => $(id).value.trim();
  const ok = async (fn, form, msg) => { const b = form.querySelector("button[type=submit]"); b.disabled = true; try { await fn(); toast(msg); form.querySelectorAll("input:not([type=month]):not([type=date]),textarea").forEach(i => { if (!["np_lat", "np_lon"].includes(i.id) || form.id === "f-np") i.value = ""; }); refrescar(); } catch (e) { console.warn(e); toast("No se pudo guardar: " + (e.message || "error")); } finally { b.disabled = false; } };
  const slug = s => norm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  $("f-rep").onsubmit = e => { e.preventDefault(); const p = $("r_planta").value; if (!p) return toast("Elegí una planta"); ok(() => guardar("reportes", { id: `${p}_${$("r_per").value}`, plantaId: p, periodo: $("r_per").value, dotacion: num("r_dot"), capacidad: num("r_cap"), suspendidos: num("r_susp"), produccion: num("r_prod"), unidad: txt("r_uni"), horas: num("r_hs"), contratados: num("r_con"), nota: txt("r_nota"), cargado: new Date().toISOString() }), e.target, "Reporte guardado"); };
  $("f-ev").onsubmit = e => { e.preventDefault(); const p = $("e_planta").value; if (!p) return toast("Elegí una planta"); ok(() => guardar("eventos", { id: `${p}-${$("e_fecha").value}-${$("e_tipo").value}-${Date.now().toString(36)}`, plantaId: p, tipo: $("e_tipo").value, fecha: $("e_fecha").value, cantidad: num("e_cant"), fuente: txt("e_fte"), url: txt("e_url"), nota: txt("e_nota"), cargado: new Date().toISOString() }), e.target, "Hecho guardado"); };
  $("f-np").onsubmit = e => { e.preventDefault(); ok(() => guardar("plantas", { id: slug(txt("np_nom") + "-" + txt("np_loc")), nombre: txt("np_nom"), empresa: txt("np_emp"), rama: $("np_rama").value, provincia: $("np_prov").value, partido: txt("np_part"), localidad: txt("np_loc"), seccional: txt("np_sec"), lat: num("np_lat"), lon: num("np_lon"), convenio: "CCT 260/75", ubicacion: "marcada", seccional_confirmada: true }), e.target, "Planta guardada"); };
  $("f-ind").onsubmit = e => { e.preventDefault(); const s = S.series.find(x => x.clave === $("i_serie").value); ok(() => guardar("indicadores", { id: `${s.clave}-${$("i_per").value}`, serie: s.clave, nombre: s.nombre, unidad: s.unidad, periodo: $("i_per").value, valor: num("i_val"), fuente: txt("i_fte"), url: txt("i_url") }), e.target, "Indicador guardado"); };
}
function irForm(f) { $("cargar").scrollIntoView({ behavior: "smooth" }); $("r_planta").value = S.sel; $("e_planta").value = S.sel; $("ftabs").querySelector(`[data-f="${f}"]`).click(); }

/* ---------- arranque ---------- */
function refrescar() { filtros(); kpis(); dibujarPuntos(); dibujarEst(); ficha(); tab(S.tab); sector(); empleo(); conflictividad(); }
await cargar();
portada(); baseMapa(); filtros(); fuentes(); formularios();
for (const n of ["informe", "plantas", "ramas"]) $("t-" + n).onclick = () => tab(n);
for (const id of ["fReg", "fProv", "fSec", "fRama"]) $(id).onchange = () => {
  if (id === "fReg") { $("fProv").value = ""; $("fSec").value = ""; } if (id === "fProv") $("fSec").value = "";
  refrescar(); const pv = $("fProv").value; if (pv) { const el = document.querySelector(`.prov[data-name="${pv}"]`); const bb = el.getBBox(); setVB(fitBox(...unproj(bb.x, bb.y + bb.height), ...unproj(bb.x + bb.width, bb.y))); }
  else if ($("fReg").value) { const p = PRESETS.find(x => x[0] === $("fReg").value); if (p) setVB(fitBox(...p[1])); }
};
$("fClear").onclick = () => { for (const id of ["fReg", "fProv", "fSec", "fRama"]) $(id).value = ""; refrescar(); setVB(fitBox(...PRESETS[0][1])); };
refrescar(); setVB(fitBox(...PRESETS[0][1]));
$("pieEstado").textContent = `Plantas: ${S.actualizado.plantas || "—"} · Indicadores: ${S.actualizado.indicadores || "—"} · Series automáticas: ${S.actualizado.auto || "pendiente de la primera corrida"} · Establecimientos CEP XXI: ${S.actualizado.est || "pendiente de la primera corrida"}${sb ? " · Base compartida conectada" : ""}`;
const secs = ["mapa", "empleo", "sector", "fuentes", "cargar"].map(id => $(id));
addEventListener("scroll", () => { const y = scrollY + 90; let on = null; for (const s of secs) if (s.offsetTop <= y) on = s.id; document.querySelectorAll(".nav ul a").forEach(a => a.classList.toggle("on", a.getAttribute("href") === "#" + on)); }, { passive: true });
