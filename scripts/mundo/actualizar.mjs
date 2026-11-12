// Módulo «Argentina frente al mundo»: baja los indicadores del catálogo (scripts/mundo/indicadores.json),
// calcula el puesto y el percentil de la Argentina en cada uno, el promedio por área y los mínimos históricos,
// y guarda todo en data/mundo/indice.json. Corre una vez por mes en GitHub Actions (mundo.yml).
// Fuentes gratuitas y sin clave: Banco Mundial, FMI DataMapper, OIT (ILOSTAT), CEPAL (CEPALSTAT),
// API de Series de Tiempo (INDEC) y la planilla del SIPA que guarda el repo.
// Uso: node scripts/mundo/actualizar.mjs
import { readFile, writeFile, mkdir } from "node:fs/promises";
import {
  ultimosValores, anioDeReferencia, posicion, historia, promedios, lectura, leerBancoMundial, leerFmi,
  regionDe, REGIONES, GRUPOS_FIJOS, leerOit, leerCepal, cambioEnAnios, leerSipa, variacionDesde,
} from "./calculo.mjs";

const AQUI = new URL("./", import.meta.url);
const SALIDA = new URL("../../data/mundo/indice.json", import.meta.url);
const conf = JSON.parse(await readFile(new URL("indicadores.json", AQUI), "utf8"));
const informes = JSON.parse(await readFile(new URL("../../data/mundo/informes.json", import.meta.url), "utf8"));
const ANIO = new Date().getUTCFullYear();
const BM = "https://api.worldbank.org/v2";
const errores = [];

async function pedir(url, intentos = 5, texto = false) {
  for (let i = 1; ; i++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": "observatorio-uom/mundo" }, signal: AbortSignal.timeout(90000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return texto ? await r.text() : await r.json();
    } catch (e) {
      if (i >= intentos) throw new Error(`${e.message} en ${url}`);
      await new Promise(res => setTimeout(res, 5000 * i));
    }
  }
}

// Países (sin agregados regionales) con su nombre en español.
const paises = await pedir(`${BM}/es/country?format=json&per_page=400`);
const validos = new Set(), nombres = { WLD: "Mundo" }, region = {};
for (const p of paises[1] || []) {
  if (p.region?.value === "Agregados" || p.region?.id === "NA" || p.region?.value === "Aggregates") continue;
  validos.add(p.id); nombres[p.id] = p.name; region[p.id] = regionDe(p.id, p.region?.id);
}
console.log(`Países: ${validos.size}`);

async function datosDe(ind) {
  if (ind.fuente === "bm") {
    const r = await pedir(`${BM}/country/all/indicator/${ind.codigo}?format=json&per_page=20000&date=2000:${ANIO}${ind.source ? `&source=${ind.source}` : ""}`);
    return { valores: leerBancoMundial(r[1], validos), url: `https://datos.bancomundial.org/indicador/${ind.codigo}` };
  }
  if (ind.fuente === "fmi") {
    const r = await pedir(`https://www.imf.org/external/datamapper/api/v1/${ind.codigo}`);
    return { valores: leerFmi(r, ind.codigo, ANIO, validos), url: `https://www.imf.org/external/datamapper/${ind.codigo}` };
  }
  if (ind.fuente === "oit") {
    const q = new URLSearchParams({ id: ind.codigo, timefrom: "2000", type: "code", format: ".csv", ...(ind.filtro || {}) });
    let valores = leerOit(await pedir(`https://rplumber.ilo.org/data/indicator/?${q}`, 3, true), ANIO, validos);
    if (ind.cambio_anios) valores = cambioEnAnios(valores, ind.cambio_anios);
    return { valores, url: `https://ilostat.ilo.org/data/?indicator=${ind.codigo}` };
  }
  if (ind.fuente === "cepal") {
    const r = await pedir(`https://api-cepalstat.cepal.org/cepalstat/api/v1/indicator/${ind.codigo}/data?lang=es&format=json`);
    const usados = {};
    const valores = leerCepal(r, validos, ind.elegir || {}, usados);
    return { valores, nota: usados.ARG ? `Para la Argentina, la CEPAL tiene dato de: ${usados.ARG}.` : ind.nota, url: `https://statistics.cepal.org/portal/cepalstat/dashboard.html?indicator_id=${ind.codigo}&lang=es` };
  }
  throw new Error(`fuente desconocida: ${ind.fuente}`);
}

// Pide varias cosas a la vez, sin pasar de `n` pedidos en paralelo, y devuelve los resultados en orden.
async function enParalelo(lista, n, fn) {
  const out = new Array(lista.length); let sig = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (sig < lista.length) { const k = sig++; out[k] = await fn(lista[k]); } }));
  return out;
}

const filas = [];
// El Banco Mundial corta (502) si se le piden muchas cosas juntas: va de a uno; el resto, de a cuatro.
const bajar = ind => datosDe(ind).then(r => ({ r }), e => ({ e }));
const delBM = conf.indicadores.filter(i => i.fuente === "bm"), otros = conf.indicadores.filter(i => i.fuente !== "bm");
const [rBM, rOtros] = await Promise.all([enParalelo(delBM, 1, bajar), enParalelo(otros, 4, bajar)]);
const porClave = new Map([...delBM.map((i, k) => [i.clave, rBM[k]]), ...otros.map((i, k) => [i.clave, rOtros[k]])]);
const bajados = conf.indicadores.map(i => porClave.get(i.clave));
for (const [k, ind] of conf.indicadores.entries()) {
  try {
    if (bajados[k].e) throw bajados[k].e;
    const { valores, url, nota } = bajados[k].r;
    const minimo = ind.minimo || conf.minimo_paises;
    const anio = anioDeReferencia(Object.fromEntries(Object.entries(valores).filter(([k]) => k !== "WLD")), minimo);
    if (!anio) throw new Error(`menos de ${minimo} países con dato en un mismo año`);
    const ult = ultimosValores(valores, anio, ind.ventana || conf.ventana_anios);
    const delMundo = ult.WLD; delete ult.WLD;
    const pos = posicion(ult, "ARG", ind.mejor);
    if (!pos) throw new Error("la Argentina no tiene dato en la ventana");
    const serieAR = Object.entries(valores.ARG || {}).map(([a, v]) => ({ periodo: a, valor: v }));
    filas.push({
      ...ind, url, nota: nota || ind.nota || null, anioReferencia: anio, puesto: pos.puesto, total: pos.total, percentil: pos.percentil,
      valor: pos.valor, anio: pos.anio, mediana: pos.mediana, lectura: lectura(pos.percentil), mundo: delMundo || null,
      mejorPais: { ...pos.primero, nombre: nombres[pos.primero.pais] }, peorPais: { ...pos.ultimo, nombre: nombres[pos.ultimo.pais] },
      comparados: Object.fromEntries(conf.comparar_con.map(c => [c, c === "WLD" ? delMundo || null : ult[c] || null])),
      historia: historia(serieAR, ind.mejor),
      // Último valor de cada país, compacto [valor, año], para los informes por región de la página.
      paises: Object.fromEntries(Object.entries(ult).map(([k, d]) => [k, [+d.valor.toFixed(3), d.anio]])),
      serie: serieAR.sort((a, b) => (a.periodo < b.periodo ? -1 : 1)),
    });
    console.log(`${ind.clave}: puesto ${pos.puesto} de ${pos.total} (${anio})`);
  } catch (e) {
    errores.push({ indicador: ind.clave, error: e.message });
    console.warn(`Error en ${ind.clave}: ${e.message}`);
  }
}

// Series argentinas largas (INDEC y SIPA): para ver si el último dato es un mínimo histórico
// y cuánto cambió desde una fecha (p. ej. noviembre de 2023).
async function datosSerie(s) {
  if (s.fuente === "sipa") {
    const XLSX = (await import("xlsx")).default;
    const libro = XLSX.read(await readFile(new URL(`../../${s.archivo}`, import.meta.url)), { cellDates: true });
    const hoja = libro.Sheets[s.hoja];
    if (!hoja) throw new Error(`no está la hoja ${s.hoja}`);
    return { datos: leerSipa(XLSX.utils.sheet_to_json(hoja, { header: 1, raw: true }), s.columna), url: s.url };
  }
  const r = await pedir(`https://apis.datos.gob.ar/series/api/series/?ids=${encodeURIComponent(s.codigo)}&format=json&limit=5000`);
  return {
    datos: (r.data || []).filter(f => f[1] != null).map(f => ({ periodo: String(f[0]).slice(0, 7), valor: +(+f[1]).toFixed(2) })),
    url: `https://apis.datos.gob.ar/series/api/series/?ids=${s.codigo}&format=csv`,
  };
}
const seriesAR = [];
for (const s of conf.argentina_series) {
  try {
    const { datos, url } = await datosSerie(s);
    if (!datos.length) throw new Error("serie vacía");
    seriesAR.push({ ...s, url, historia: historia(datos, s.mejor), variacion: s.comparar_desde ? variacionDesde(datos, s.comparar_desde) : null, datos });
    console.log(`${s.clave}: ${datos.length} datos`);
  } catch (e) {
    errores.push({ indicador: s.clave, error: e.message });
    console.warn(`Error en ${s.clave}: ${e.message}`);
  }
}

// El índice general usa solo las áreas con ranking mundial; las regionales (CEPAL) se muestran aparte.
const regionales = new Set(conf.areas_regionales || []);
const mundiales = Object.fromEntries(Object.entries(conf.areas).filter(([k]) => !regionales.has(k)));
const { porArea, general } = promedios(filas, mundiales);
for (const k of regionales) porArea[k] = { ...promedios(filas, { [k]: conf.areas[k] }).porArea[k], regional: true };
await mkdir(new URL("../../data/mundo/", import.meta.url), { recursive: true });
await writeFile(SALIDA, JSON.stringify({
  actualizado: new Date().toISOString().slice(0, 10),
  metodo: "Puesto y percentil de la Argentina en cada indicador (último dato de cada país en una ventana de " +
    `${conf.ventana_anios} años). Promedio simple de percentiles por área y de las áreas. No se suman valores de indicadores distintos.`,
  general, lecturaGeneral: lectura(general), porArea,
  comparar_con: conf.comparar_con, nombres,
  regiones: REGIONES, regionDePais: region, grupos: GRUPOS_FIJOS,
  indicadores: filas, argentina: seriesAR, informes: informes.informes, errores,
}, null, 1));
console.log(`Listo: ${filas.length} indicadores, ${seriesAR.length} series argentinas, ${errores.length} errores. Índice general: ${general}`);
if (!filas.length) process.exit(1);
