"""Informe estadístico del Observatorio Metalúrgico en PDF.

Lee los datos del repo (data/*.json), arma un informe con gráficos y texto, y lo imprime a PDF.
Uso:
    python3 scripts/informe/generar.py                       # informe nacional
    python3 scripts/informe/generar.py --provincia "Córdoba"  # informe provincial
Salida: informes/<archivo>.pdf  (y el HTML intermedio, para revisar)
Requiere: playwright (python) con Chromium.
"""
import argparse, json, math, os, sys, datetime as dt
sys.path.insert(0, os.path.dirname(__file__))
from graficos import *

R = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
D = lambda n, fb=None: json.load(open(f"{R}/data/{n}")) if os.path.exists(f"{R}/data/{n}") else fb
MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
MESES_L = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
mes_c = lambda p: f"{MESES[int(p[5:7]) - 1]} {p[2:4]}"
mes_l = lambda p: f"{MESES_L[int(p[5:7]) - 1]} de {p[:4]}"
pct = lambda a, b: (a / b - 1) * 100 if a is not None and b else None
sg = lambda v, d=1: ("+" if v is not None and v > 0 else "") + num(v, d)


# ---------- datos ----------
def series():
    """Todas las series mensuales en un diccionario {clave: {meta, datos: {periodo: valor}}}."""
    S = {}
    for archivo in ["indicadores-auto.json", "indicadores.json", "indec-series.json", "acero-caa.json"]:
        for s in (D(archivo, {"series": []}) or {"series": []})["series"]:
            d = {x["periodo"]: x["valor"] for x in s["datos"] if x.get("valor") is not None}
            if s["clave"] in S: S[s["clave"]]["datos"].update(d)
            else: S[s["clave"]] = {**{k: v for k, v in s.items() if k != "datos"}, "datos": d}
    # alias: una misma variable puede venir por varias vías
    alias = {"uci-metalmecanica": ["indec-uci-metalmecanica"], "uci-automotriz": ["indec-uci-automotriz"],
             "uci-metalicas": ["auto-uci-metalicas", "indec-uci-metalicas"], "uci-general": ["auto-uci-general"]}
    for k, otras in alias.items():
        for o in otras:
            if o in S:
                if k not in S: S[k] = {**S[o], "datos": dict(S[o]["datos"])}
                else:
                    for p, v in S[o]["datos"].items(): S[k]["datos"].setdefault(p, v)
    return S


def ult(s, n=1):
    ks = sorted(s["datos"]); return [(k, s["datos"][k]) for k in ks[-n:]]


def ia(s, p):
    """Variación interanual del período p."""
    a = s["datos"].get(p); b = s["datos"].get(f"{int(p[:4]) - 1}{p[4:]}"); return pct(a, b)


# ---------- armado ----------
def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--provincia"); ap.add_argument("--salida")
    a = ap.parse_args(); PV = a.provincia
    S = series(); oede = D("empleo-oede.json"); conf = D("conflictividad.json"); est = D("establecimientos.json", {"filas": []})
    pl = D("plantas.json", {"plantas": []})["plantas"]; ev = D("eventos.json", {"eventos": []})["eventos"]
    fu = D("fuentes.json"); imp = D("importaciones.json"); hoy = dt.date.today()
    ambito = PV or "Argentina"; titulo_amb = f"Provincia de {PV}" if PV and PV != "CABA" else ("Ciudad de Buenos Aires" if PV == "CABA" else "Total país")
    P = []  # páginas
    resumen = []  # puntos del resumen ejecutivo

    # --- empleo OEDE ---
    UOM = ["27", "28", "29", "31", "32", "34p", "35"]
    def areas_de(pv):
        if not pv: return list(oede["areas"].values())
        if pv == "Buenos Aires": return [v for k, v in oede["areas"].items() if v["provincia"] == "Buenos Aires"]
        return [v for k, v in oede["areas"].items() if k == pv or v.get("provincia") == pv and k != "GBA" and k != "Resto de Buenos Aires"]
    A = areas_de(PV)
    def suma(campo, grupos=UOM, areas=A):
        n = len(oede[campo]); out = [0] * n
        for ar in areas:
            for g in grupos:
                gg = ar["grupos"].get(g)
                if gg:
                    for i, v in enumerate(gg["anual" if campo == "anios" else "trim"]): out[i] += v or 0
        return out
    emp_anual = suma("anios"); emp_trim = suma("trimestres"); T = oede["trimestres"]
    e_ult, e_ant = emp_trim[-1], emp_trim[T.index("2023T4")] if "2023T4" in T else emp_trim[0]
    e_ia = pct(emp_trim[-1], emp_trim[-5])
    resumen.append(f"<b>Empleo registrado:</b> {num(e_ult, 0)} asalariados metalúrgicos en {T[-1].replace('T', ' T')}, {sg(e_ia)}% interanual y {sg(e_ult - e_ant, 0)} puestos desde el cuarto trimestre de 2023 ({sg(pct(e_ult, e_ant))}%).")
    # por rama (grupo)
    ramas_var = []
    for g in UOM:
        t = suma("trimestres", [g]);
        if t[-1] or t[T.index("2023T4")]: ramas_var.append((oede["grupos"][g].split(" (")[0], t[-1] - t[T.index("2023T4")], f"{num(t[-1], 0)} puestos · {sg(pct(t[-1], t[T.index('2023T4')]))}%"))
    ramas_var.sort(key=lambda x: x[1])
    # ramas a 4 dígitos (solo nacional)
    r4 = []
    if not PV:
        for k, r in oede["ramas"].items():
            if r["grupo"] == "3410" or not r["trim"][-1]: continue
            r4.append((r["descripcion"][:52], r["trim"][-1] - r["trim"][T.index("2023T4")], f"CIIU {k} · {num(r['trim'][-1], 0)} puestos"))
        r4.sort(key=lambda x: x[1])
    # provincias
    prov_tab = []
    for k, ar in oede["areas"].items():
        t = suma("trimestres", areas=[ar]);
        if not t[-1]: continue
        prov_tab.append((ar["nombre"] if k in ("GBA", "Resto de Buenos Aires") else k, t[-1], t[-1] - t[T.index("2023T4")], pct(t[-1], t[T.index("2023T4")]), pct(t[-1], t[-5])))
    prov_tab.sort(key=lambda x: -x[1])

    # --- actividad y capacidad ---
    ipi_k = [("auto-ipi-siderurgia", "Siderurgia"), ("auto-ipi-fundicion", "Fundición"), ("auto-ipi-productos-metal", "Productos de metal"), ("auto-ipi-maquinaria", "Maquinaria y equipo"), ("auto-ipi-electricos", "Equipos eléctricos"), ("auto-ipi-autopartes", "Autopartes"), ("ipi-maquinaria-agropecuaria", "Maquinaria agropecuaria")]
    ipi = [(n, S[k]) for k, n in ipi_k if k in S and S[k]["datos"]]
    ipi_ia = []
    for n, s in ipi:
        p, v = ult(s)[0]; x = ia(s, p)
        if x is not None: ipi_ia.append((n, x, f"índice {num(v, 1)} · {mes_c(p)}"))
    ipi_ia.sort(key=lambda x: x[1])
    uci_k = [("uci-general", "Industria en general", NAVY), ("uci-metalicas", "Metálicas básicas", STEEL), ("uci-metalmecanica", "Metalmecánica (sin automotriz)", MOLT), ("uci-automotriz", "Automotriz", "#7a3fb0")]
    uci = [(n, S[k], c) for k, n, c in uci_k if k in S and S[k]["datos"]]
    adimra = S.get("adimra-actividad"); adcap = S.get("adimra-capacidad"); acero = S.get("caa-acero-crudo")
    if adimra:
        p, v = ult(adimra)[0]; resumen.append(f"<b>Actividad metalúrgica (ADIMRA):</b> {sg(v)}% interanual en {mes_l(p)}" + (f", con {num(ult(adcap)[0][1])}% de la capacidad instalada en uso." if adcap else "."))
    for n, s, c in uci:
        if n.startswith("Metalmec"):
            p, v = ult(s)[0]; prev = s["datos"].get(f"{int(p[:4]) - 1}{p[4:]}")
            resumen.append(f"<b>Capacidad instalada (INDEC):</b> la metalmecánica usó {num(v)}% en {mes_l(p)}" + (f", contra {num(prev)}% un año antes." if prev else "."))
    if ipi_ia:
        peor = ipi_ia[0]; mejor = ipi_ia[-1]
        resumen.append(f"<b>Producción por rama (IPI):</b> la mayor caída interanual es {peor[0].lower()} ({sg(peor[1])}%); la mejor, {mejor[0].lower()} ({sg(mejor[1])}%).")
    if acero:
        p, v = ult(acero)[0]; x = ia(acero, p)
        resumen.append(f"<b>Acero crudo:</b> {num(v)} mil toneladas en {mes_l(p)}" + (f" ({sg(x)}% interanual)." if x is not None else "."))

    # --- conflictividad ---
    anual = {}
    for r in conf["rows"]:
        y = r[0][:4]; anual.setdefault(y, [0, 0, 0, 0]); anual[y][0] += r[1] or 0; anual[y][1] += r[4] or 0; anual[y][2] += r[5] or 0; anual[y][3] += 1
    anios_c = [y for y in sorted(anual) if anual[y][3] == 12]
    if anios_c: resumen.append(f"<b>Conflictividad:</b> {anual[anios_c[-1]][0]} conflictos con paro en el sector privado en {anios_c[-1]}; {anual[anios_c[-1]][1]} en la industria y {anual[anios_c[-1]][2]} por despidos.")

    # --- territorio ---
    from collections import Counter
    PROVCOD = {"02": "CABA", "06": "Buenos Aires", "10": "Catamarca", "14": "Córdoba", "18": "Corrientes", "22": "Chaco", "26": "Chubut", "30": "Entre Ríos", "34": "Formosa", "38": "Jujuy", "42": "La Pampa", "46": "La Rioja", "50": "Mendoza", "54": "Misiones", "58": "Neuquén", "62": "Río Negro", "66": "Salta", "70": "San Juan", "74": "San Luis", "78": "Santa Cruz", "82": "Santa Fe", "86": "Santiago del Estero", "90": "Tucumán", "94": "Tierra del Fuego"}
    pv_est = lambda v: PROVCOD.get(str(v).zfill(2), str(v)) if v is not None else "s/d"
    ramas_clae = {r["prefijo"]: r["rama"].split(" (")[0] for r in fu["ramasClae"]}
    rama_de = lambda c: next((p for p in sorted(ramas_clae, key=len, reverse=True) if c.startswith(p)), None)
    filas = [f for f in est["filas"] if not PV or pv_est(f[4]) == PV]
    por_rama = Counter(ramas_clae.get(rama_de(f[2])) for f in filas)
    por_tam = Counter(f[3] for f in filas)
    grandes = sum(1 for f in filas if f[3] in ("d. 200-499", "e. 500+"))
    por_prov = Counter(pv_est(f[4]) for f in est["filas"])
    plantas = [p for p in pl if not PV or p.get("provincia") == PV]
    ev_amb = sorted([e for e in ev if any(p["id"] == e["plantaId"] for p in plantas)], key=lambda e: e["fecha"], reverse=True)
    resumen.append(f"<b>Territorio:</b> {num(len(filas), 0)} establecimientos metalúrgicos en el padrón oficial, {grandes} de ellos con 200 o más trabajadores; {len(plantas)} plantas con seguimiento propio.")

    # --- importaciones ---
    if imp and imp.get("series"):
        resumen.append(imp.get("resumen", ""))

    # ---------- páginas ----------
    periodo_inf = mes_l(max([ult(s)[0][0] for _, s in ipi] or [hoy.strftime("%Y-%m")]))
    fecha = f"{hoy.day} de {MESES_L[hoy.month - 1]} de {hoy.year}"
    kpi = lambda v, l, c="": f"<div class='kpi {c}'><div class='v'>{v}</div><div class='l'>{l}</div></div>"
    kpis = [kpi(num(e_ult, 0), f"asalariados metalúrgicos registrados · {T[-1].replace('T', ' T')}"), kpi(f"{sg(e_ult - e_ant, 0)}", "puestos desde 4.º trim. 2023", "neg" if e_ult < e_ant else "")]
    if adimra and not PV: kpis.append(kpi(f"{sg(ult(adimra)[0][1])}%", f"actividad metalúrgica interanual · {mes_c(ult(adimra)[0][0])} (ADIMRA)", "neg" if ult(adimra)[0][1] < 0 else ""))
    if adcap and not PV: kpis.append(kpi(f"{num(ult(adcap)[0][1])}%", f"capacidad instalada en uso · {mes_c(ult(adcap)[0][0])} (ADIMRA)"))
    if PV: kpis += [kpi(num(len(filas), 0), "establecimientos metalúrgicos (padrón CEP XXI)"), kpi(str(grandes), "establecimientos con 200+ trabajadores")]

    PORTADA = (f"""<section class='page cover'><div class='in'>
      <div class='marcas'><img src='file://{R}/img/midtm-logo-claro.svg'>{{UOMLOGO}}</div><div class='kick lt' style='margin-top:14mm'>Informe estadístico · Modelo de Interpretación de Datos</div>
      <h1>{'Situación del sector metalúrgico' if not PV else 'Situación metalúrgica'}<br><em>{titulo_amb}</em></h1>
      <p class='lead lt'>Actividad, capacidad instalada, producción, empleo, conflictividad y territorio. Datos hasta {periodo_inf}.</p>
      <div class='kpis'>{''.join(kpis[:4])}</div>
      <p class='lt small' style='margin-top:auto'>Emitido el {fecha}. Elaborado por el equipo del MIDTM a partir de fuentes oficiales y relevamiento propio.</p></div></section>""")

    P.append(f"""<section class='page'><div class='kick'>Resumen</div><h2>Lo que muestran los datos</h2>
      <ul class='res'>{''.join(f'<li>{r}</li>' for r in resumen if r)}</ul>
      <h3>Lectura</h3><p>{lectura(e_ia, ipi_ia, uci, adimra)}</p>
      <div class='nota'>Cada cifra lleva su fuente y fecha en la página correspondiente. Las variaciones interanuales comparan con el mismo mes o trimestre del año anterior.</div></section>""")

    # índice ponderado
    AL = D("alertas.json", {"alertas": [], "indice": []}); IX = AL.get("indice", [])
    if IX:
        colx = lambda n: MOLT if n == "alta" else ("#e0a412" if n == "media" else STEEL2)
        if not PV:
            P.append(f"<section class='page'><div class='kick'>Índice de riesgo</div><h2>Dónde el riesgo es mayor</h2><p>Índice ponderado de 0 (sin señales) a 100 (riesgo máximo). Combina caída del empleo en el último año (30%), peso de ramas cuya producción cae (20%), pérdida desde fines de 2023 (15%), hechos en planta (15%), trimestres seguidos en baja (10%) y actividad provincial de ADIMRA (10%). 60 o más: alerta alta; 40 o más: media.</p>{barras_h([(i['area'], i['puntaje'], i['nivel']) for i in IX], dec=0, ancho_etq=200, alto_fila=27, colores=[colx(i['nivel']) for i in IX])}<p class='src'>Fuente: MIDTM, sobre OEDE–SIPA, INDEC, ADIMRA y relevamiento propio. Áreas con menos de 500 puestos metalúrgicos quedan fuera del índice.</p></section>")
        else:
            for i in [x for x in IX if x["provincia"] == PV]:
                comp = [(AL["nombres"][c], o["puntos"] if o["puntos"] is not None else 0, f"peso {round(AL['pesos'][c] * 100)}% · dato: {'s/d' if o['valor'] is None else o['valor']}") for c, o in i["componentes"].items()]
                P.append(f"<section class='page'><div class='kick'>Índice de riesgo</div><h2>{i['area']}: {i['puntaje']}/100</h2><p>Nivel <b>{i['nivel']}</b>. Así se compone el índice ponderado (cada señal de 0 a 100):</p>{barras_h(comp, dec=0, ancho_etq=330, alto_fila=40)}<p class='src'>Fuente: MIDTM.</p></section>")
    # alertas
    ale = AL["alertas"]
    ale = [x for x in ale if x["nivel"] != "info" and (not PV or x["ambito"] == "Nacional" or x.get("provincia") == PV)]
    if PV: ale = sorted(ale, key=lambda x: (x.get("provincia") != PV, {"alta": 0, "media": 1}.get(x["nivel"], 2)))
    if ale:
        filas_a = "".join(f"<tr class='{x['nivel']}'><td><span class='nv {x['nivel']}'>{x['nivel'].upper()}</span></td><td><b>{x['titulo']}</b><div class='small'>{x.get('detalle') or ''}</div></td><td class='small'>{x['tema']}<br>{x['ambito']}</td><td class='small'>{str(x['periodo']).replace('T', ' T')}<br>{x['fuente']}</td></tr>" for x in ale[:26])
        P.append(f"<section class='page'><div class='kick'>Alerta temprana</div><h2>Alertas activas</h2><p>{"Primero las alertas propias de " + titulo_amb + ", después las nacionales. " if PV else ""}Variables que cruzaron un umbral del modelo: {sum(1 for x in ale if x['nivel'] == 'alta')} alertas altas y {sum(1 for x in ale if x['nivel'] == 'media')} a seguir de cerca.</p><table><thead><tr><th>Nivel</th><th>Alerta</th><th>Tema</th><th>Dato</th></tr></thead><tbody>{filas_a}</tbody></table><p class='src'>Umbrales: producción −5% y −10% interanual; empleo −2% y −5% por provincia (−10% por actividad); capacidad en uso menor a 50% y 40%; hechos en planta de los últimos 120 días.</p></section>")

    # actividad (nacional)
    if ipi or uci:
        meses = sorted(set(p for _, s in ipi for p in s["datos"]))[-25:]
        base = meses[0]
        lin = [(n, [round(s["datos"][m] / s["datos"][base] * 100, 1) if s["datos"].get(m) and s["datos"].get(base) else None for m in meses], PAL[i % len(PAL)]) for i, (n, s) in enumerate(ipi)]
        cuerpo = f"<div class='kick'>Actividad · Ámbito nacional</div><h2>Producción por rama</h2><p>Índice de producción industrial (IPI) del INDEC para las ramas metalúrgicas. Primero, la variación interanual del último mes; después, la evolución de dos años con base {mes_c(base)} = 100.</p>"
        if ipi_ia: cuerpo += f"<h3>Variación interanual, último dato</h3>{barras_h(ipi_ia, unidad='%', signo=True, ancho_etq=230)}"
        cuerpo += f"<h3>Evolución (base {mes_c(base)} = 100)</h3>{lineas(lin, alto=300, etiquetas_x=[mes_c(m) for m in meses], cada=4)}"
        cuerpo += "<p class='src'>Fuente: INDEC, Índice de producción industrial manufacturero, vía API de Series de Tiempo y cuadros del INDEC.</p>"
        P.append(f"<section class='page'>{cuerpo}</section>")
    if uci or acero or adimra:
        c = "<div class='kick'>Capacidad instalada · Ámbito nacional</div><h2>Cuántas máquinas trabajan</h2>"
        if uci:
            meses = sorted(set(p for _, s, _ in uci for p in s["datos"]))[-36:]
            c += f"<p>Porcentaje de la capacidad instalada en uso según el INDEC, por bloque. La metalmecánica opera muy por debajo del promedio de la industria.</p>{lineas([(n, [s['datos'].get(m) for m in meses], col) for n, s, col in uci], alto=290, unidad='%', etiquetas_x=[mes_c(m) for m in meses], cada=6, dec=1)}<p class='src'>Fuente: INDEC, Utilización de la capacidad instalada en la industria.</p>"
        if adimra:
            ms = sorted(adimra["datos"]); c += f"<h3>Actividad metalúrgica, variación interanual (ADIMRA)</h3>{columnas([mes_c(m) for m in ms], [adimra['datos'][m] for m in ms], alto=200, dec=1, unidad='%')}<p class='src'>Fuente: ADIMRA, Informe de actividad metalúrgica (meses relevados).</p>"
        if acero:
            ms = sorted(acero["datos"])[-14:]; c += f"<h3>Acero crudo (miles de toneladas)</h3>{columnas([mes_c(m) for m in ms], [acero['datos'][m] for m in ms], alto=190, dec=1)}<p class='src'>Fuente: Cámara Argentina del Acero.</p>"
        P.append(f"<section class='page'>{c}</section>")

    # empleo
    c = f"<div class='kick'>Empleo registrado · {titulo_amb}</div><h2>Trabajo metalúrgico</h2><p>Asalariados registrados del sector privado en las ramas del universo UOM (sin terminales automotrices), según la seguridad social (OEDE–SIPA).</p>"
    c += f"<h3>Promedio anual de puestos, 1996–{oede['anios'][-1]}</h3>{columnas([str(y)[2:] for y in oede['anios']], emp_anual, alto=210, dec=0, destacar_ultimo=True, cada=2)}"
    c += f"<h3>Últimos trimestres</h3>{lineas([('Puestos', emp_trim, STEEL)], alto=200, etiquetas_x=[t.replace('T', ' T') for t in T], cada=2)}"
    c += f"<h3>Variación por rama desde el 4.º trimestre de 2023 (puestos)</h3>{barras_h(ramas_var, signo=True, dec=0, ancho_etq=250)}"
    c += f"<p class='src'>Fuente: {oede['fuente']} {oede['nota']}</p>"
    P.append(f"<section class='page'>{c}</section>")
    if r4:
        sel = r4[:10] + [x for x in r4[-5:] if x[1] > 0]
        P.append(f"<section class='page'><div class='kick'>Empleo por actividad</div><h2>Dónde se pierden puestos</h2><p>Las diez actividades (CIIU a 4 dígitos) con mayor pérdida de puestos desde el cuarto trimestre de 2023, y las que crecieron.</p>{barras_h(sel, signo=True, dec=0, ancho_etq=330, alto_fila=34)}<p class='src'>Fuente: OEDE–SIPA, empleo trimestral por rama a 4 dígitos.</p></section>")
    if not PV:
        filas_t = "".join(f"<tr><td>{n}</td><td class='r'>{num(v, 0)}</td><td class='r {'neg' if d < 0 else 'pos'}'>{sg(d, 0)}</td><td class='r {'neg' if (p or 0) < 0 else 'pos'}'>{sg(p)}%</td><td class='r'>{sg(q)}%</td></tr>" for n, v, d, p, q in prov_tab)
        P.append(f"<section class='page'><div class='kick'>Empleo por provincia</div><h2>El mapa del empleo</h2><table><thead><tr><th>Provincia o área</th><th class='r'>Puestos {T[-1].replace('T', ' T')}</th><th class='r'>Cambio desde 4T23</th><th class='r'>%</th><th class='r'>Interanual</th></tr></thead><tbody>{filas_t}</tbody></table><p class='src'>Fuente: OEDE–SIPA. En provincias chicas parte de las celdas tiene secreto estadístico: las cifras son un piso.</p></section>")

    # conflictividad (nacional)
    if anios_c:
        ys = anios_c[-15:]
        c = f"<div class='kick'>Conflictividad laboral · Ámbito nacional</div><h2>Conflictos con paro</h2><p>Conflictos laborales con paro en el sector privado, por año. Incluye los de la industria manufacturera y los motivados por despidos.</p>"
        c += f"<h3>Sector privado, total</h3>{columnas(ys, [anual[y][0] for y in ys], alto=200)}<h3>Industria manufacturera</h3>{columnas(ys, [anual[y][1] for y in ys], alto=180)}<h3>Por despidos</h3>{columnas(ys, [anual[y][2] for y in ys], alto=180)}"
        c += f"<p class='src'>Fuente: {conf.get('fuente', 'Ministerio de Capital Humano')}. Último mes disponible: {conf['rows'][-1][0]}.</p>"
        P.append(f"<section class='page'>{c}</section>")

    # territorio
    tam_orden = ["a. 1-9", "b. 10-49", "c. 50-199", "d. 200-499", "e. 500+"]
    c = f"<div class='kick'>Territorio · {titulo_amb}</div><h2>Establecimientos y plantas</h2><p>Padrón georreferenciado de establecimientos productivos del CEP XXI (Ministerio de Economía), filtrado por actividades metalúrgicas. El padrón no publica nombres de empresa.</p>"
    c += f"<h3>Establecimientos por rama</h3>{barras_h([(k or 's/d', v, '') for k, v in por_rama.most_common()], dec=0, ancho_etq=230, alto_fila=26)}"
    c += f"<h3>Por tamaño (trabajadores)</h3>{columnas([t[3:] for t in tam_orden], [por_tam.get(t, 0) for t in tam_orden], alto=170, destacar_ultimo=False)}"
    if not PV: c += f"<h3>Por provincia</h3>{barras_h([(k, v, '') for k, v in por_prov.most_common(10)], dec=0, ancho_etq=180, alto_fila=22)}"
    P.append(f"<section class='page'>{c}</section>")
    if plantas:
        filas_p = "".join(f"<tr><td><b>{p['nombre']}</b><div class='small'>{p.get('localidad', '')}, {p.get('provincia', '')}</div></td><td>{p.get('rama', '')}</td><td>{p.get('seccional') or ''}</td></tr>" for p in plantas[:24])
        filas_e = "".join(f"<tr><td>{e['fecha']}</td><td>{next((p['nombre'] for p in plantas if p['id'] == e['plantaId']), '')}</td><td>{e['tipo']}</td><td class='r'>{e.get('cantidad') or ''}</td><td class='small'>{e.get('fuente', '')}</td></tr>" for e in ev_amb[:12])
        P.append(f"<section class='page'><div class='kick'>Seguimiento propio</div><h2>Plantas relevadas</h2><table><thead><tr><th>Planta</th><th>Rama</th><th>Seccional UOM</th></tr></thead><tbody>{filas_p}</tbody></table>" + (f"<h3>Hechos registrados</h3><table><thead><tr><th>Fecha</th><th>Planta</th><th>Hecho</th><th class='r'>Trab.</th><th>Fuente</th></tr></thead><tbody>{filas_e}</tbody></table>" if filas_e else "") + "<p class='src'>Fuente: relevamiento del equipo del Observatorio (prensa, informes de empresas y datos aportados por la UOM).</p></section>")

    # importaciones
    if imp and imp.get("series"):
        P.append(pagina_importaciones(imp))

    # fuentes
    filas_f = "".join(f"<tr><td><b>{f['nombre']}</b></td><td>{f['frecuencia']}</td><td>{f['nivel']}</td></tr>" for f in fu["fuentes"])
    P.append(f"<section class='page'><div class='kick'>Metodología</div><h2>Fuentes y notas</h2><table><thead><tr><th>Fuente</th><th>Frecuencia</th><th>Nivel</th></tr></thead><tbody>{filas_f}</tbody></table><h3>Notas</h3><ul><li>Universo UOM: ramas CIIU 27, 28, 29, 31, 32, 34 (sin terminales, 3410) y 35. En el padrón CEP XXI: CLAE 24 a 28, 293 y 30.</li><li>Las cifras de empleo son asalariados registrados del sector privado; no incluyen monotributistas ni trabajo no registrado.</li><li>Los datos de ADIMRA y de la Cámara Argentina del Acero se toman de sus informes mensuales.</li><li>Este informe se genera automáticamente con los datos disponibles a la fecha de emisión.</li></ul></section>")

    base = HTML_BASE.replace("{{R}}", R)
    uom = next((f"{R}/img/{n}" for n in ("uom-logo-claro.png", "uom-logo.png", "uom-logo.svg") if os.path.exists(f"{R}/img/{n}")), None)
    PORTADA = PORTADA.replace("{R}", R).replace("{UOMLOGO}", f"<img src='file://{uom}'>" if uom else "")
    os.makedirs(f"{R}/informes", exist_ok=True)
    nombre = a.salida or f"informe-{'nacional' if not PV else slug(PV)}-{hoy.strftime('%Y-%m')}"
    tmp = f"{R}/informes/.tmp-{nombre}"
    open(tmp + "-tapa.html", "w").write(base + PORTADA + "</body></html>")
    open(tmp + "-cuerpo.html", "w").write(base + "".join(P) + "</body></html>")
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page()
        pg.goto(f"file://{tmp}-tapa.html"); pg.wait_for_timeout(400)
        pg.pdf(path=tmp + "-tapa.pdf", format="A4", print_background=True, margin={"top": "0", "bottom": "0", "left": "0", "right": "0"})
        pg.goto(f"file://{tmp}-cuerpo.html"); pg.wait_for_timeout(400)
        pg.pdf(path=tmp + "-cuerpo.pdf", format="A4", print_background=True, display_header_footer=True,
               header_template="<span></span>", footer_template=f"<div style='font-size:7px;font-family:monospace;color:#8a95a3;width:100%;padding:0 16mm;display:flex;justify-content:space-between'><span>MIDTM · Modelo de Interpretación de Datos del Trabajo Metalúrgico · {titulo_amb} · {fecha}</span><span class='pageNumber'></span></div>",
               margin={"top": "14mm", "bottom": "14mm", "left": "0", "right": "0"})
        b.close()
    from pypdf import PdfWriter
    w = PdfWriter()
    for parte in ("tapa", "cuerpo"): w.append(f"{tmp}-{parte}.pdf")
    w.write(f"{R}/informes/{nombre}.pdf")
    for ext in ("tapa.html", "cuerpo.html", "tapa.pdf", "cuerpo.pdf"): os.remove(f"{tmp}-{ext}")
    print(f"informes/{nombre}.pdf")


def slug(s):
    import unicodedata
    return unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode().lower().replace(" ", "-")


def lectura(e_ia, ipi_ia, uci, adimra):
    partes = []
    neg = [n for n, v, _ in ipi_ia if v < 0]
    if adimra and ult(adimra)[0][1] < 0: partes.append("La actividad metalúrgica sigue por debajo de un año atrás")
    elif adimra: partes.append("La actividad metalúrgica muestra una mejora interanual")
    if neg: partes.append(f"{len(neg)} de {len(ipi_ia)} ramas producen menos que hace un año")
    if e_ia is not None: partes.append(f"el empleo registrado {'cae' if e_ia < 0 else 'crece'} {num(abs(e_ia))}% interanual")
    t = "; ".join(partes) + "." if partes else ""
    return t[0].upper() + t[1:] + " La baja utilización de la capacidad instalada indica margen ocioso: cualquier recuperación de la demanda puede absorberse sin inversión nueva, pero también que la presión sobre dotaciones y horas puede continuar mientras la demanda no repunte." if t else ""


def pagina_importaciones(imp):
    IS = imp["series"]; u = IS[0]["datos"][-1]["periodo"]; ya, ma = int(u[:4]), int(u[5:7])
    acum = lambda s, y: sum(d["valor"] for d in s["datos"] if d["periodo"].startswith(f"{y}-") and int(d["periodo"][5:7]) <= ma)
    it = sorted([(s["nombre"].split(" (")[0], (acum(s, ya) / acum(s, ya - 1) - 1) * 100 if acum(s, ya - 1) else 0, f"USD {num(acum(s, ya), 0)} millones") for s in IS], key=lambda x: -x[1])
    mens = {}
    for s in IS:
        for d in s["datos"]: mens[d["periodo"]] = mens.get(d["periodo"], 0) + d["valor"]
    ms = sorted(mens)[-36:]
    cols = [MOLT if v > 0 else STEEL for _, v, _ in it]
    return (f"<section class='page'><div class='kick'>Comercio exterior · Ámbito nacional</div><h2>Importaciones que compiten</h2><p>{imp.get('descripcion', '')}</p>"
            f"<h3>Variación acumulada enero–{MESES_L[ma - 1]} {ya} contra igual período de {ya - 1}</h3><p class='small'>Número a la derecha: variación porcentual. Naranja: suben las importaciones; azul: bajan.</p>{barras_h(it, unidad='%', signo=True, ancho_etq=300, alto_fila=34, colores=cols)}"
            f"<h3>Total importado por mes, millones de USD</h3>{lineas([('Total', [round(mens[m], 1) for m in ms], MOLT)], alto=230, etiquetas_x=[mes_c(m) for m in ms], cada=6)}"
            f"<p class='src'>Fuente: {imp.get('fuente', 'INDEC')}. Valores CIF.</p></section>")


HTML_BASE = """<!doctype html><html lang='es'><head><meta charset='utf-8'><style>
@font-face{font-family:'Barlow Condensed';font-weight:700;src:url(file://{{R}}/fonts/barlow-condensed-latin-700-normal.woff2)}
@font-face{font-family:'Barlow Condensed';font-weight:600;src:url(file://{{R}}/fonts/barlow-condensed-latin-600-normal.woff2)}
@font-face{font-family:'IBM Plex Sans';font-weight:400;src:url(file://{{R}}/fonts/ibm-plex-sans-latin-400-normal.woff2)}
@font-face{font-family:'IBM Plex Sans';font-weight:600;src:url(file://{{R}}/fonts/ibm-plex-sans-latin-600-normal.woff2)}
@font-face{font-family:'IBM Plex Mono';font-weight:400;src:url(file://{{R}}/fonts/ibm-plex-mono-latin-400-normal.woff2)}
@page{size:A4}
*{box-sizing:border-box}body{margin:0;font-family:'IBM Plex Sans',sans-serif;color:#111a25;font-size:10pt;line-height:1.5}
.page{padding:4mm 16mm 0;page-break-after:always}.page:last-child{page-break-after:auto}
.kick{font-family:'IBM Plex Mono',monospace;font-size:7.5pt;letter-spacing:.16em;text-transform:uppercase;color:#e05a12;display:flex;gap:8px;align-items:center}
.kick:before{content:"";width:22px;height:2px;background:#e05a12}
h1,h2,h3{font-family:'Barlow Condensed',sans-serif;text-transform:uppercase;margin:0;line-height:.95}
h2{font-size:30pt;color:#0e2a4f;margin:2mm 0 4mm}h3{font-size:13pt;color:#0e2a4f;margin:5mm 0 1.5mm;break-after:avoid}
p{margin:0 0 2.5mm}svg{display:block;break-inside:avoid;margin:1mm 0}
.src{font-size:7.5pt;color:#6b7684;margin-top:1.5mm}.small{font-size:8pt;color:#5a6573}
.cover{background:#0e2a4f;color:#fff;height:297mm;padding:0;overflow:hidden}
.cover .in{padding:30mm 18mm 22mm;height:100%;display:flex;flex-direction:column}
.marcas{display:flex;justify-content:space-between;align-items:center}.marcas img{height:22mm}
.cover h1{font-size:50pt;line-height:.9;margin:10mm 0 6mm;color:#fff}.cover h1 em{font-style:normal;color:#ff7a2e}
.lt{color:#c9d6e6}.kick.lt{color:#ff9b63}.kick.lt:before{background:#ff9b63}.lead{font-size:12.5pt;line-height:1.45}
.kpis{display:grid;grid-template-columns:1fr 1fr;gap:5mm;margin-top:12mm}
.kpi{border-top:2px solid #ff7a2e;padding-top:3mm}.kpi .v{font-family:'Barlow Condensed';font-weight:700;font-size:36pt;line-height:1}.kpi.neg .v{color:#ff9b63}.kpi .l{font-size:9pt;color:#c9d6e6}
.res{padding-left:5mm;margin:0}.res li{margin-bottom:3mm;font-size:10.5pt}
.nota{background:#f2f5f8;border-radius:2mm;padding:3mm 4mm;font-size:8.5pt;color:#334050;margin-top:6mm}
table{border-collapse:collapse;width:100%;font-size:8.8pt}th{text-align:left;font-size:7pt;letter-spacing:.08em;text-transform:uppercase;color:#5a6573;border-bottom:1.5px solid #0e2a4f;padding:1.5mm 2mm}
td{padding:1.6mm 2mm;border-bottom:1px solid #e1e6eb;vertical-align:top}tr{break-inside:avoid}.r{text-align:right}.neg{color:#c24a0a;font-weight:600}.pos{color:#1b4b8a}
ul{padding-left:5mm}.nv{font-family:'IBM Plex Mono';font-size:7pt;font-weight:600;padding:.5mm 1.5mm;border-radius:1mm;background:#eef2f6;color:#5a6573}.nv.alta{background:#fdeee3;color:#c24a0a}.nv.media{background:#fbf3dc;color:#a07208}li{margin-bottom:1.5mm}
</style></head><body>"""

if __name__ == "__main__":
    main()
