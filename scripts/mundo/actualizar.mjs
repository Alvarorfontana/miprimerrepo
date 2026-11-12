// Módulo «Argentina frente al mundo»: baja los indicadores del catálogo (scripts/mundo/indicadores.json),
// calcula el puesto y el percentil de la Argentina en cada uno, el promedio por área y los mínimos históricos,
// y guarda todo en data/mundo/indice.json. Corre una vez por mes en GitHub Actions (mundo.yml).
// Fuentes gratuitas y sin clave: API del Banco Mundial, FMI DataMapper y API de Series de Tiempo (INDEC).
// Uso: node scripts/mundo/actualizar.mjs
import { readFile, writeFile, mkdir } from "node:fs/promises";
import {
  ultimosValores, anioDeReferencia, posicion, historia, promedios, lectura, leerBancoMundial, leerFmi,
} from "./calculo.mjs";

const AQUI = new URL("./", import.meta.url);
const SALIDA = new URL("../../data/mundo/indice.json", import.meta.url);
const conf = JSON.parse(await readFile(new URL("indicadores.json", AQUI), "utf8"));
const informes = JSON.parse(await readFile(new URL("../../data/mundo/informes.json", import.meta.url), "utf8"));
const ANIO = new Date().getUTCFullYear();
const BM = "https://api.worldbank.org/v2";
const errores = [];

async function pedir(url, intentos = 3) {
  for (let i = 1; ; i++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": "observatorio-uom/mundo" }, signal: AbortSignal.timeout(60000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      if (i >= intentos) throw new Error(`${e.message} en ${url}`);
      await new Promise(res => setTimeout(res, 2000 * i));
    }
  }
}

// Países (sin agregados regionales) con su nombre en español.
const paises = await pedir(`${BM}/es/country?format=json&per_page=400`);
const validos = new Set(), nombres = { WLD: "Mundo" };
for (const p of paises[1] || []) {
  if (p.region?.value === "Agregados" || p.region?.id === "NA" || p.region?.value === "Aggregates") continue;
  validos.add(p.id); nombres[p.id] = p.name;
}
console.log(`Países: ${validos.size}`);

async function datosDe(ind) {
  if (ind.fuente === "bm") {
    const r = await pedir(`${BM}/country/all/indicator/${ind.codigo}?format=json&per_page=20000&date=2000:${ANIO}`);
    return { valores: leerBancoMundial(r[1], validos), url: `https://datos.bancomundial.org/indicador/${ind.codigo}` };
  }
  if (ind.fuente === "fmi") {
    const r = await pedir(`https://www.imf.org/external/datamapper/api/v1/${ind.codigo}`);
    return { valores: leerFmi(r, ind.codigo, ANIO, validos), url: `https://www.imf.org/external/datamapper/${ind.codigo}` };
  }
  throw new Error(`fuente desconocida: ${ind.fuente}`);
}

const filas = [];
for (const ind of conf.indicadores) {
  try {
    const { valores, url } = await datosDe(ind);
    const anio = anioDeReferencia(Object.fromEntries(Object.entries(valores).filter(([k]) => k !== "WLD")), conf.minimo_paises);
    if (!anio) throw new Error("menos países con dato que el mínimo");
    const ult = ultimosValores(valores, anio, conf.ventana_anios);
    const delMundo = ult.WLD; delete ult.WLD;
    const pos = posicion(ult, "ARG", ind.mejor);
    if (!pos) throw new Error("la Argentina no tiene dato en la ventana");
    const serieAR = Object.entries(valores.ARG || {}).map(([a, v]) => ({ periodo: a, valor: v }));
    filas.push({
      ...ind, url, anioReferencia: anio, puesto: pos.puesto, total: pos.total, percentil: pos.percentil,
      valor: pos.valor, anio: pos.anio, mediana: pos.mediana, lectura: lectura(pos.percentil), mundo: delMundo || null,
      mejorPais: { ...pos.primero, nombre: nombres[pos.primero.pais] }, peorPais: { ...pos.ultimo, nombre: nombres[pos.ultimo.pais] },
      comparados: Object.fromEntries(conf.comparar_con.map(c => [c, c === "WLD" ? delMundo || null : ult[c] || null])),
      historia: historia(serieAR, ind.mejor),
      serie: serieAR.sort((a, b) => (a.periodo < b.periodo ? -1 : 1)),
    });
    console.log(`${ind.clave}: puesto ${pos.puesto} de ${pos.total} (${anio})`);
  } catch (e) {
    errores.push({ indicador: ind.clave, error: e.message });
    console.warn(`Error en ${ind.clave}: ${e.message}`);
  }
}

// Series argentinas largas (INDEC): para ver si el último dato es un mínimo histórico.
const seriesAR = [];
for (const s of conf.argentina_series) {
  try {
    const r = await pedir(`https://apis.datos.gob.ar/series/api/series/?ids=${encodeURIComponent(s.codigo)}&format=json&limit=5000`);
    const datos = (r.data || []).filter(f => f[1] != null).map(f => ({ periodo: String(f[0]).slice(0, 7), valor: +(+f[1]).toFixed(2) }));
    if (!datos.length) throw new Error("serie vacía");
    seriesAR.push({ ...s, url: `https://apis.datos.gob.ar/series/api/series/?ids=${s.codigo}&format=csv`, historia: historia(datos, s.mejor), datos });
    console.log(`${s.clave}: ${datos.length} datos`);
  } catch (e) {
    errores.push({ indicador: s.clave, error: e.message });
    console.warn(`Error en ${s.clave}: ${e.message}`);
  }
}

const { porArea, general } = promedios(filas, conf.areas);
await mkdir(new URL("../../data/mundo/", import.meta.url), { recursive: true });
await writeFile(SALIDA, JSON.stringify({
  actualizado: new Date().toISOString().slice(0, 10),
  metodo: "Puesto y percentil de la Argentina en cada indicador (último dato de cada país en una ventana de " +
    `${conf.ventana_anios} años). Promedio simple de percentiles por área y de las áreas. No se suman valores de indicadores distintos.`,
  general, lecturaGeneral: lectura(general), porArea,
  comparar_con: conf.comparar_con, nombres: Object.fromEntries(conf.comparar_con.map(c => [c, nombres[c] || c])),
  indicadores: filas, argentina: seriesAR, informes: informes.informes, errores,
}, null, 1));
console.log(`Listo: ${filas.length} indicadores, ${seriesAR.length} series argentinas, ${errores.length} errores. Índice general: ${general}`);
if (!filas.length) process.exit(1);
