import { fmtMoney, fmtNumero, fmtPct, nombreCorto } from "../../utils/formato";
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

const MEDALLA = ["#C9A227", "#A7A9AC", "#B0703A"];

export default function HeroEquipo({ data, conFacturacion = true }) {
  const { meta_total, acumulado_total, forecast_total } = data.resumen_equipo;
  const pct = meta_total ? acumulado_total / meta_total : 0;
  const pctForecast = meta_total ? forecast_total / meta_total : 0;
  const ideal = idealEquipo(data.asesores);
  const nivel = SEMAFORO[nivelSemaforo(pct, ideal)];
  const cal = data.calendario;

  return (
    <div className="grid lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)] gap-3 mb-4">
      <div className="glass rounded-2xl px-5 py-4">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-white/70">Avance del equipo · corte al {data.fecha_corte}</div>
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-extrabold text-white tabular-nums">{fmtNumero(acumulado_total)}</span>
              <span className="text-lg text-white/70 tabular-nums">/ {fmtNumero(meta_total)}</span>
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
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${Math.min(pct * 100, 100)}%`, background: nivel.color }}
          />
          <div
            className="absolute -top-1 -bottom-1 w-0.5 bg-white"
            style={{ left: `${Math.min(ideal * 100, 100)}%` }}
            title={`Ideal a la fecha ${fmtPct(ideal)}`}
          />
        </div>

        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          <Dato label="Forecast de cierre" value={fmtNumero(forecast_total)} sub={`${fmtPct(pctForecast)} de la meta`} />
          {conFacturacion && <Dato label="Facturación SERVI" value={fmtMoney(data.kpis.total_facturacion)} />}
          <Dato label="Ventas totales" value={fmtNumero(data.kpis.total_ventas)} />
          <Dato label="Días laborados" value={`${cal.dias_laborados} / ${cal.dias_colectivo}`} sub={`${cal.dias_por_laborar} por laborar`} />
        </div>
      </div>

      <div className="glass rounded-2xl px-5 py-4">
        <div className="text-[11px] uppercase tracking-wide text-white/70 mb-2">Podio del mes</div>
        {data.podio.length === 0 && <div className="text-sm text-white/60">Sin datos</div>}
        <ol className="space-y-2.5">
          {data.podio.slice(0, 3).map((f, i) => (
            <li key={f.asesor} className="flex items-center gap-3">
              <span
                className="flex-none w-6 h-6 rounded-md text-[12px] font-extrabold flex items-center justify-center text-white"
                style={{ background: MEDALLA[i] }}
              >
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-bold text-white truncate" title={f.asesor}>{nombreCorto(f.asesor)}</span>
                  <span className="text-sm font-extrabold text-white tabular-nums">{fmtNumero(f.acumulado)}</span>
                </div>
                <div className="h-1 bg-white/10 rounded-full mt-1 overflow-hidden">
                  <div className="h-full rounded-full bg-xuma-green-dark" style={{ width: `${Math.min(f.pct_cumpl_acumulado * 100, 100)}%` }} />
                </div>
                <div className="text-[11px] text-white/65">{fmtPct(f.pct_cumpl_acumulado)} de la meta</div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
