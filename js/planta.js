// Pulso de Planta: partes por área, OEE, paradas y cuello de botella. Sin dependencias.
// Modelo ISA-95: empresa → planta → área → línea. Para otra rama solo se cambia PLANTA.
(function () {
  const PLANTA = {
    empresa: "Metalúrgica Ejemplo S.A. (ficticia)", planta: "Planta de ejes",
    // minutos planificados por turno y ciclo ideal en segundos por pieza
    areas: [
      { id: "corte", nombre: "Corte de barras", linea: "Sierra 1", plan: 450, ciclo: 40 },
      { id: "forja", nombre: "Forja", linea: "Prensa 800 t", plan: 450, ciclo: 55 },
      { id: "mecan", nombre: "Mecanizado CNC", linea: "Tornos 1 y 2", plan: 450, ciclo: 50 },
      { id: "termico", nombre: "Tratamiento térmico", linea: "Horno continuo", plan: 450, ciclo: 62 },
      { id: "calidad", nombre: "Control de calidad", linea: "Banco de ensayo", plan: 450, ciclo: 35 },
      { id: "expedicion", nombre: "Expedición", linea: "Embalaje", plan: 450, ciclo: 30 },
    ],
    motivos: ["Falta de material", "Rotura o falla", "Cambio de herramienta", "Ajuste de máquina", "Falta de personal", "Espera de calidad", "Corte de energía"],
  };
  const KEY = "pulso-planta-partes";
  const $ = (id) => document.getElementById(id);
  const pct = (x) => (x == null || isNaN(x) ? "—" : Math.round(x * 100) + " %");
  const tono = (x) => (x >= 0.85 ? "ok" : x >= 0.6 ? "warn" : "bad");

  // Demo: 14 días, 2 turnos, con el horno como cuello de botella. Semilla fija: siempre da lo mismo.
  function demo() {
    let s = 7; const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    const out = [], hoy = new Date();
    for (let d = 13; d >= 0; d--) {
      const f = new Date(hoy - d * 864e5); if (f.getDay() === 0) continue;
      const fecha = f.toISOString().slice(0, 10);
      for (const turno of ["Mañana", "Tarde"]) { let previa = Infinity; for (const a of PLANTA.areas) {
        const parada = Math.round((a.id === "termico" ? 60 : 25) + r() * 50);
        const corre = a.plan - parada, ideal = (corre * 60) / a.ciclo;
        const hechas = Math.min(Math.round(ideal * (0.78 + r() * 0.17)), previa);   // no puede procesar más de lo que le llega
        const rech = Math.round(hechas * (a.id === "forja" || a.id === "termico" ? 0.03 + r() * 0.03 : 0.005 + r() * 0.01));
        const motivo = a.id === "termico" ? (r() < 0.6 ? "Ajuste de máquina" : "Espera de calidad") : PLANTA.motivos[Math.floor(r() * 5)];
        out.push({ fecha, turno, area: a.id, buenas: hechas - rech, rechazos: rech, parada, motivo });
        previa = hechas - rech;
      } }
    }
    return out;
  }
  function leer() { try { const v = JSON.parse(localStorage.getItem(KEY) || "null"); return Array.isArray(v) && v.length ? v : null; } catch { return null; } }
  function guardar(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); return true; } catch { return false; } }

  function calcular(partes) {
    const por = {};
    for (const a of PLANTA.areas) por[a.id] = { ...a, turnos: 0, plan: 0, parada: 0, buenas: 0, rech: 0, ideal: 0 };
    for (const p of partes) {
      const x = por[p.area]; if (!x) continue;
      x.turnos++; x.plan += PLANTA.areas.find((a) => a.id === p.area).plan; x.parada += +p.parada || 0;
      x.buenas += +p.buenas || 0; x.rech += +p.rechazos || 0;
    }
    for (const x of Object.values(por)) {
      const corre = x.plan - x.parada, total = x.buenas + x.rech;
      x.D = x.plan ? corre / x.plan : null;
      x.R = corre > 0 ? Math.min(1, total / ((corre * 60) / x.ciclo)) : null;
      x.C = total ? x.buenas / total : null;
      x.OEE = x.D != null && x.R != null && x.C != null ? x.D * x.R * x.C : null;
      x.porTurno = x.turnos ? x.buenas / x.turnos : 0;
    }
    return Object.values(por);
  }

  function dibujar() {
    const guardados = leer(), partes = guardados || demo();
    $("modo").textContent = guardados ? `${partes.length} partes cargados` : "Demo: planta de ejes ficticia";
    const A = calcular(partes).filter((a) => a.turnos);
    A.forEach((a) => (a.capacidad = a.turnos ? ((a.plan - a.parada) * 60 / a.ciclo) / a.turnos : 0));
    const cuello = A.reduce((m, a) => (a.capacidad < m.capacidad ? a : m), A[0]);
    const oeePlanta = cuello ? cuello.OEE : null;           // la planta rinde lo que rinde su etapa más lenta
    const paradaTot = A.reduce((s, a) => s + a.parada, 0), rech = A.reduce((s, a) => s + a.rech, 0), tot = A.reduce((s, a) => s + a.rech + a.buenas, 0);
    const ult = PLANTA.areas[PLANTA.areas.length - 1];
    const dias = [...new Set(partes.map((p) => p.fecha))].sort();
    const porDia = dias.map((d) => partes.filter((p) => p.fecha === d && p.area === ult.id).reduce((s, p) => s + (+p.buenas || 0), 0));

    $("kpis").innerHTML = [
      [pct(oeePlanta), "OEE de la planta (lo marca el cuello de botella)", tono(oeePlanta)],
      [cuello ? cuello.nombre : "—", "Cuello de botella: el área con menos capacidad real por turno", "bad"],
      [Math.round(paradaTot / 60) + " h", "Horas paradas en el período", ""],
      [pct(tot ? rech / tot : null), "Rechazos sobre lo producido", ""],
      [porDia.length ? Math.round(porDia.reduce((s, v) => s + v, 0) / porDia.length).toLocaleString("es-AR") : "—", "Piezas terminadas por día (promedio)", ""],
    ].map(([v, t, c]) => `<div class="kpi"><b class="${c}">${v}</b><span>${t}</span></div>`).join("");

    $("tabla").innerHTML = "<tr><th>Área</th><th>Disponib.</th><th>Rendim.</th><th>Calidad</th><th>OEE</th><th>Pzas/turno</th></tr>" +
      A.map((a) => `<tr><td>${a.nombre}${a === cuello ? ' <span class="tag">cuello</span>' : ""}</td><td class="mono">${pct(a.D)}</td><td class="mono">${pct(a.R)}</td><td class="mono">${pct(a.C)}</td><td class="mono ${tono(a.OEE)}"><b>${pct(a.OEE)}</b></td><td class="mono">${Math.round(a.porTurno)}</td></tr>`).join("");

    const mot = {}; for (const p of partes) if (+p.parada) mot[p.motivo] = (mot[p.motivo] || 0) + +p.parada;
    const lista = Object.entries(mot).sort((a, b) => b[1] - a[1]), max = lista[0] ? lista[0][1] : 1;
    let acum = 0;
    $("pareto").innerHTML = lista.map(([m, v]) => { acum += v; return `<div class="bar"><span>${m}</span><i style="width:${(v / max) * 45}%"></i><small class="mono">${Math.round(v / 60)} h · ${Math.round((acum / paradaTot) * 100)} % acum.</small></div>`; }).join("") || '<p class="note">Sin paradas cargadas.</p>';

    $("ultima").textContent = ult.nombre;
    const mx = Math.max(1, ...porDia);
    $("diaria").innerHTML = porDia.map((v, i) => `<i title="${dias[i]}: ${v} piezas" style="height:${(v / mx) * 100}%"></i>`).join("");
    $("diariaEje").textContent = dias.length ? `${dias[0].slice(8)}/${dias[0].slice(5, 7)} → ${dias.at(-1).slice(8)}/${dias.at(-1).slice(5, 7)} · máximo ${mx} piezas` : "";

    $("arbol").innerHTML = `<b>${PLANTA.empresa}</b><div>${PLANTA.planta}${PLANTA.areas.map((a) => `<div>${a.nombre}<div class="note">${a.linea} · ciclo ideal ${a.ciclo} s</div></div>`).join("")}</div>`;
  }

  $("selArea").innerHTML = PLANTA.areas.map((a) => `<option value="${a.id}">${a.nombre}</option>`).join("");
  $("selMotivo").innerHTML = PLANTA.motivos.map((m) => `<option>${m}</option>`).join("");
  document.querySelector('[name="fecha"]').value = new Date().toISOString().slice(0, 10);
  $("parte").addEventListener("submit", (e) => {
    e.preventDefault();
    const p = Object.fromEntries(new FormData(e.target));
    const v = leer() || []; v.push(p);
    $("msg").textContent = guardar(v) ? "Parte guardado. Los números de arriba ya lo incluyen." : "Este navegador no deja guardar datos.";
    dibujar();
  });
  $("borrar").addEventListener("click", () => { try { localStorage.removeItem(KEY); } catch {} $("msg").textContent = "Se volvió a la demo."; dibujar(); });
  dibujar();
})();
