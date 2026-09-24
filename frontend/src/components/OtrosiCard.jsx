import { fmtNumero, fmtPct } from "../utils/formato";

/** Reglas del otrosí vigente del periodo + avance del equipo hacia la
 * condición general (2.000 altas). Se muestra a asesores y supervisor para
 * que tengan claro lo que firmaron. */
export default function OtrosiCard({ otrosi }) {
  if (!otrosi) return null;
  const avance = Math.min(otrosi.pct_avance * 100, 100);
  const cumplida = otrosi.condicion_equipo_cumplida;

  return (
    <details className="glass rounded-2xl px-5 py-4 mb-3 group" open>
      <summary className="cursor-pointer list-none flex items-center justify-between gap-2">
        <div>
          <div className="text-xs uppercase tracking-wide text-white/60 font-semibold">Otrosí vigente</div>
          <div className="text-sm font-bold text-white">{otrosi.documento}</div>
        </div>
        <span className="text-[11px] text-white/50 group-open:hidden">Ver reglas</span>
        <span className="text-[11px] text-white/50 hidden group-open:inline">Ocultar</span>
      </summary>

      <div className="mt-3">
        <div className="flex items-center justify-between text-xs text-white/70 mb-1">
          <span>
            Meta del equipo: {fmtNumero(otrosi.altas_positivas)} de {fmtNumero(otrosi.meta_equipo_altas_positivas)} altas positivas
          </span>
          <span className="font-bold tabular-nums text-white">{fmtPct(otrosi.pct_avance)}</span>
        </div>
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${avance}%`, background: cumplida ? "#0ca30c" : "#fab219" }}
          />
        </div>
        <p className="mt-2 text-[11px] text-white/60">
          {cumplida
            ? `Condición del equipo cumplida: la comisión se habilita desde el ${fmtPct(otrosi.pct_minimo_comision)} de tu meta individual.`
            : `Si el equipo no llega a ${fmtNumero(otrosi.meta_equipo_altas_positivas)} altas al cierre, se liquida con el esquema principal.`}
        </p>

        <ol className="mt-3 space-y-2 text-xs text-white/80 list-decimal pl-4">
          {otrosi.reglas.map((r) => (
            <li key={r.titulo}>
              <span className="font-semibold text-white">{r.titulo}. </span>
              {r.texto}
            </li>
          ))}
        </ol>
      </div>
    </details>
  );
}
