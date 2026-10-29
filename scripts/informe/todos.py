"""Genera el informe nacional y uno por provincia, y el índice informes/indice.json que lista el sitio."""
import json, os, subprocess, sys, datetime as dt
R = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
geo = json.load(open(f"{R}/data/provincias.json"))
mes = dt.date.today().strftime("%Y-%m")
items = [("Total país", None)] + [(p, p) for p in sorted(geo["p"], key=lambda x: x.replace("Á", "A").replace("É", "E"))]
out = []
for nombre, pv in items:
    args = [sys.executable, f"{R}/scripts/informe/generar.py"] + (["--provincia", pv] if pv else [])
    r = subprocess.run(args, capture_output=True, text=True)
    if r.returncode: print("ERROR", nombre, r.stderr[-400:]); continue
    out.append({"ambito": nombre, "archivo": r.stdout.strip().splitlines()[-1], "mes": mes})
    print("✓", nombre)
if len(out) < len(items):
    print(f"Hubo errores en {len(items) - len(out)} informes: no se borra nada ni se actualiza el índice."); sys.exit(1)
# borrar informes de meses anteriores que ya no están en el índice
vigentes = {o["archivo"] for o in out}
for f in os.listdir(f"{R}/informes"):
    if f.endswith(".pdf") and f"informes/{f}" not in vigentes: os.remove(f"{R}/informes/{f}")
json.dump({"actualizado": dt.date.today().isoformat(), "informes": out}, open(f"{R}/informes/indice.json", "w"), ensure_ascii=False, indent=1)
