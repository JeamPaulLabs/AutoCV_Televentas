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
  "AUDITADA WEB": "bg-emerald-700 text-white",
  "ALTA TRANSACCIONAL": "bg-emerald-700 text-white",
  "DIGITADA WEB": "bg-amber-600 text-white",
  "CANCELADA": "bg-red-700 text-white",
};
const BADGE_ESTADO_DEFAULT = "bg-white/20 text-white";

function fmtFecha(iso) {
  if (!iso) return "—";
  // "2026-09-01" es una fecha sin hora -- new Date(iso) la lee como
  // medianoche UTC, y en Colombia (UTC-5) eso cae un día antes al mostrarla
  // (1 sept se veía como 31 ago). Se parsean los componentes a mano para
  // construir una fecha LOCAL, sin pasar por UTC.
  const [soloFecha] = iso.split("T");
  const [anio, mes, dia] = soloFecha.split("-").map(Number);
  if (!anio || !mes || !dia) return iso;
  const d = new Date(anio, mes - 1, dia);
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

// Orden fijo de lectura del ciclo de vida de una venta -- primero recién
// digitada, luego lo que ya maduró, cancelada al final. Cualquier estado
// que no esté aquí (no debería pasar) cae después, en el orden que salga.
const ORDEN_ESTADO = ["DIGITADA WEB", "AUDITADA WEB", "ALTA TRANSACCIONAL", "CANCELADA"];

/** Cuántas cuentas de ese día caen en cada estado -- para los globitos
 * clicables (ej. "2 ALTA TRANSACCIONAL", "1 CANCELADA"), siempre en el
 * mismo orden para que se puedan comparar los días de un vistazo. */
function contarPorEstado(ventas) {
  const conteo = new Map();
  for (const v of ventas) {
    const estado = v.estado || "SIN ESTADO";
    conteo.set(estado, (conteo.get(estado) || 0) + 1);
  }
  return [...conteo.entries()].sort((a, b) => {
    const ia = ORDEN_ESTADO.indexOf(a[0]);
    const ib = ORDEN_ESTADO.indexOf(b[0]);
    return (ia === -1 ? ORDEN_ESTADO.length : ia) - (ib === -1 ? ORDEN_ESTADO.length : ib);
  });
}

export default function MiResumenAsesor({ resumen, detalleEstado, detalleDiaDia }) {
  const detalle = detalleDiaDia || [];
  const [popup, setPopup] = useState(null);
  const [filtroEstado, setFiltroEstado] = useState(null);

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
    <div className="grid lg:grid-cols-[minmax(0,1fr)_1.3fr] gap-4 items-start">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2.5">
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
                const deEsteEstado = detalle.filter((v) => (v.estado || "SIN ESTADO") === estado);
                const activo = filtroEstado === estado;
                return (
                  <div
                    key={estado}
                    role="button"
                    tabIndex={0}
                    onClick={() => setFiltroEstado(activo ? null : estado)}
                    onKeyDown={(e) => e.key === "Enter" && setFiltroEstado(activo ? null : estado)}
                    className={`flex items-center gap-3 rounded-lg px-2 py-1 -mx-2 cursor-pointer transition-colors ${activo ? "bg-white/10" : "hover:bg-white/5"}`}
                    title="Clic para filtrar el día a día por este estado"
                  >
                    <div className={`w-40 shrink-0 text-xs truncate ${activo ? "text-white font-semibold" : "text-white/75"}`} title={estado}>
                      {estado}
                    </div>
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-xuma-green-dark" style={{ width: `${pct}%` }} />
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (deEsteEstado.length > 0) {
                          setPopup({ titulo: `${estado} · total del mes`, estado, grupos: agruparPorDia(deEsteEstado) });
                        }
                      }}
                      disabled={deEsteEstado.length === 0}
                      className="w-8 shrink-0 text-right text-xs font-bold text-white tabular-nums hover:text-xuma-green-light transition-colors disabled:hover:text-white disabled:cursor-default"
                    >
                      {cantidad}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {detalleDiaDia && detalleDiaDia.length > 0 && (
        <div className="glass rounded-2xl px-5 py-4 lg:sticky lg:top-[76px]">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs uppercase tracking-wide text-white/60 font-semibold">
              Día a día del mes
            </div>
            {filtroEstado && (
              <button
                type="button"
                onClick={() => setFiltroEstado(null)}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ${BADGE_ESTADO[filtroEstado] || BADGE_ESTADO_DEFAULT}`}
              >
                {filtroEstado} ✕
              </button>
            )}
          </div>
          <div className="space-y-1.5 max-h-[calc(100vh-220px)] overflow-auto pr-1">
            {agruparPorDia(detalle)
              .map(([fecha, ventas]) => [
                fecha,
                filtroEstado ? ventas.filter((v) => (v.estado || "SIN ESTADO") === filtroEstado) : ventas,
              ])
              .filter(([, ventas]) => ventas.length > 0)
              .map(([fecha, ventas]) => (
                <div key={fecha} className="rounded-lg border border-white/10 px-3 py-2 flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-semibold text-white text-xs shrink-0">
                    {fmtFecha(fecha)} <span className="text-white/40 font-normal">· {ventas.length}</span>
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    {contarPorEstado(ventas).map(([estado, cantidad]) => (
                      <button
                        key={estado}
                        type="button"
                        onClick={() =>
                          setPopup({
                            titulo: fmtFecha(fecha),
                            estado,
                            grupos: [[fecha, ventas.filter((v) => (v.estado || "SIN ESTADO") === estado)]],
                          })
                        }
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold cursor-pointer hover:brightness-125 transition text-center min-w-[92px] ${BADGE_ESTADO[estado] || BADGE_ESTADO_DEFAULT}`}
                      >
                        {cantidad} {estado}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {popup && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4"
          onClick={() => setPopup(null)}
        >
          <div
            className="modal-solid rounded-2xl px-5 py-4 max-w-md w-full max-h-[70vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-xs text-white/60">
                  {popup.titulo} · {popup.grupos.reduce((acc, [, v]) => acc + v.length, 0)} en total
                </div>
                <div className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${BADGE_ESTADO[popup.estado] || BADGE_ESTADO_DEFAULT}`}>
                  {popup.estado}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPopup(null)}
                className="w-7 h-7 rounded-lg border border-white/20 text-white/70 hover:bg-white/10 transition-colors"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4">
              {popup.grupos.map(([fecha, ventas]) => (
                <div key={fecha}>
                  {popup.grupos.length > 1 && (
                    <div className="text-[11px] font-semibold text-white/50 uppercase tracking-wide mb-1.5">
                      {fmtFecha(fecha)} · {ventas.length}
                    </div>
                  )}
                  <div className="space-y-2">
                    {ventas.map((v, i) => (
                      <div key={`${v.contrato}-${i}`} className="flex items-center justify-between text-xs border-t border-white/10 pt-2 first:border-t-0 first:pt-0">
                        <span className="text-white font-semibold tabular-nums">{v.contrato || "—"}</span>
                        <span className="text-white/60">{v.producto || "—"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
