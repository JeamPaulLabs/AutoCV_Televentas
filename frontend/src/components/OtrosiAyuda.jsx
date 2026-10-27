import { useEffect, useState } from "react";
import { fmtNumero, fmtPct } from "../utils/formato";

const VISTO_KEY = "como-vamos-televentas:otrosi-visto";

function Paso({ n, titulo, children }) {
  return (
    <div className="flex gap-3">
      <span className="flex-none w-6 h-6 rounded-full bg-xuma-green-dark text-xuma-bg-dark text-xs font-extrabold flex items-center justify-center">
        {n}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-white mb-1.5">{titulo}</div>
        {children}
      </div>
    </div>
  );
}

function Barra({ etiqueta, pct, color, valor }) {
  return (
    <div>
      <div className="flex justify-between text-[11px] text-white/80 mb-0.5">
        <span>{etiqueta}</span>
        <span className="tabular-nums font-semibold">{valor}</span>
      </div>
      <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${Math.min(pct * 100, 100)}%`, background: color }} />
      </div>
    </div>
  );
}

/** Explicación sencilla del otrosí vigente, en un botón flotante (no ocupa lugar
 * en el tablero). El botón brilla hasta que se abre por primera vez.
 * `miResumen` (vista del asesor) personaliza el ejemplo con su propia meta. */
export default function OtrosiAyuda({ otrosi, miResumen }) {
  const clave = `${VISTO_KEY}:${otrosi?.documento ?? ""}`;
  const [abierto, setAbierto] = useState(false);
  const [visto, setVisto] = useState(() => {
    try {
      return localStorage.getItem(clave) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!abierto) return undefined;
    const alTeclear = (e) => e.key === "Escape" && setAbierto(false);
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [abierto]);

  if (!otrosi) return null;

  function alternar() {
    setAbierto((a) => !a);
    if (!visto) {
      setVisto(true);
      try {
        localStorage.setItem(clave, "1");
      } catch {
        /* sin localStorage: el brillo vuelve al recargar */
      }
    }
  }

  const pctMin = otrosi.pct_minimo_comision;
  const cumplida = otrosi.condicion_equipo_cumplida;
  const faltan = Math.max(otrosi.meta_equipo_altas_positivas - otrosi.altas_positivas, 0);
  const miMeta = miResumen && miResumen.categoria !== "SIN META" && miResumen.meta_mes > 0 ? miResumen : null;

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2">
      {abierto && (
        <div
          id="otrosi-panel"
          role="dialog"
          aria-label="Cómo funciona el otrosí"
          className="modal-solid rounded-2xl p-5 w-[min(400px,calc(100vw-2rem))] max-h-[calc(100vh-6rem)] overflow-auto space-y-4"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-white/70">Otrosí vigente</div>
              <div className="text-base font-extrabold text-white leading-tight">Así funciona, fácil</div>
            </div>
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="w-7 h-7 rounded-lg border border-white/20 text-white/70 hover:bg-white/10 transition-colors"
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>

          <Paso n="1" titulo="Todos sumamos para una meta de equipo">
            <Barra
              etiqueta="Altas positivas del equipo"
              pct={otrosi.pct_avance}
              color="#00cd93"
              valor={`${fmtNumero(otrosi.altas_positivas)} / ${fmtNumero(otrosi.meta_equipo_altas_positivas)}`}
            />
            <p className="mt-1.5 text-xs text-white/80">
              {cumplida
                ? "¡Meta de equipo cumplida! Ya se habilita el beneficio."
                : `Faltan ${fmtNumero(faltan)} altas. Cuentan las ventas en estado Auditada Web y Alta Transaccional.`}
            </p>
          </Paso>

          <Paso n="2" titulo="Si el equipo lo logra, tu meta baja">
            <div className="space-y-2">
              <Barra
                etiqueta="Sin otrosí"
                pct={1}
                color="#8b90a8"
                valor={miMeta ? fmtNumero(miMeta.meta_mes) : "100% de tu meta"}
              />
              <Barra
                etiqueta="Con otrosí"
                pct={pctMin}
                color="#00cd93"
                valor={miMeta ? fmtNumero(miMeta.meta_mes * pctMin) : `${fmtPct(pctMin)} de tu meta`}
              />
            </div>
            <p className="mt-1.5 text-xs text-white/80">
              {miMeta
                ? `Para cobrar comisión te bastaría llegar a ${fmtNumero(miMeta.meta_mes * pctMin)} (tienes ${fmtNumero(miMeta.acumulado)}).`
                : `Tu comisión se habilita desde el ${fmtPct(pctMin)} de tu meta, no desde el 100%.`}
            </p>
          </Paso>

          <Paso n="3" titulo="Si el equipo no llega">
            <p className="text-xs text-white/80">Se liquida con el esquema principal, con el 100% de la meta.</p>
          </Paso>

          <details className="text-xs text-white/75 border-t border-white/10 pt-3">
            <summary className="cursor-pointer font-semibold text-white/85">Ver el texto completo del otrosí</summary>
            <p className="mt-2 text-[11px] text-white/60">{otrosi.documento}</p>
            <ol className="mt-2 space-y-2 list-decimal pl-4">
              {otrosi.reglas.map((r) => (
                <li key={r.titulo}>
                  <span className="font-semibold text-white">{r.titulo}. </span>
                  {r.texto}
                </li>
              ))}
            </ol>
          </details>
        </div>
      )}

      <button
        type="button"
        onClick={alternar}
        aria-expanded={abierto}
        aria-controls="otrosi-panel"
        className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold bg-xuma-green-dark text-xuma-bg-dark shadow-lg ${
          visto ? "" : "otrosi-glow"
        }`}
      >
        <span className="w-5 h-5 rounded-full bg-xuma-bg-dark text-xuma-green-dark text-xs flex items-center justify-center" aria-hidden="true">
          ?
        </span>
        ¿Cómo funciona el otrosí?
      </button>
    </div>
  );
}
