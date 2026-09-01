import { useState } from "react";
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
const BADGE_ESTADO = {
  "AUDITADA WEB": "bg-xuma-green-dark/20 text-xuma-green-light",
  "ALTA TRANSACCIONAL": "bg-xuma-green-dark/20 text-xuma-green-light",
  "DIGITADA WEB": "bg-amber-500/20 text-amber-300",
  "CANCELADA": "bg-red-500/20 text-red-300",
};

function fmtFecha(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
}

/** Agrupa las ventas del asesor por día -- una fila por fecha con la
 * cantidad de cuentas gestionadas, expandible para ver cuáles son. */
function agruparPorDia(detalle) {
  const grupos = new Map();
  for (const v of detalle) {
    const key = v.fecha_venta || "sin-fecha";
    if (!grupos.has(key)) grupos.set(key, []);
    grupos.get(key).push(v);
  }
  return [...grupos.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
}

export default function MiResumenAsesor({ resumen, detalleEstado, detalleDiaDia }) {
  const [diaAbierto, setDiaAbierto] = useState(null);

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

      {detalleDiaDia && detalleDiaDia.length > 0 && (
        <div className="glass rounded-2xl px-5 py-4">
          <div className="text-xs uppercase tracking-wide text-white/60 font-semibold mb-3">
            Día a día del mes
          </div>
          <div className="space-y-1.5 max-h-[480px] overflow-auto">
            {agruparPorDia(detalleDiaDia).map(([fecha, ventas]) => {
              const abierto = diaAbierto === fecha;
              return (
                <div key={fecha} className="rounded-lg overflow-hidden border border-white/10">
                  <button
                    type="button"
                    onClick={() => setDiaAbierto(abierto ? null : fecha)}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <span className="font-semibold text-white">{fmtFecha(fecha)}</span>
                    <span className="flex items-center gap-2 text-white/70">
                      {ventas.length} cuenta{ventas.length === 1 ? "" : "s"} gestionada{ventas.length === 1 ? "" : "s"}
                      <span className={`transition-transform ${abierto ? "rotate-180" : ""}`}>⌄</span>
                    </span>
                  </button>
                  {abierto && (
                    <table className="w-full border-collapse text-xs">
                      <thead>
                        <tr className="tabla-header text-white text-left">
                          <th className="px-2.5 py-1.5 font-semibold">Contrato</th>
                          <th className="px-2.5 py-1.5 font-semibold">Producto</th>
                          <th className="px-2.5 py-1.5 font-semibold">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ventas.map((v, i) => (
                          <tr key={`${v.contrato}-${i}`} className="border-t border-white/10 text-white/85">
                            <td className="px-2.5 py-1 tabular-nums">{v.contrato || "—"}</td>
                            <td className="px-2.5 py-1">{v.producto || "—"}</td>
                            <td className="px-2.5 py-1">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${BADGE_ESTADO[v.estado] || "bg-white/10 text-white/70"}`}>
                                {v.estado || "—"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
