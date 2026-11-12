// Sondeo de fuentes nuevas para «Argentina frente al mundo»: pide cada dirección candidata y anota qué responde
// (estado, tipo y el comienzo del contenido). Sirve para confirmar las APIs antes de sumarlas al catálogo.
// Uso: node scripts/mundo/sondeo.mjs   (corre en GitHub Actions; desde otras redes puede estar bloqueado)
const candidatos = [
  ["OIT índice de indicadores", "https://rplumber.ilo.org/metadata/toc/indicator?lang=es&format=.csv"],
  ["OIT participación del trabajo en el PIB", "https://rplumber.ilo.org/data/indicator/?id=LAP_2GDP_NOC_RT_A&ref_area=ARG&timefrom=2015&type=code&format=.csv"],
  ["OIT informalidad", "https://rplumber.ilo.org/data/indicator/?id=SDG_0831_SEX_ECO_RT_A&ref_area=ARG&timefrom=2015&type=code&format=.csv"],
  ["OIT empleo industria todos", "https://rplumber.ilo.org/data/indicator/?id=EMP_TEMP_SEX_ECO_NB_A&sex=SEX_T&classif1=ECO_SECTOR_IND&timefrom=2021&type=code&format=.csv"],
  ["OCDE KEI medidas EE.UU.", "https://sdmx.oecd.org/public/rest/data/OECD.SDD.STES,DSD_KEI@DF_KEI,4.0/USA.Q.....?startPeriod=2025-Q1&format=csvfilewithlabels"],
  ["OCDE KEI producción", "https://sdmx.oecd.org/public/rest/data/OECD.SDD.STES,DSD_KEI@DF_KEI,4.0/ARG+BRA+USA.M.PRVM....?startPeriod=2026-01&format=csvfilewithlabels"],
  ["OCDE BTS EE.UU.", "https://sdmx.oecd.org/public/rest/data/OECD.SDD.STES,DSD_STES@DF_BTS,4.0/DEU.Q.......?startPeriod=2025-Q1&format=csvfilewithlabels"],
  ["INDEC búsqueda EMAE 2004", "https://apis.datos.gob.ar/series/api/search/?q=EMAE%20desestacionalizada&limit=10"],
  ["INDEC búsqueda pobreza porcentaje", "https://apis.datos.gob.ar/series/api/search/?q=porcentaje%20de%20personas%20bajo%20la%20l%C3%ADnea%20de%20pobreza&limit=10"],
  ["INDEC búsqueda salario real", "https://apis.datos.gob.ar/series/api/search/?q=%C3%ADndice%20de%20salarios%20registrado%20privado&limit=10"],
  ["INDEC búsqueda inversión 2004", "https://apis.datos.gob.ar/series/api/search/?q=formaci%C3%B3n%20bruta%20de%20capital%20fijo%20desestacionalizada&limit=10"],
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

// CEPAL: busca en el árbol temático los indicadores que interesan y muestra sus códigos.
try {
  const r = await fetch("https://api-cepalstat.cepal.org/cepalstat/api/v1/thematic-tree?lang=es&format=json", { signal: AbortSignal.timeout(45000) });
  const j = await r.json();
  const buscar = [/industria manufacturera/i, /desempleo|desocupaci/i, /pobreza/i, /gini/i, /salario m[ií]nimo/i, /informal/i, /exportaciones de manufacturas|exportaciones de bienes/i, /inversi[oó]n extranjera/i, /deuda/i, /productividad/i];
  const hallados = [];
  (function rec(n) { if (n.indicator_id && buscar.some(b => b.test(n.name))) hallados.push(`${n.indicator_id} · ${n.name}`); (n.children || []).forEach(rec); })(j.body);
  console.log(`\n### CEPAL indicadores encontrados (${hallados.length})\n` + hallados.slice(0, 120).join("\n"));
  const d = await (await fetch("https://api-cepalstat.cepal.org/cepalstat/api/v1/indicator/2204/data?lang=es&format=json")).json();
  console.log("\n### CEPAL forma de los datos\n" + JSON.stringify(Object.keys(d.body)) + "\n" + JSON.stringify(d.body.data?.slice?.(0, 2) || d.body).slice(0, 900) + "\n" + JSON.stringify(d.body.dimensions?.slice?.(0, 2) || "").slice(0, 1500));
} catch (e) { console.log("CEPAL error " + e.message); }
