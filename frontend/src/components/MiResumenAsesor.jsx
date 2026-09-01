import { fmtNumero, fmtPct } from "../utils/formato";
import StatTile from "./StatTile";

const GOOD = "#0ca30c";
const WARNING = "#fab219";
const CRITICAL = "#d03b3b";

function semaforo(pctCumpl, pctCumplIdeal) {
  if (pctCumplIdeal <= 0) return GOOD;
  const razon = pctCumpl / pctCumplIdeal;
  if (razon >= 1) return GOOD;
  if (razon >= 0.8) return WARNING;
  return CRITICAL;
}

/** Vista de un solo asesor: solo su operación de ventas (conteos), sin
 * facturación ni valores en pesos -- ver backend/app/routers/como_vamos.py
 * (rama "vista personal" del endpoint /dashboard). */
export default function MiResumenAsesor({ resumen, detalleEstado }) {
  if (!resumen) {
    return (
      <div className="glass rounded-2xl px-5 py-6 text-sm text-white/60">
        Todavía no tienes ventas registradas este mes.
      </div>
    );
  }

  const sinMeta = resumen.categoria === "SIN META";
  const color = sinMeta ? WARNING : semaforo(resumen.pct_cumpl_acumulado, resumen.pct_cump_ideal);
  const avance = Math.min(resumen.pct_cumpl_acumulado * 100, 100);

  const estados = detalleEstado
    ? Object.entries(detalleEstado).filter(([k]) => k !== "asesor" && k !== "Total general")
    : [];
  const total = detalleEstado?.["Total general"];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <StatTile label="Categoría" value={resumen.categoria} />
        <StatTile label="Meta del mes" value={fmtNumero(resumen.meta_mes)} />
        <StatTile label="Acumulado" value={fmtNumero(resumen.acumulado)} destacado />
        <StatTile label="Forecast de cierre" value={fmtNumero(resumen.forecast)} sub={fmtPct(resumen.pct_forecast) + " de la meta"} />
      </div>

      <div className="glass rounded-2xl px-5 py-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs uppercase tracking-wide text-white/60 font-semibold">
            Cumplimiento acumulado
          </span>
          <span className="text-sm font-bold text-white tabular-nums">
            {fmtPct(resumen.pct_cumpl_acumulado)}
          </span>
        </div>
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${avance}%`, background: color }} />
        </div>
        <div className="mt-2 text-[11px] text-white/50">
          {sinMeta
            ? "Todavía no tienes una meta asignada este mes."
            : `Ideal a la fecha: ${fmtPct(resumen.pct_cump_ideal)} · faltan ${fmtNumero(Math.max(resumen.faltan_para_meta, 0))} para la meta`}
        </div>
      </div>

      {estados.length > 0 && (
        <div className="glass rounded-2xl px-5 py-4">
          <div className="text-xs uppercase tracking-wide text-white/60 font-semibold mb-3">
            Pólizas por estado
          </div>
          <div className="space-y-2">
            {estados.map(([estado, cantidad]) => {
              const pct = total ? (cantidad / total) * 100 : 0;
              return (
                <div key={estado} className="flex items-center gap-3">
                  <div className="w-40 shrink-0 text-xs text-white/75 truncate" title={estado}>{estado}</div>
                  <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-xuma-green-dark" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="w-8 shrink-0 text-right text-xs font-bold text-white tabular-nums">{cantidad}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
