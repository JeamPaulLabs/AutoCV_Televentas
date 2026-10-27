import { fmtMoney, fmtNumero, fmtPct } from "../../utils/formato";
import { SEMAFORO, nivelSemaforo } from "../../utils/semaforo";

function Dato({ label, value, sub }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-white/70">{label}</div>
      <div className="text-xl font-bold text-white tabular-nums leading-tight">{value}</div>
      {sub && <div className="text-[11px] text-white/65">{sub}</div>}
    </div>
  );
}

/** % ideal del equipo = promedio de los % ideal de cada asesor ponderado por su meta. */
function idealEquipo(asesores) {
  const conMeta = asesores.filter((a) => a.meta_mes > 0);
  const metaTotal = conMeta.reduce((s, a) => s + a.meta_mes, 0);
  if (!metaTotal) return 0;
  return conMeta.reduce((s, a) => s + a.meta_mes * a.pct_cump_ideal, 0) / metaTotal;
}


/** Avance del equipo. Sin otrosí: acumulado de todos los estados contra la suma
 * de las metas individuales. Con otrosí vigente la meta es la del equipo
 * (meta_equipo_altas_positivas) y solo cuentan las altas positivas, igual que
 * la tarjeta del otrosí y la condición de comisión (src/comisiones.py). */
export default function AvanceEquipo({ data }) {
  const cal = data.calendario;
  const otrosi = data.otrosi;
  const { meta_total, acumulado_total, forecast_total } = data.resumen_equipo;

  const meta = otrosi ? otrosi.meta_equipo_altas_positivas : meta_total;
  const acumulado = otrosi ? otrosi.altas_positivas : acumulado_total;
  const pct = otrosi ? otrosi.pct_avance : meta_total ? acumulado_total / meta_total : 0;
  // Con otrosí no hay forecast individual de altas positivas: se proyecta al
  // ritmo actual (lineal sobre los días laborados), y así se rotula.
  const proyeccion = otrosi
    ? cal.dias_laborados > 0
      ? (acumulado / cal.dias_laborados) * cal.dias_colectivo
      : acumulado
    : forecast_total;
  const pctProyeccion = meta ? proyeccion / meta : 0;
  const ideal = idealEquipo(data.asesores);
  const nivel = SEMAFORO[nivelSemaforo(pct, ideal)];

  const faltan = otrosi ? Math.max(otrosi.meta_equipo_altas_positivas - otrosi.altas_positivas, 0) : 0;
  const porDia = cal.dias_por_laborar > 0 ? Math.ceil(faltan / cal.dias_por_laborar) : faltan;

  return (
    <div className="glass rounded-2xl px-5 py-4 mb-4">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-white/70">
            Avance del equipo{otrosi ? " · altas positivas (otrosí)" : ""} · corte al {data.fecha_corte}
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-4xl font-extrabold text-white tabular-nums">{fmtNumero(acumulado)}</span>
            <span className="text-lg text-white/70 tabular-nums">/ {fmtNumero(meta)}</span>
          </div>
        </div>
        <div className="text-right" title={nivel.texto}>
          <div className="text-3xl font-extrabold tabular-nums" style={{ color: nivel.color }}>
            <span aria-hidden="true">{nivel.icono}</span> {fmtPct(pct)}
          </div>
          <div className="text-[11px] text-white/70">Ideal a la fecha: {fmtPct(ideal)}</div>
        </div>
      </div>

      <div className="relative mt-3 h-3 bg-white/10 rounded-full" role="img" aria-label={`Cumplimiento ${fmtPct(pct)}, ideal ${fmtPct(ideal)}`}>
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct * 100, 100)}%`, background: nivel.color }} />
        <div
          className="absolute -top-1 -bottom-1 w-0.5 bg-white"
          style={{ left: `${Math.min(ideal * 100, 100)}%` }}
          title={`Ideal a la fecha ${fmtPct(ideal)}`}
        />
      </div>

      {otrosi && (
        <p className="mt-2 text-xs text-white/80">
          {otrosi.condicion_equipo_cumplida
            ? `Condición del equipo cumplida: la comisión se habilita desde el ${fmtPct(otrosi.pct_minimo_comision)} de la meta individual.`
            : `Faltan ${fmtNumero(faltan)} altas positivas para habilitar la comisión del equipo` +
              (cal.dias_por_laborar > 0 ? ` (≈ ${fmtNumero(porDia)} por día en los ${cal.dias_por_laborar} días que quedan).` : ".")}
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
        <Dato
          label={otrosi ? "Al ritmo actual cerramos en" : "Forecast de cierre"}
          value={fmtNumero(proyeccion)}
          sub={`${fmtPct(pctProyeccion)} de la meta`}
        />
        <Dato label="Facturación SERVI" value={fmtMoney(data.kpis.total_facturacion)} />
        <Dato label="Ventas totales" value={fmtNumero(data.kpis.total_ventas)} sub={otrosi ? "todos los estados" : undefined} />
        <Dato label="Días laborados" value={`${cal.dias_laborados} / ${cal.dias_colectivo}`} sub={`${cal.dias_por_laborar} por laborar`} />
      </div>
    </div>
  );
}
