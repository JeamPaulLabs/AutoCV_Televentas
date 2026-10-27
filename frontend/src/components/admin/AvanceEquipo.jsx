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
  // Hay otrosís (octubre) sin condición general de equipo: ahí el avance es el de
  // siempre y el otrosí solo baja la meta individual.
  const condEquipo = Boolean(otrosi) && otrosi.condicion_equipo !== false;

  // Sin condición de equipo, el otrosí solo baja la meta: se mide contra la meta ajustada.
  const metaAjustadaTotal = data.resumen_equipo.meta_ajustada_total ?? meta_total;
  const meta = condEquipo ? otrosi.meta_equipo_altas_positivas : metaAjustadaTotal;
  const acumulado = condEquipo ? otrosi.altas_positivas : acumulado_total;
  const pct = condEquipo ? otrosi.pct_avance : meta ? acumulado_total / meta : 0;
  // Con otrosí no hay forecast individual de altas positivas: se proyecta al
  // ritmo actual (lineal sobre los días laborados), y así se rotula.
  const proyeccion = condEquipo
    ? cal.dias_laborados > 0
      ? (acumulado / cal.dias_laborados) * cal.dias_colectivo
      : acumulado
    : forecast_total;
  const pctProyeccion = meta ? proyeccion / meta : 0;
  const ideal = idealEquipo(data.asesores);
  const nivel = SEMAFORO[nivelSemaforo(pct, ideal)];

  // Ajuste de meta: con la condición del equipo cumplida, la comisión se habilita
  // desde pct_minimo_comision de la meta individual (en vez del 100%).
  const metaAjustada = otrosi ? meta_total * otrosi.pct_minimo_comision : meta_total;
  const pctSobreAjustada = metaAjustada ? acumulado_total / metaAjustada : 0;

  const faltan = condEquipo ? Math.max(otrosi.meta_equipo_altas_positivas - otrosi.altas_positivas, 0) : 0;
  const porDia = cal.dias_por_laborar > 0 ? Math.ceil(faltan / cal.dias_por_laborar) : faltan;

  return (
    <div className="glass rounded-2xl px-5 py-4 mb-4">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-white/70">
            Avance del equipo{condEquipo ? " · altas positivas (otrosí)" : ""} · corte al {data.fecha_corte}
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-4xl font-extrabold text-white tabular-nums">{fmtNumero(acumulado)}</span>
            <span className="text-lg text-white/70 tabular-nums">/ {fmtNumero(meta)}</span>
          </div>
        </div>
        <div className="text-right" title={nivel.texto}>
          <div className="text-3xl font-extrabold tabular-nums" style={{ color: nivel.colorTexto }}>
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
          {!condEquipo
            ? `Otrosí vigente: la comisión se habilita desde el ${fmtPct(otrosi.pct_minimo_comision)} de la meta individual, sin exigir una meta general del equipo.`
            : otrosi.condicion_equipo_cumplida
            ? `Condición del equipo cumplida: la comisión se habilita desde el ${fmtPct(otrosi.pct_minimo_comision)} de la meta individual.`
            : `Faltan ${fmtNumero(faltan)} altas positivas para habilitar la comisión del equipo` +
              (cal.dias_por_laborar > 0 ? ` (≈ ${fmtNumero(porDia)} por día en los ${cal.dias_por_laborar} días que quedan).` : ".")}
        </p>
      )}

      {otrosi && (
        <div className="mt-3 rounded-xl border border-white/15 bg-white/5 px-4 py-3 grid md:grid-cols-3 gap-4">
          <Dato label="Meta del equipo (100%)" value={fmtNumero(meta_total)} sub="suma de metas individuales" />
          <Dato
            label={`Meta ajustada por otrosí (${fmtPct(otrosi.pct_minimo_comision)})`}
            value={fmtNumero(metaAjustada)}
            sub={!condEquipo || otrosi.condicion_equipo_cumplida ? "ajuste vigente" : `se habilita al llegar a ${fmtNumero(otrosi.meta_equipo_altas_positivas)} altas positivas`}
          />
          <Dato
            label="Llevamos sobre la meta ajustada"
            value={fmtPct(pctSobreAjustada)}
            sub={`${fmtNumero(acumulado_total)} de ${fmtNumero(metaAjustada)} (todos los estados)`}
          />
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
        <Dato
          label={condEquipo ? "Al ritmo actual cerramos en" : "Forecast de cierre"}
          value={fmtNumero(proyeccion)}
          sub={`${fmtPct(pctProyeccion)} de la meta`}
        />
        <Dato label="Facturación SERVI" value={fmtMoney(data.kpis.total_facturacion)} />
        <Dato label="Ventas totales" value={fmtNumero(data.kpis.total_ventas)} sub={condEquipo ? "todos los estados" : undefined} />
        <Dato label="Días laborados" value={`${cal.dias_laborados} / ${cal.dias_colectivo}`} sub={`${cal.dias_por_laborar} por laborar`} />
      </div>
    </div>
  );
}
