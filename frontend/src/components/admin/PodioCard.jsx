import { fmtNumero, fmtPct, nombreCorto } from "../../utils/formato";

const MEDALLA = ["#C9A227", "#A7A9AC", "#B0703A"];

/** Podio compacto: los tres puestos en una fila para ocupar poca altura. */
export default function PodioCard({ podio }) {
  return (
    <div className="glass rounded-2xl px-4 py-3">
      <div className="text-[11px] uppercase tracking-wide text-white/70 mb-2">Podio del mes</div>
      {podio.length === 0 && <div className="text-sm text-white/60">Sin datos</div>}
      <ol className="grid grid-cols-3 gap-3">
        {podio.slice(0, 3).map((f, i) => (
          <li key={f.asesor} className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span
                className="flex-none w-5 h-5 rounded-md text-[11px] font-extrabold flex items-center justify-center text-white"
                style={{ background: MEDALLA[i] }}
              >
                {i + 1}
              </span>
              <span className="text-xs font-bold text-white truncate" title={f.asesor}>{nombreCorto(f.asesor)}</span>
            </div>
            <div className="text-xl font-extrabold text-white tabular-nums leading-tight mt-1">{fmtNumero(f.acumulado)}</div>
            <div className="h-1 bg-white/10 rounded-full mt-1 overflow-hidden">
              <div className="h-full rounded-full bg-xuma-green-dark" style={{ width: `${Math.min(f.pct_cumpl_acumulado * 100, 100)}%` }} />
            </div>
            <div className="text-[11px] text-white/65 mt-0.5">{fmtPct(f.pct_cumpl_acumulado)} de la meta</div>
          </li>
        ))}
      </ol>
    </div>
  );
}
