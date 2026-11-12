import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ultimosValores, anioDeReferencia, posicion, historia, promedios, lectura, leerBancoMundial, leerFmi,
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
