// Sondeo de fuentes para «Argentina frente al mundo»: muestra cómo vienen los datos antes de sumarlos al catálogo.
// Uso: node scripts/mundo/sondeo.mjs   (corre en GitHub Actions; desde otras redes puede estar bloqueado)
const pedir = async u => (await fetch(u, { headers: { "User-Agent": "observatorio-uom/sondeo" }, signal: AbortSignal.timeout(90000) })).json();

// CEPAL: dimensiones de cada indicador y cuántas filas tiene la Argentina por miembro.
for (const id of [4558, 3347, 3289, 5095, 1240, 340]) {
  try {
    const b = (await pedir(`https://api-cepalstat.cepal.org/cepalstat/api/v1/indicator/${id}/data?lang=es&format=json`)).body;
    console.log(`\n### CEPAL ${id} · ${b.data.length} filas · iso3 en filas: ${b.data.filter(f => f.iso3).length}`);
    for (const d of b.dimensions) {
      const cuenta = {}; for (const f of b.data) cuenta[f[`dim_${d.id}`]] = (cuenta[f[`dim_${d.id}`]] || 0) + 1;
      const ms = d.members.filter(m => cuenta[m.id]);
      console.log(`  dim ${d.id} «${d.name}» (${ms.length}): ` + ms.slice(0, 14).map(m => `${m.id}=${m.name} [${cuenta[m.id]}]`).join(" | "));
    }
    console.log("  ej: " + JSON.stringify(b.data.find(f => f.iso3 === "ARG") || b.data[0]));
  } catch (e) { console.log(`CEPAL ${id} error ${e.message}`); }
}

// Banco Mundial, gobernanza: cuántos países por año.
for (const c of ["RL.EST", "CC.EST"]) {
  try {
    const r = await pedir(`https://api.worldbank.org/v2/country/all/indicator/${c}?format=json&per_page=20000&date=2015:2026&source=3`);
    const n = {}; for (const f of r[1] || []) if (f.value != null) n[f.date] = (n[f.date] || 0) + 1;
    console.log(`\n### BM ${c} · paginado ${JSON.stringify(r[0])} · países con dato por año ${JSON.stringify(n)}`);
  } catch (e) { console.log(`BM ${c} error ${e.message}`); }
}
