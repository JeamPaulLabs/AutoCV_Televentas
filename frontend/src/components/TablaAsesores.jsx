import { fmtMoney, fmtNumero, fmtPct } from "../utils/formato";

// Paleta de estado validada (skill dataviz) -- nunca se inventa color para
// esto, es la misma que usa el generador HTML estático.
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

export default function TablaAsesores({ filas }) {
  const ordenadas = [...filas].sort((a, b) => b.pct_cumpl_acumulado - a.pct_cumpl_acumulado);

  return (
    <div className="glass rounded-xl overflow-auto text-xs max-h-[420px]">
      <table className="w-full border-collapse min-w-[900px]">
        <thead>
          <tr className="tabla-header text-white text-left sticky top-0 z-10">
            <th className="px-2.5 py-1.5 font-semibold">Asesor</th>
            <th className="px-2.5 py-1.5 font-semibold">Categoría</th>
            <th className="px-2.5 py-1.5 font-semibold text-right">Meta</th>
            <th className="px-2.5 py-1.5 font-semibold text-right">Acumulado</th>
            <th className="px-2.5 py-1.5 font-semibold">% Cumpl.</th>
            <th className="px-2.5 py-1.5 font-semibold text-right">% Cumpl. ideal</th>
            <th className="px-2.5 py-1.5 font-semibold text-right">Venta/día</th>
            <th className="px-2.5 py-1.5 font-semibold text-right">Forecast</th>
            <th className="px-2.5 py-1.5 font-semibold text-right">% Forecast</th>
            <th className="px-2.5 py-1.5 font-semibold">Escala</th>
            <th className="px-2.5 py-1.5 font-semibold text-right">Base a pagar</th>
          </tr>
        </thead>
        <tbody>
          {ordenadas.map((fila) => {
            const color = semaforo(fila.pct_cumpl_acumulado, fila.pct_cump_ideal);
            const ancho = Math.min(fila.pct_cumpl_acumulado * 100, 100);
            return (
              <tr key={fila.asesor} className="border-t border-white/10 text-white/85">
                <td className="px-2.5 py-1">{fila.asesor}</td>
                <td className="px-2.5 py-1">{fila.categoria}</td>
                <td className="px-2.5 py-1 text-right tabular-nums">{fmtNumero(fila.meta_mes)}</td>
                <td className="px-2.5 py-1 text-right tabular-nums">{fmtNumero(fila.acumulado)}</td>
                <td className="px-2.5 py-1">
                  <div className="flex items-center gap-1.5 min-w-[110px]">
                    <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${ancho}%`, background: color }}
                      />
                    </div>
                    <span className="text-[11px] tabular-nums text-white/60 min-w-[38px]">
                      {fmtPct(fila.pct_cumpl_acumulado)}
                    </span>
                  </div>
                </td>
                <td className="px-2.5 py-1 text-right tabular-nums">{fmtPct(fila.pct_cump_ideal)}</td>
                <td className="px-2.5 py-1 text-right tabular-nums">
                  {fila.venta_necesaria_dia.toFixed(1)}
                </td>
                <td className="px-2.5 py-1 text-right tabular-nums">{fila.forecast.toFixed(0)}</td>
                <td className="px-2.5 py-1 text-right tabular-nums">{fmtPct(fila.pct_forecast)}</td>
                <td className="px-2.5 py-1">
                  {fila.escala_alcanzada ? `Escala ${fila.escala_alcanzada}` : "—"}
                </td>
                <td className="px-2.5 py-1 text-right tabular-nums">
                  {fmtMoney(fila.base_pago_proyectada)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
