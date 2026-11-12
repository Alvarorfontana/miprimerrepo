// Sondeo de fuentes nuevas para «Argentina frente al mundo»: pide cada dirección candidata y anota qué responde
// (estado, tipo y el comienzo del contenido). Sirve para confirmar las APIs antes de sumarlas al catálogo.
// Uso: node scripts/mundo/sondeo.mjs   (corre en GitHub Actions; desde otras redes puede estar bloqueado)
const candidatos = [
  // OIT · ILOSTAT
  ["OIT rplumber empleo por sector", "https://rplumber.ilo.org/data/indicator/?id=EMP_TEMP_SEX_ECO_NB_A&ref_area=ARG&sex=SEX_T&timefrom=2018&type=code&format=.csv"],
  ["OIT rplumber salario mensual", "https://rplumber.ilo.org/data/indicator/?id=EAR_4MTH_SEX_ECO_CUR_NB_A&ref_area=ARG&timefrom=2018&type=code&format=.csv"],
  ["OIT SDMX flujos", "https://sdmx.ilo.org/rest/dataflow/ILO?detail=allstubs"],
  ["OIT SDMX empleo industria", "https://sdmx.ilo.org/rest/data/ILO,DF_EMP_TEMP_SEX_ECO_NB/ARG+BRA.A.SEX_T.ECO_SECTOR_IND?startPeriod=2018&format=jsondata"],
  // OCDE
  ["OCDE flujos STES", "https://sdmx.oecd.org/public/rest/dataflow/OECD.SDD.STES"],
  ["OCDE KEI producción", "https://sdmx.oecd.org/public/rest/data/OECD.SDD.STES,DSD_KEI@DF_KEI,4.0/ARG+BRA+USA.M.PRVM...?startPeriod=2024-01&dimensionAtObservation=AllDimensions&format=jsondata"],
  ["OCDE KEI capacidad", "https://sdmx.oecd.org/public/rest/data/OECD.SDD.STES,DSD_KEI@DF_KEI,4.0/.Q.CAPUTL...?startPeriod=2023-Q1&dimensionAtObservation=AllDimensions&format=jsondata"],
  ["OCDE BTS capacidad", "https://sdmx.oecd.org/public/rest/data/OECD.SDD.STES,DSD_STES@DF_BTS,4.0/.Q.BU.CU....?startPeriod=2023-Q1&dimensionAtObservation=AllDimensions&format=jsondata"],
  // CEPAL · CEPALSTAT
  ["CEPAL árbol temático", "https://api-cepalstat.cepal.org/cepalstat/api/v1/thematic-tree?lang=es&format=json"],
  ["CEPAL indicador 2204", "https://api-cepalstat.cepal.org/cepalstat/api/v1/indicator/2204/data?lang=es&format=json"],
  ["CEPAL indicador 4294", "https://api-cepalstat.cepal.org/cepalstat/api/v1/indicator/4294/data?lang=es&format=json"],
  // ONUDI
  ["ONUDI portal", "https://stat.unido.org/"],
  ["ONUDI API v1", "https://stat.unido.org/api/v1/"],
  ["ONUDI API datos", "https://stat.unido.org/api/data"],
  ["ONUDI IIP trimestral", "https://stat.unido.org/database/IIP%20Quarterly"],
  // INDEC por datos.gob.ar (búsqueda de series argentinas)
  ["INDEC búsqueda IPI manufacturero", "https://apis.datos.gob.ar/series/api/search/?q=IPI%20manufacturero%20nivel%20general&limit=10"],
  ["INDEC búsqueda EMAE", "https://apis.datos.gob.ar/series/api/search/?q=EMAE%20original&limit=10"],
  ["INDEC búsqueda desocupación", "https://apis.datos.gob.ar/series/api/search/?q=tasa%20de%20desocupaci%C3%B3n&limit=10"],
  ["INDEC búsqueda salarios", "https://apis.datos.gob.ar/series/api/search/?q=%C3%ADndice%20de%20salarios&limit=10"],
  ["INDEC búsqueda pobreza", "https://apis.datos.gob.ar/series/api/search/?q=pobreza%20personas&limit=10"],
  ["INDEC búsqueda inversión", "https://apis.datos.gob.ar/series/api/search/?q=inversi%C3%B3n%20bruta%20interna%20fija&limit=10"],
  // SRT
  ["SRT estadísticas", "https://www.srt.gob.ar/estadisticas/"],
];

for (const [nombre, url] of candidatos) {
  try {
    const r = await fetch(url, { headers: { "User-Agent": "observatorio-uom/sondeo", Accept: "application/json, text/csv, */*" }, signal: AbortSignal.timeout(45000) });
    const tipo = r.headers.get("content-type") || "";
    const txt = await r.text();
    console.log(`\n### ${nombre}\n${r.status} · ${tipo} · ${txt.length} bytes\n${txt.slice(0, 700).replace(/\s+/g, " ")}`);
  } catch (e) {
    console.log(`\n### ${nombre}\nERROR ${e.message}`);
  }
}
