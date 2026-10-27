import { fmtNumero, fmtPct, nombreCorto } from "../../utils/formato";

const MEDALLA = ["#C9A227", "#A7A9AC", "#B0703A"];

export default function PodioCard({ podio }) {
  return (
      <div className="glass rounded-2xl px-5 py-4">
        <div className="text-[11px] uppercase tracking-wide text-white/70 mb-2">Podio del mes</div>
        {podio.length === 0 && <div className="text-sm text-white/60">Sin datos</div>}
        <ol className="space-y-2.5">
          {podio.slice(0, 3).map((f, i) => (
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
  );
}
