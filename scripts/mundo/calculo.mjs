// Cálculos del módulo «Argentina frente al mundo». Funciones puras, sin red: se prueban con node --test.
//
// Método:
//  - Para cada indicador se toma el último valor de cada país dentro de una ventana de años (por defecto, 3),
//    para no dejar afuera a los países que publican con demora.
//  - Se ordena a los países según si es mejor un valor alto o bajo, y se calcula el puesto de la Argentina
//    y su percentil: qué parte de los países queda peor que ella (100 = la mejor, 0 = la peor).
//  - El promedio por área es el promedio simple de los percentiles de sus indicadores. El índice general es el
//    promedio de las áreas. No se suman valores de indicadores distintos: solo posiciones.
//  - En las series argentinas largas se marca si el último dato es el mínimo histórico.

/** Último valor de cada país con año entre (anioMax - ventana + 1) y anioMax. valores: {ISO3: {anio: valor}} */
export function ultimosValores(valores, anioMax, ventana = 3) {
  const out = {};
  for (const [pais, serie] of Object.entries(valores)) {
    for (let a = anioMax; a > anioMax - ventana; a--) {
      const v = serie[a];
      if (v != null && Number.isFinite(v)) { out[pais] = { valor: v, anio: a }; break; }
    }
  }
  return out;
}

/** El año más reciente en el que hay al menos `minimo` países con dato. */
export function anioDeReferencia(valores, minimo = 40) {
  const conteo = {};
  for (const serie of Object.values(valores))
    for (const [a, v] of Object.entries(serie)) if (v != null && Number.isFinite(v)) conteo[a] = (conteo[a] || 0) + 1;
  const anios = Object.keys(conteo).map(Number).filter(a => conteo[a] >= minimo).sort((x, y) => y - x);
  return anios[0] ?? null;
}

/** Puesto y percentil de un país. mejor: "alto" | "bajo". */
export function posicion(ultimos, pais, mejor = "alto") {
  const lista = Object.entries(ultimos).map(([p, d]) => ({ pais: p, ...d }));
  if (!ultimos[pais] || lista.length < 2) return null;
  lista.sort((a, b) => (mejor === "alto" ? b.valor - a.valor : a.valor - b.valor));
  const yo = ultimos[pais].valor;
  // Los empates comparten el mejor puesto.
  const mejores = lista.filter(d => (mejor === "alto" ? d.valor > yo : d.valor < yo)).length;
  const peores = lista.filter(d => (mejor === "alto" ? d.valor < yo : d.valor > yo)).length;
  return {
    puesto: mejores + 1,
    total: lista.length,
    percentil: Math.round((peores / (lista.length - 1)) * 1000) / 10,
    valor: yo,
    anio: ultimos[pais].anio,
    mediana: mediana(lista.map(d => d.valor)),
    primero: lista[0],
    ultimo: lista[lista.length - 1],
  };
}

export function mediana(xs) {
  const s = [...xs].sort((a, b) => a - b);
  if (!s.length) return null;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Situación de una serie en su propia historia. serie: [{periodo, valor}] en orden cualquiera. */
export function historia(serie, mejor = "alto") {
  const s = serie.filter(d => d.valor != null && Number.isFinite(d.valor)).sort((a, b) => (a.periodo < b.periodo ? -1 : 1));
  if (!s.length) return null;
  const ult = s[s.length - 1];
  const peorValor = mejor === "alto" ? Math.min(...s.map(d => d.valor)) : Math.max(...s.map(d => d.valor));
  const peorDato = s.find(d => d.valor === peorValor);
  const mejorValor = mejor === "alto" ? Math.max(...s.map(d => d.valor)) : Math.min(...s.map(d => d.valor));
  const ordenados = [...s].sort((a, b) => (mejor === "alto" ? a.valor - b.valor : b.valor - a.valor));
  const lugar = ordenados.findIndex(d => d.periodo === ult.periodo) + 1; // 1 = el peor de la serie
  return {
    desde: s[0].periodo, hasta: ult.periodo, datos: s.length, ultimo: ult.valor,
    peor: { valor: peorValor, periodo: peorDato.periodo },
    mejor: { valor: mejorValor, periodo: s.find(d => d.valor === mejorValor).periodo },
    esPeorHistorico: lugar === 1,
    lugarEntreLosPeores: lugar,
  };
}

/** Promedio de percentiles por área y general. filas: [{area, percentil}] */
export function promedios(filas, areas) {
  const porArea = {};
  for (const k of Object.keys(areas)) {
    const ps = filas.filter(f => f.area === k && f.percentil != null).map(f => f.percentil);
    porArea[k] = ps.length ? { nombre: areas[k], percentil: redondear(ps.reduce((a, b) => a + b, 0) / ps.length), indicadores: ps.length } : { nombre: areas[k], percentil: null, indicadores: 0 };
  }
  const validas = Object.values(porArea).filter(a => a.percentil != null);
  const general = validas.length ? redondear(validas.reduce((a, b) => a + b.percentil, 0) / validas.length) : null;
  return { porArea, general };
}

const redondear = x => Math.round(x * 10) / 10;

/** Lectura en palabras de un percentil, para todo público. */
export function lectura(p) {
  if (p == null) return "sin datos";
  if (p < 10) return "entre los peores del mundo";
  if (p < 25) return "muy por debajo de la mayoría";
  if (p < 45) return "por debajo de la mitad";
  if (p <= 55) return "en la mitad de la tabla";
  if (p < 75) return "por encima de la mitad";
  if (p < 90) return "muy por encima de la mayoría";
  return "entre los mejores del mundo";
}

/** Convierte la respuesta del Banco Mundial (página 2 de la API v2) en {ISO3: {anio: valor}}, sin agregados. */
export function leerBancoMundial(filas, paisesValidos) {
  const out = {};
  for (const f of filas || []) {
    const iso = f.countryiso3code;
    if (!iso || (paisesValidos && !paisesValidos.has(iso) && iso !== "WLD")) continue;
    if (f.value == null) continue;
    (out[iso] ||= {})[+f.date] = +f.value;
  }
  return out;
}

/** Convierte la respuesta del FMI DataMapper en {ISO3: {anio: valor}}, solo años cerrados (< anioActual). */
export function leerFmi(json, codigo, anioActual, paisesValidos) {
  const out = {};
  const datos = json?.values?.[codigo] || {};
  for (const [iso, serie] of Object.entries(datos)) {
    if (paisesValidos && !paisesValidos.has(iso)) continue;
    for (const [a, v] of Object.entries(serie)) if (+a < anioActual && v != null) (out[iso] ||= {})[+a] = +v;
  }
  return out;
}

// ---- Regiones para comparar ----
const SUDAMERICA = ["ARG", "BOL", "BRA", "CHL", "COL", "ECU", "GUY", "PRY", "PER", "SUR", "URY", "VEN"];
const NORTEAMERICA = ["USA", "CAN", "MEX"];
const NORTE_AFRICA = ["DZA", "EGY", "LBY", "MAR", "TUN"];
const ASIA_CENTRAL = ["KAZ", "KGZ", "TJK", "TKM", "UZB", "AFG"];
const OCEANIA = ["AUS", "NZL", "PNG", "FJI", "SLB", "VUT", "WSM", "TON", "KIR", "FSM", "MHL", "PLW", "NRU", "TUV"];
export const GRUPOS_FIJOS = {
  mercosur: { nombre: "Mercosur", paises: ["ARG", "BRA", "PRY", "URY", "BOL"] },
  g20: { nombre: "G20", paises: ["ARG", "AUS", "BRA", "CAN", "CHN", "FRA", "DEU", "IND", "IDN", "ITA", "JPN", "KOR", "MEX", "RUS", "SAU", "ZAF", "TUR", "GBR", "USA"] },
};

/** Región de cada país a partir de la región del Banco Mundial (id) y su código. */
export function regionDe(iso, regionBM) {
  if (SUDAMERICA.includes(iso)) return "sudamerica";
  if (NORTEAMERICA.includes(iso)) return "norteamerica";
  if (regionBM === "LCN") return "centroamerica";
  if (OCEANIA.includes(iso)) return "oceania";
  if (iso === "TUR") return "medio_oriente";
  if (NORTE_AFRICA.includes(iso) || regionBM === "SSF") return "africa";
  if (regionBM === "MEA") return "medio_oriente";
  if (ASIA_CENTRAL.includes(iso) || regionBM === "EAS" || regionBM === "SAS") return "asia";
  if (regionBM === "ECS") return "europa";
  if (regionBM === "NAC") return "norteamerica";
  return "otros";
}

export const REGIONES = {
  mundo: "Todo el mundo",
  sudamerica: "América del Sur",
  centroamerica: "América Central y el Caribe",
  norteamerica: "América del Norte",
  europa: "Europa",
  medio_oriente: "Medio Oriente y Asia Menor (incluye Turquía)",
  africa: "África",
  asia: "Asia (China, Japón, Corea, India, Sudeste y Asia Central)",
  oceania: "Oceanía (Australia, Nueva Zelanda y el Pacífico)",
  mercosur: "Mercosur",
  g20: "G20",
};

/** Puesto de un país dentro de un grupo de países (lista de ISO3), con el mismo criterio que posicion(). */
export function posicionEnGrupo(ultimos, pais, mejor, grupo) {
  const g = new Set(grupo);
  g.add(pais); // la Argentina siempre entra en la comparación
  const sub = Object.fromEntries(Object.entries(ultimos).filter(([k]) => g.has(k)));
  return posicion(sub, pais, mejor);
}

// ---- Lectores de otras fuentes ----

/** CSV simple con comillas (lo que devuelve la OIT). Devuelve una lista de objetos por fila. */
export function leerCsv(texto) {
  const filas = [];
  let campo = "", fila = [], comillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (comillas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') comillas = false;
      else campo += c;
    } else if (c === '"') comillas = true;
    else if (c === ",") { fila.push(campo); campo = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      fila.push(campo); campo = "";
      if (fila.length > 1 || fila[0] !== "") filas.push(fila);
      fila = [];
    } else campo += c;
  }
  if (campo !== "" || fila.length) { fila.push(campo); filas.push(fila); }
  const [cab, ...resto] = filas;
  return resto.map(f => Object.fromEntries(cab.map((k, i) => [k, f[i]])));
}

/** Datos de la OIT (rplumber CSV) → {ISO3: {anio: valor}}. Solo años cerrados. */
export function leerOit(texto, anioActual, paisesValidos) {
  const out = {};
  for (const f of leerCsv(texto)) {
    const iso = f.ref_area, a = +f.time, v = parseFloat(f.obs_value);
    if (!iso || !Number.isFinite(v) || !(a < anioActual)) continue;
    if (paisesValidos && !paisesValidos.has(iso)) continue;
    (out[iso] ||= {})[a] = v;
  }
  return out;
}

/** Variación porcentual en `anios` años de cada serie (para comparar cuánto cambió el empleo, por ejemplo). */
export function cambioEnAnios(valores, anios = 2) {
  const out = {};
  for (const [pais, serie] of Object.entries(valores)) {
    for (const [a, v] of Object.entries(serie)) {
      const antes = serie[+a - anios];
      if (antes != null && antes !== 0) (out[pais] ||= {})[+a] = Math.round(((v / antes) - 1) * 10000) / 100;
    }
  }
  return out;
}

const PREFERIDOS = /^(total|ambos sexos|nacional|total nacional|total país|total pais)$/i;

/** Datos de CEPALSTAT → {ISO3: {anio: valor}}.
 * `elegir` dice qué miembro tomar en cada corte, en orden de preferencia: {"Área geográfica": ["Nacional", "Urbana"]}.
 * Si un país no tiene el primero se usa el siguiente, y queda anotado en `usados` (p. ej. la Argentina solo urbana).
 * En los cortes no nombrados se toma el total (ambos sexos, nacional) o el único miembro que haya. */
export function leerCepal(json, paisesValidos, elegir = {}, usados = {}) {
  const body = json?.body || {};
  const dims = body.dimensions || [];
  const nombre = {};
  let dimAnio = null;
  for (const d of dims) {
    for (const m of d.members || []) nombre[m.id] = m.name;
    if (/a[nñ]o/i.test(d.name)) dimAnio = d.id;
  }
  if (!dimAnio) throw new Error("CEPAL: no encuentro la dimensión de años");
  const dimPais = (dims.find(d => /pa[ií]s/i.test(d.name)) || {}).id;
  const otras = dims.filter(d => d.id !== dimAnio && d.id !== dimPais);
  const orden = {};
  for (const d of otras) {
    const clave = Object.keys(elegir).find(k => sinTildes(d.name).includes(sinTildes(k)));
    const ms = d.members || [];
    let ids;
    if (clave) ids = elegir[clave].map(n => (ms.find(m => sinTildes(m.name) === sinTildes(n)) || {}).id).filter(x => x != null);
    else { const t = ms.find(m => PREFERIDOS.test(String(m.name).trim())); ids = t ? [t.id] : ms.length === 1 ? [ms[0].id] : []; }
    orden[d.id] = ids;
  }
  const mejor = {};
  for (const f of body.data || []) {
    const iso = f.iso3 || isoDeNombre(nombre[f[`dim_${dimPais}`]]);
    if (!iso || (paisesValidos && !paisesValidos.has(iso))) continue;
    let rango = 0, ok = true;
    for (const d of otras) { const k = orden[d.id].indexOf(f[`dim_${d.id}`]); if (k < 0) { ok = false; break; } rango += k; }
    if (!ok) continue;
    const a = parseInt(nombre[f[`dim_${dimAnio}`]], 10), v = parseFloat(f.value);
    if (!Number.isFinite(a) || !Number.isFinite(v)) continue;
    const prev = mejor[iso]?.[a];
    if (!prev || rango < prev.rango) (mejor[iso] ||= {})[a] = { v, rango, f };
  }
  const out = {};
  for (const [iso, anios] of Object.entries(mejor)) for (const [a, x] of Object.entries(anios)) {
    (out[iso] ||= {})[a] = x.v;
    if (x.rango > 0) usados[iso] = otras.filter(d => orden[d.id].indexOf(x.f[`dim_${d.id}`]) > 0).map(d => nombre[x.f[`dim_${d.id}`]]).join(", ");
  }
  return out;
}

const sinTildes = t => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s*\(.*\)\s*/g, "").trim();
const LAC = {
  argentina: "ARG", bolivia: "BOL", brasil: "BRA", chile: "CHL", colombia: "COL", "costa rica": "CRI", cuba: "CUB",
  ecuador: "ECU", "el salvador": "SLV", guatemala: "GTM", haiti: "HTI", honduras: "HND", mexico: "MEX", nicaragua: "NIC",
  panama: "PAN", paraguay: "PRY", peru: "PER", "republica dominicana": "DOM", uruguay: "URY", venezuela: "VEN",
  jamaica: "JAM", "trinidad y tabago": "TTO", "trinidad y tobago": "TTO", barbados: "BRB", bahamas: "BHS", belice: "BLZ",
  guyana: "GUY", suriname: "SUR", granada: "GRD", dominica: "DMA", "santa lucia": "LCA", "antigua y barbuda": "ATG",
  "san vicente y las granadinas": "VCT", "saint kitts y nevis": "KNA",
};
/** Nombre de país de la CEPAL → ISO3 (solo América Latina y el Caribe). */
export const isoDeNombre = n => LAC[sinTildes(n)] || null;

/** Hoja del SIPA (filas como listas) → [{periodo:"AAAA-MM", valor}]. Acepta fechas, números de Excel y textos como "jul-26*". */
const MESES = { ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12 };
export function leerSipa(filas, columna) {
  const i = filas.findIndex(f => f.some(c => String(c ?? "").replace(/\s+/g, " ").trim() === columna));
  if (i < 0) throw new Error(`SIPA: no encuentro la columna «${columna}»`);
  const col = filas[i].findIndex(c => String(c ?? "").replace(/\s+/g, " ").trim() === columna);
  const out = [];
  for (const f of filas.slice(i + 1)) {
    const c = f[0], v = Number(f[col]);
    let a, m;
    if (c instanceof Date) { a = c.getUTCFullYear(); m = c.getUTCMonth() + 1; }
    else if (typeof c === "number" && c > 20000) { const d = new Date(Math.round((c - 25569) * 864e5)); a = d.getUTCFullYear(); m = d.getUTCMonth() + 1; }
    else { const r = /^([a-z]{3})-(\d{2})/i.exec(String(c ?? "").trim()); if (r && MESES[r[1].toLowerCase()]) { m = MESES[r[1].toLowerCase()]; a = 2000 + +r[2]; } }
    if (a && m && Number.isFinite(v) && f[col] !== null && f[col] !== "") out.push({ periodo: `${a}-${String(m).padStart(2, "0")}`, valor: +v.toFixed(3) });
  }
  return out;
}

/** Cuánto cambió una serie desde un período (p. ej. "2023-11") hasta el último dato. */
export function variacionDesde(datos, desde) {
  const base = datos.find(d => d.periodo >= desde), ult = datos[datos.length - 1];
  if (!base || !ult || base === ult) return null;
  return { desde: base.periodo, valorDesde: base.valor, hasta: ult.periodo, valorHasta: ult.valor,
    diferencia: +(ult.valor - base.valor).toFixed(3), porcentaje: base.valor ? +(((ult.valor / base.valor) - 1) * 100).toFixed(2) : null };
}
