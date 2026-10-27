import { fmtNumero, fmtPct } from "./formato";

const ESTADOS_ALTA = ["AUDITADA WEB", "ALTA TRANSACCIONAL"];

export function productoCorto(producto) {
  const p = (producto || "").toString().toUpperCase();
  if (p.includes("BILLETERA")) return "BP";
  if (p.includes("RUEDA")) return "RS";
  if (p.includes("COMBO")) return "PCV";
  return "CP";
}

function aFecha(iso) {
  const [a, m, d] = String(iso).split("T")[0].split("-").map(Number);
  return new Date(a, m - 1, d);
}

const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const fmtCorta = (isoFecha) =>
  aFecha(isoFecha).toLocaleDateString("es-CO", { day: "2-digit", month: "short" }).replace(".", "");

/** Días hábiles (lun–vie) más recientes hasta el corte, del más nuevo al más viejo,
 * dentro del mes. No conoce festivos: por eso las alertas dicen "revisar". */
function diasHabilesHastaCorte(fechaCorte, cuantos) {
  const out = [];
  const d = aFecha(fechaCorte);
  while (out.length < cuantos && d.getDate() >= 1) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) out.push(iso(d));
    const ant = new Date(d);
    ant.setDate(d.getDate() - 1);
    if (ant.getMonth() !== d.getMonth()) break;
    d.setTime(ant.getTime());
  }
  return out;
}

/** Días efectivos de trabajo: el calendario, o lo que ajustó Martha. */
export function diasEfectivos(calendario, diasAjustados) {
  const cal = calendario.dias_laborados;
  return diasAjustados != null ? diasAjustados : cal;
}

/** Sugerencias automáticas de la auditoría, según lo que se está viendo.
 * Devuelve [{ tipo: "bien" | "alerta" | "info", texto }] en tono constructivo.
 * Todo sale de datos que ya trae el Como vamos del asesor; nada se inventa. */
export function sugerenciasAuditoria({
  resumen, ventas = [], calendario, otrosi, equipoRef, fechaCorte,
  diasAjustados = null, fechasNoLaboradas = [], audioMarcadas = 0,
}) {
  const out = [];
  if (!resumen || !(resumen.meta_mes > 0)) {
    out.push({ tipo: "alerta", texto: "Este asesor no tiene meta cargada: sin ella no hay semáforo ni proyección." });
    return out;
  }
  const { meta_mes: meta, acumulado } = resumen;
  const pct = acumulado / meta;
  const ideal = resumen.pct_cump_ideal ?? 0;
  const diasCal = calendario.dias_laborados;
  const dias = diasEfectivos(calendario, diasAjustados);
  const porLaborar = calendario.dias_por_laborar;

  // Avance frente a la meta y al ideal
  if (pct >= ideal) {
    out.push({ tipo: "bien", texto: `Va al ${fmtPct(pct)} de su meta, por encima del ideal a la fecha (${fmtPct(ideal)}).` });
  } else {
    const falta = Math.max(meta - acumulado, 0);
    const porDia = porLaborar > 0 ? falta / porLaborar : falta;
    out.push({
      tipo: "info",
      texto: `Va al ${fmtPct(pct)} (ideal ${fmtPct(ideal)}). Para la meta necesita ≈ ${porDia.toFixed(1).replace(".", ",")} ventas por día en los ${porLaborar} días que quedan.`,
    });
  }

  // Otrosí
  if (otrosi) {
    const metaAj = meta * otrosi.pct_minimo_comision;
    if (acumulado >= metaAj) {
      out.push({ tipo: "bien", texto: `Ya superó el ${fmtPct(otrosi.pct_minimo_comision)} de su meta (${fmtNumero(metaAj)}): la comisión queda habilitada por el otrosí.` });
    } else {
      const f = Math.ceil(metaAj - acumulado);
      out.push({ tipo: "info", texto: `Le faltan ${fmtNumero(f)} ventas para el ${fmtPct(otrosi.pct_minimo_comision)} del otrosí (${fmtNumero(metaAj)}).` });
    }
  }

  // Ritmo y proyección (con los días ajustados si Martha los cambió)
  if (dias > 0) {
    const prom = acumulado / dias;
    const proy = prom * (dias + porLaborar);
    const ajustado = diasAjustados != null && diasAjustados !== diasCal;
    out.push({
      tipo: proy >= meta ? "bien" : "info",
      texto: `${ajustado ? `Con ${dias} días laborados (ajustados) su` : "Su"} promedio es ${prom.toFixed(1).replace(".", ",")} por día y proyecta cerrar en ${fmtNumero(proy)} (${fmtPct(meta ? proy / meta : 0)} de la meta).`,
    });
    if (equipoRef && equipoRef.prom_por_dia > 0) {
      out.push(
        prom >= equipoRef.prom_por_dia
          ? { tipo: "bien", texto: `Su promedio diario supera el del equipo (${equipoRef.prom_por_dia.toFixed(1).replace(".", ",")}).` }
          : { tipo: "info", texto: `Promedio diario del equipo: ${equipoRef.prom_por_dia.toFixed(1).replace(".", ",")} por día; el asesor lleva ${prom.toFixed(1).replace(".", ",")}.` }
      );
    }
  }

  // Días hábiles recientes sin ventas
  const porDia = new Map();
  for (const v of ventas) porDia.set(v.fecha_venta, (porDia.get(v.fecha_venta) || 0) + 1);
  const exentos = new Set(fechasNoLaboradas);
  const recientes = diasHabilesHastaCorte(fechaCorte, 8).filter((f) => !exentos.has(f));
  let racha = 0;
  for (const f of recientes) {
    if (porDia.has(f)) break;
    racha += 1;
  }
  if (racha >= 2) {
    out.push({
      tipo: "alerta",
      texto: `Lleva ${racha} días hábiles seguidos sin ventas (desde el ${fmtCorta(recientes[racha - 1])}). Revisar si fueron laborados o si hubo una novedad.`,
    });
  }

  // Producto que dejó de venderse
  const ultimos = new Set(diasHabilesHastaCorte(fechaCorte, 5).filter((f) => !exentos.has(f)));
  const vendidos = new Set(ventas.map((v) => productoCorto(v.producto)));
  const recientesProd = new Set(ventas.filter((v) => ultimos.has(v.fecha_venta)).map((v) => productoCorto(v.producto)));
  for (const p of vendidos) {
    if (!recientesProd.has(p) && ultimos.size >= 3) {
      out.push({ tipo: "info", texto: `No registra ventas de ${p} en los últimos ${ultimos.size} días hábiles; antes sí vendía.` });
    }
  }

  // Cancelaciones
  const total = ventas.length;
  const canceladas = ventas.filter((v) => v.estado === "CANCELADA");
  if (total > 0) {
    const tasa = canceladas.length / total;
    if (tasa >= 0.15) {
      out.push({ tipo: "alerta", texto: `${canceladas.length} de ${total} ventas (${fmtPct(tasa)}) están canceladas: conviene revisar sus causales.` });
    } else if (canceladas.length === 0) {
      out.push({ tipo: "bien", texto: "No tiene ventas canceladas." });
    } else if (tasa <= 0.05) {
      out.push({ tipo: "bien", texto: `Cancelaciones bajas: ${canceladas.length} de ${total} (${fmtPct(tasa)}).` });
    }
    const canceladasDia = new Map();
    for (const c of canceladas) canceladasDia.set(c.fecha_venta, (canceladasDia.get(c.fecha_venta) || 0) + 1);
    const pico = [...canceladasDia.entries()].sort((a, b) => b[1] - a[1])[0];
    if (pico && pico[1] >= 3) {
      out.push({ tipo: "alerta", texto: `${pico[1]} canceladas de ventas del ${fmtCorta(pico[0])}: posible novedad ese día (audio, sistema u otra).` });
    }
  }
  if (audioMarcadas > 0) {
    out.push({
      tipo: "info",
      texto: `${audioMarcadas} cancelada${audioMarcadas === 1 ? "" : "s"} marcada${audioMarcadas === 1 ? "" : "s"} como falla de audio: se reconocen y cuentan en su ejecución según el otrosí.`,
    });
  }

  const altas = ventas.filter((v) => ESTADOS_ALTA.includes(v.estado)).length;
  if (total > 0 && altas / total >= 0.7) {
    out.push({ tipo: "bien", texto: `${fmtPct(altas / total)} de sus ventas ya son altas confirmadas.` });
  }
  return out;
}

/** Sugerencias de la auditoría INTERNA (cancelaciones). `canceladas` es la
 * revisión cargada del Excel; `eventualidades` el mapa contrato -> etiqueta. */
export function sugerenciasInterna({ canceladas, totalCanceladasTablero, totalVentas, eventualidades = {} }) {
  const out = [];
  if (totalVentas > 0) {
    const tasa = totalCanceladasTablero / totalVentas;
    if (totalCanceladasTablero === 0) out.push({ tipo: "bien", texto: "No tiene ventas canceladas." });
    else if (tasa <= 0.05) out.push({ tipo: "bien", texto: `Cancelaciones bajas: ${totalCanceladasTablero} de ${totalVentas} (${fmtPct(tasa)}).` });
    else if (tasa >= 0.15) out.push({ tipo: "alerta", texto: `${totalCanceladasTablero} de ${totalVentas} ventas (${fmtPct(tasa)}) están canceladas.` });
    else out.push({ tipo: "info", texto: `${totalCanceladasTablero} de ${totalVentas} ventas (${fmtPct(tasa)}) están canceladas.` });
  }
  if (canceladas.length === 0) return out;

  const porCausal = new Map();
  for (const c of canceladas) {
    const k = c.causal_gestion || "Sin causal";
    porCausal.set(k, (porCausal.get(k) || 0) + 1);
  }
  const [causal, n] = [...porCausal.entries()].sort((a, b) => b[1] - a[1])[0];
  out.push({ tipo: "info", texto: `La causal más frecuente es “${causal}”: ${n} de ${canceladas.length} (${fmtPct(n / canceladas.length)}).` });

  const sinGestion = canceladas.filter((c) => !c.estado_subsanacion && !c.resultado_re_auditoria && !c.gestion_supervisor_tmk).length;
  if (sinGestion > 0) out.push({ tipo: "alerta", texto: `${sinGestion} cancelada${sinGestion === 1 ? "" : "s"} sin gestión de subsanación registrada.` });
  else out.push({ tipo: "bien", texto: "Todas las canceladas tienen gestión registrada." });

  const porDia = new Map();
  for (const c of canceladas) if (c.fecha_venta) porDia.set(c.fecha_venta, (porDia.get(c.fecha_venta) || 0) + 1);
  const pico = [...porDia.entries()].sort((a, b) => b[1] - a[1])[0];
  if (pico && pico[1] >= 3) out.push({ tipo: "alerta", texto: `${pico[1]} canceladas son de ventas del ${fmtCorta(pico[0])}: ¿hubo alguna eventualidad ese día?` });

  const faltantes = totalCanceladasTablero - canceladas.length;
  if (faltantes > 0) out.push({ tipo: "info", texto: `${faltantes} cancelada${faltantes === 1 ? "" : "s"} del tablero no aparece${faltantes === 1 ? "" : "n"} en el reporte de revisión.` });

  const audio = Object.values(eventualidades).filter((e) => e === "Falla de audio").length;
  if (audio > 0) out.push({ tipo: "info", texto: `${audio} marcada${audio === 1 ? "" : "s"} como falla de audio: se reconocen según el otrosí.` });
  return out;
}
