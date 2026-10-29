"""Gráficos SVG simples y legibles para los informes (sin dependencias)."""
INK = "#111a25"; MUT = "#5a6573"; LINE = "#e1e6eb"; STEEL = "#1b4b8a"; STEEL2 = "#9db6d6"; MOLT = "#e05a12"; NAVY = "#0e2a4f"; GREEN = "#2f7d4f"
PAL = [STEEL, MOLT, "#2f8f8a", "#7a3fb0", "#b8860b", "#c0392b", "#5d6d7e"]
F = "font-family='IBM Plex Sans,sans-serif'"


def num(v, d=1):
    if v is None: return "s/d"
    s = f"{abs(v):,.{d}f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return ("-" if v < 0 else "") + s


def _ticks(lo, hi, n=5):
    import math
    if hi == lo: hi = lo + 1
    paso = (hi - lo) / n; m = 10 ** math.floor(math.log10(paso)); paso = min([1, 2, 2.5, 5, 10], key=lambda k: abs(k * m - paso)) * m
    a = math.floor(lo / paso) * paso; t = []
    while a <= hi + paso * .01: t.append(round(a, 10)); a += paso
    return t


def lineas(series, ancho=760, alto=280, unidad="", dec=0, etiquetas_x=None, cada=1, cero=False, marcar_ultimo=True):
    """series: [(nombre, [valores...], color)] sobre el mismo eje x (etiquetas_x)."""
    vals = [v for _, s, _ in series for v in s if v is not None]
    lo, hi = min(vals), max(vals)
    if cero: lo = min(0, lo)
    pad = (hi - lo) * .08 or 1; T = _ticks(lo - pad, hi + pad)
    lo, hi = T[0], T[-1]
    l, r, t, b = 56, 70, 14, 46; n = max(len(s) for _, s, _ in series)
    X = lambda i: l + (ancho - l - r) * (i / max(n - 1, 1)); Y = lambda v: t + (1 - (v - lo) / (hi - lo)) * (alto - t - b)
    s = f"<svg viewBox='0 0 {ancho} {alto}' width='100%' xmlns='http://www.w3.org/2000/svg'>"
    for v in T: s += f"<line x1='{l}' x2='{ancho - r}' y1='{Y(v):.1f}' y2='{Y(v):.1f}' stroke='{LINE if v else MUT}'/><text x='{l - 8}' y='{Y(v) + 4:.1f}' {F} font-size='11' fill='{MUT}' text-anchor='end'>{num(v, dec if abs(T[1]-T[0])<1 else 0)}{unidad}</text>"
    if etiquetas_x:
        for i, e in enumerate(etiquetas_x):
            if i % cada == 0 or i == n - 1: s += f"<text x='{X(i):.1f}' y='{alto - b + 18}' {F} font-size='11' fill='{MUT}' text-anchor='middle'>{e}</text>"
    for k, (nom, vs, col) in enumerate(series):
        pts = [(X(i), Y(v)) for i, v in enumerate(vs) if v is not None]
        if not pts: continue
        s += f"<polyline points='{' '.join(f'{x:.1f},{y:.1f}' for x, y in pts)}' fill='none' stroke='{col}' stroke-width='2.4' stroke-linejoin='round'/>"
        if marcar_ultimo:
            ult = [v for v in vs if v is not None][-1]; x, y = pts[-1]
            s += f"<circle cx='{x:.1f}' cy='{y:.1f}' r='3.6' fill='{col}'/><text x='{x + 7:.1f}' y='{y + 4:.1f}' {F} font-size='12' font-weight='700' fill='{col}'>{num(ult, dec)}{unidad}</text>"
    if len(series) > 1:
        x0 = l
        for nom, _, col in series:
            s += f"<rect x='{x0}' y='{alto - 16}' width='12' height='4' rx='2' fill='{col}'/><text x='{x0 + 17}' y='{alto - 10}' {F} font-size='11' fill='{INK}'>{nom}</text>"; x0 += 26 + len(nom) * 6.1
    return s + "</svg>"


def barras_h(items, ancho=760, unidad="", dec=1, signo=False, alto_fila=30, ancho_etq=260, colores=None):
    """items: [(etiqueta, valor, sub)] valores positivos y/o negativos."""
    vals = [v for _, v, _ in items]; lo, hi = min(0, min(vals)), max(0, max(vals))
    l = ancho_etq + (62 if lo < 0 else 0); r = 70; w = ancho - l - r; h = len(items) * alto_fila + 10
    X = lambda v: l + (v - lo) / ((hi - lo) or 1) * w
    s = f"<svg viewBox='0 0 {ancho} {h}' width='100%' xmlns='http://www.w3.org/2000/svg'><line x1='{X(0):.1f}' x2='{X(0):.1f}' y1='0' y2='{h}' stroke='{MUT}'/>"
    for i, (lab, v, sub) in enumerate(items):
        y = 5 + i * alto_fila; col = colores[i] if colores else (MOLT if v < 0 else STEEL)
        x1, x2 = sorted([X(0), X(v)])
        s += f"<text x='{ancho_etq - 10}' y='{y + alto_fila / 2 + 1}' {F} font-size='12' fill='{INK}' text-anchor='end'>{lab}</text>"
        if sub: s += f"<text x='{ancho_etq - 10}' y='{y + alto_fila / 2 + 13}' {F} font-size='9.5' fill='{MUT}' text-anchor='end'>{sub}</text>"
        s += f"<rect x='{x1:.1f}' y='{y + 5}' width='{max(x2 - x1, 1):.1f}' height='{alto_fila - 12}' rx='2' fill='{col}'/>"
        tx = X(v) + (6 if v >= 0 else -6); anc = "start" if v >= 0 else "end"
        s += f"<text x='{tx:.1f}' y='{y + alto_fila / 2 + 3}' {F} font-size='12' font-weight='700' fill='{col}' text-anchor='{anc}'>{'+' if signo and v > 0 else ''}{num(v, dec)}{unidad}</text>"
    return s + "</svg>"


def columnas(etqs, vals, ancho=760, alto=240, unidad="", dec=0, destacar_ultimo=True, colores=None, cada=1):
    lo, hi = min(0, min(vals)), max(0, max(vals)); T = _ticks(lo, hi * 1.08 if hi > 0 else hi); lo, hi = T[0], T[-1]
    l, r, t, b = 50, 12, 14, 30; n = len(vals); gw = (ancho - l - r) / n
    Y = lambda v: t + (1 - (v - lo) / (hi - lo)) * (alto - t - b)
    s = f"<svg viewBox='0 0 {ancho} {alto}' width='100%' xmlns='http://www.w3.org/2000/svg'>"
    for v in T: s += f"<line x1='{l}' x2='{ancho - r}' y1='{Y(v):.1f}' y2='{Y(v):.1f}' stroke='{LINE if v else MUT}'/><text x='{l - 6}' y='{Y(v) + 4:.1f}' {F} font-size='10.5' fill='{MUT}' text-anchor='end'>{num(v, 0)}{unidad}</text>"
    for i, v in enumerate(vals):
        col = (colores[i] if colores else (MOLT if destacar_ultimo and i == n - 1 else STEEL))
        x = l + i * gw + gw * .14; bw = gw * .72; y1, y2 = sorted([Y(0), Y(v)])
        s += f"<rect x='{x:.1f}' y='{y1:.1f}' width='{bw:.1f}' height='{max(y2 - y1, .5):.1f}' fill='{col}' rx='1.5'/>"
        if i % cada == 0 or i == n - 1: s += f"<text x='{x + bw / 2:.1f}' y='{alto - b + 15}' {F} font-size='10' fill='{MUT}' text-anchor='middle'>{etqs[i]}</text>"
        if n <= 16 or i == n - 1: s += f"<text x='{x + bw / 2:.1f}' y='{(y1 - 4) if v >= 0 else (y2 + 12):.1f}' {F} font-size='10.5' font-weight='700' fill='{col}' text-anchor='middle'>{num(v, dec)}</text>"
    return s + "</svg>"
