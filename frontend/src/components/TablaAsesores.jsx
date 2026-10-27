import { fmtMoney, fmtNumero, fmtPct } from "../utils/formato";
import { SEMAFORO, nivelSemaforo } from "../utils/semaforo";


export default function TablaAsesores({ filas, otrosi }) {
  const ordenadas = [...filas].sort((a, b) => b.pct_cumpl_acumulado - a.pct_cumpl_acumulado);

  return (
    <div className="glass rounded-xl overflow-auto text-xs max-h-[calc(100vh-300px)]">
      <table className="w-full border-collapse min-w-[980px]">
        <thead>
          <tr className="tabla-header text-white text-left sticky top-0 z-10">
            <th className="px-2.5 py-1.5 font-semibold">Asesor</th>
            <th className="px-2.5 py-1.5 font-semibold">Categoría</th>
            <th className="px-2.5 py-1.5 font-semibold text-right">Meta</th>
            {otrosi && (
              <th
                className="px-2.5 py-1.5 font-semibold text-right"
                title={`Meta para habilitar comisión con el otrosí (${fmtPct(otrosi.pct_minimo_comision)} de la meta)`}
              >
                Meta ajustada
              </th>
            )}
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
            const nivel = SEMAFORO[nivelSemaforo(fila.pct_cumpl_acumulado, fila.pct_cump_ideal)];
            const ancho = Math.min(fila.pct_cumpl_acumulado * 100, 100);
            return (
              <tr key={fila.asesor} className="border-t border-white/10 text-white/85">
                <td className="px-2.5 py-1">
                  {fila.asesor}
                  {fila.observaciones && (
                    <div className="text-[10px] leading-tight text-amber-300/80 mt-0.5 max-w-[240px]">
                      ⓘ {fila.observaciones}
                    </div>
                  )}
                </td>
                <td className="px-2.5 py-1">{fila.categoria}</td>
                <td className="px-2.5 py-1 text-right tabular-nums">{fmtNumero(fila.meta_mes)}</td>
                {otrosi && (
                  <td className="px-2.5 py-1 text-right tabular-nums">
                    {fmtNumero(fila.meta_mes * otrosi.pct_minimo_comision)}
                    {fila.meta_mes > 0 && fila.acumulado >= fila.meta_mes * otrosi.pct_minimo_comision && (
                      <span className="ml-1 text-xuma-green-dark" title="Ya alcanzó la meta ajustada" aria-label="alcanzada">✓</span>
                    )}
                  </td>
                )}
                <td className="px-2.5 py-1 text-right tabular-nums">{fmtNumero(fila.acumulado)}</td>
                <td className="px-2.5 py-1">
                  <div className="flex items-center gap-1.5 min-w-[110px]">
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${ancho}%`, background: nivel.color }}
                      />
                    </div>
                    <span
                      className="text-xs tabular-nums text-white/85 min-w-[56px]"
                      title={nivel.texto}
                    >
                      <span aria-hidden="true" style={{ color: nivel.colorTexto }}>{nivel.icono}</span>{" "}
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
