import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ultimosValores, anioDeReferencia, posicion, historia, promedios, lectura, leerBancoMundial, leerFmi,
  regionDe, posicionEnGrupo,
} from "./calculo.mjs";

const valores = {
  ARG: { 2023: 15, 2024: 13 },
  BRA: { 2024: 11 },
  HUN: { 2023: 20 },          // dato viejo, entra por la ventana
  KOR: { 2024: 25 },
  CHL: { 2019: 9 },           // fuera de la ventana
};

test("último valor dentro de la ventana", () => {
  const u = ultimosValores(valores, 2024, 3);
  assert.deepEqual(u.ARG, { valor: 13, anio: 2024 });
  assert.deepEqual(u.HUN, { valor: 20, anio: 2023 });
  assert.equal(u.CHL, undefined);
});

test("año de referencia con mínimo de países", () => {
  assert.equal(anioDeReferencia(valores, 3), 2024);
  assert.equal(anioDeReferencia(valores, 4), null);
});

test("puesto y percentil cuando conviene un valor alto", () => {
  const p = posicion(ultimosValores(valores, 2024, 3), "ARG", "alto");
  assert.equal(p.puesto, 3);       // KOR 25, HUN 20, ARG 13, BRA 11
  assert.equal(p.total, 4);
  assert.equal(p.percentil, 33.3); // le gana a 1 de los otros 3
  assert.equal(p.primero.pais, "KOR");
});

test("puesto cuando conviene un valor bajo (desempleo, inflación)", () => {
  const p = posicion(ultimosValores(valores, 2024, 3), "ARG", "bajo");
  assert.equal(p.puesto, 2);       // BRA 11, ARG 13, HUN 20, KOR 25
  assert.equal(p.percentil, 66.7);
});

test("mínimo histórico de una serie argentina", () => {
  const h = historia([{ periodo: "2024-01", valor: 60 }, { periodo: "2025-06", valor: 55 }, { periodo: "2026-09", valor: 54.1 }], "alto");
  assert.equal(h.esPeorHistorico, true);
  assert.deepEqual(h.peor, { valor: 54.1, periodo: "2026-09" });
  const h2 = historia([{ periodo: "2024-01", valor: 50 }, { periodo: "2026-09", valor: 54.1 }], "alto");
  assert.equal(h2.esPeorHistorico, false);
  assert.equal(h2.lugarEntreLosPeores, 2);
});

test("promedios por área y general, sin mezclar valores", () => {
  const r = promedios([{ area: "industria", percentil: 10 }, { area: "industria", percentil: 30 }, { area: "empleo", percentil: 60 }],
    { industria: "Industria", empleo: "Empleo", macro: "Macro" });
  assert.equal(r.porArea.industria.percentil, 20);
  assert.equal(r.porArea.macro.percentil, null);
  assert.equal(r.general, 40);
});

test("lectura en palabras", () => {
  assert.equal(lectura(3), "entre los peores del mundo");
  assert.equal(lectura(50), "en la mitad de la tabla");
  assert.equal(lectura(null), "sin datos");
});

test("lector del Banco Mundial deja afuera los agregados", () => {
  const filas = [
    { countryiso3code: "ARG", date: "2024", value: 14.2 },
    { countryiso3code: "LCN", date: "2024", value: 12.0 },   // agregado regional
    { countryiso3code: "WLD", date: "2024", value: 15.5 },   // el mundo se guarda aparte
    { countryiso3code: "BRA", date: "2024", value: null },
  ];
  const r = leerBancoMundial(filas, new Set(["ARG", "BRA"]));
  assert.deepEqual(r, { ARG: { 2024: 14.2 }, WLD: { 2024: 15.5 } });
});

test("lector del FMI deja afuera las proyecciones", () => {
  const j = { values: { LUR: { ARG: { 2024: 7.2, 2025: 7.0, 2026: 6.8 }, EUQ: { 2024: 6 } } } };
  assert.deepEqual(leerFmi(j, "LUR", 2026, new Set(["ARG"])), { ARG: { 2024: 7.2, 2025: 7.0 } });
});

test("regiones: Turquía va con Medio Oriente, México con América del Norte, Egipto con África", () => {
  assert.equal(regionDe("TUR", "ECS"), "medio_oriente");
  assert.equal(regionDe("MEX", "LCN"), "norteamerica");
  assert.equal(regionDe("CRI", "LCN"), "centroamerica");
  assert.equal(regionDe("EGY", "MEA"), "africa");
  assert.equal(regionDe("JPN", "EAS"), "asia");
  assert.equal(regionDe("AUS", "EAS"), "oceania");
  assert.equal(regionDe("DEU", "ECS"), "europa");
});

test("puesto dentro de un grupo de países", () => {
  const u = ultimosValores(valores, 2024, 3);
  const p = posicionEnGrupo(u, "ARG", "alto", ["BRA", "HUN"]);
  assert.equal(p.puesto, 2);
  assert.equal(p.total, 3);
});

import { leerCsv, leerOit, cambioEnAnios, leerCepal } from "./calculo.mjs";

test("CSV de la OIT", () => {
  const t = '"ref_area","time","obs_value","note"\n"ARG","2024",50.12,\n"ARG","2026",50.2,"M"\n"BRA","2024",48,"a, b"\n';
  assert.equal(leerCsv(t).length, 3);
  assert.deepEqual(leerOit(t, 2026, new Set(["ARG", "BRA"])), { ARG: { 2024: 50.12 }, BRA: { 2024: 48 } });
});

test("variación en dos años", () => {
  assert.deepEqual(cambioEnAnios({ ARG: { 2022: 3000, 2023: 2900, 2024: 2760 } }, 2), { ARG: { 2024: -8 } });
});

test("CEPAL toma el total de ambos sexos", () => {
  const j = { body: {
    dimensions: [
      { id: 208, name: "País__ESTANDAR", members: [{ id: 216, name: "Argentina" }] },
      { id: 29117, name: "Años__ESTANDAR", members: [{ id: 1, name: "2023" }, { id: 2, name: "2024" }] },
      { id: 144, name: "Sexo", members: [{ id: 10, name: "Ambos sexos" }, { id: 11, name: "Mujeres" }] },
    ],
    data: [
      { iso3: "ARG", value: "6.1", dim_208: 216, dim_29117: 2, dim_144: 10 },
      { iso3: "ARG", value: "7.0", dim_208: 216, dim_29117: 2, dim_144: 11 },
      { iso3: null, value: "9", dim_208: 211, dim_29117: 2, dim_144: 10 },
    ] } };
  assert.deepEqual(leerCepal(j, new Set(["ARG"])), { ARG: { 2024: 6.1 } });
});

import { isoDeNombre, leerSipa, variacionDesde } from "./calculo.mjs";

test("nombres de la CEPAL", () => {
  assert.equal(isoDeNombre("Bolivia (Estado Plurinacional de)"), "BOL");
  assert.equal(isoDeNombre("México"), "MEX");
  assert.equal(isoDeNombre("América Latina"), null);
});

test("hoja del SIPA y empleos perdidos", () => {
  const filas = [["A.2.2 título"], ["Período", "Pesca", "Industrias \nmanufactureras"],
    [new Date(Date.UTC(2023, 10, 1)), 1, 1250.5], [45992, 1, 1200], ["jul-26*", 1, 1103.026], ["Notas: ", null, null]];
  const d = leerSipa(filas, "Industrias manufactureras");
  assert.deepEqual(d.map(x => x.periodo), ["2023-11", "2025-12", "2026-07"]);
  assert.equal(variacionDesde(d, "2023-11").diferencia, -147.474);
});

test("CEPAL con preferencia nacional y respaldo urbano", () => {
  const j = { body: {
    dimensions: [
      { id: 208, name: "País__ESTANDAR", members: [{ id: 216, name: "Argentina" }, { id: 222, name: "Brasil" }] },
      { id: 29117, name: "Años__ESTANDAR", members: [{ id: 1, name: "2023" }] },
      { id: 1361, name: "Pobreza extrema y pobreza", members: [{ id: 1362, name: "Pobreza" }, { id: 1363, name: "Pobreza extrema" }] },
      { id: 326, name: "Área geográfica", members: [{ id: 327, name: "Nacional" }, { id: 330, name: "Urbana" }] },
    ],
    data: [
      { iso3: "ARG", value: "30", dim_29117: 1, dim_1361: 1362, dim_326: 330 },
      { iso3: "ARG", value: "6", dim_29117: 1, dim_1361: 1363, dim_326: 330 },
      { iso3: "BRA", value: "25", dim_29117: 1, dim_1361: 1362, dim_326: 327 },
      { iso3: "BRA", value: "22", dim_29117: 1, dim_1361: 1362, dim_326: 330 },
    ] } };
  const usados = {};
  const v = leerCepal(j, null, { "pobreza extrema y pobreza": ["Pobreza"], "área geográfica": ["Nacional", "Urbana"] }, usados);
  assert.deepEqual(v, { ARG: { 2023: 30 }, BRA: { 2023: 25 } });
  assert.deepEqual(usados, { ARG: "Urbana" });
});
