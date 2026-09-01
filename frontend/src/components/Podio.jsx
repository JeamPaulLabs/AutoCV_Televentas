import { fmtNumero, fmtPct, nombreCorto } from "../utils/formato";

const MEDALLA = {
  1: "bg-[#C9A227]",
  2: "bg-[#A7A9AC]",
  3: "bg-[#B0703A]",
};
const BORDE = {
  1: "border-t-[#C9A227]",
  2: "border-t-[#A7A9AC]",
  3: "border-t-[#B0703A]",
};

export default function Podio({ items }) {
  if (!items || items.length === 0) {
    return <div className="glass rounded-xl px-3 py-2 text-sm text-white/50">Sin datos</div>;
  }
  return (
    <>
      {items.slice(0, 3).map((fila, idx) => {
        const puesto = idx + 1;
        return (
          <div
            key={fila.asesor}
            className={`glass rounded-xl px-3 py-2 flex items-start gap-2 border-t-2 ${BORDE[puesto]}`}
          >
            <span
              className={`flex-none w-6 h-5.5 rounded-md text-white text-[11px] font-extrabold flex items-center justify-center ${MEDALLA[puesto]}`}
            >
              {puesto}
            </span>
            <div className="text-left">
              <div className="text-xs font-bold text-white leading-tight">
                {nombreCorto(fila.asesor)}
              </div>
              <div className="text-base font-extrabold text-white leading-tight">
                {fmtNumero(fila.acumulado)}
              </div>
              <div className="text-[10px] text-white/50">
                {fmtPct(fila.pct_cumpl_acumulado)} de la meta
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}
