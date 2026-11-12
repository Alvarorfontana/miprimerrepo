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
