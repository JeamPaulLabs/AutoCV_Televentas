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
 * (rama "vista personal" del endpoint /dashboard).
 *
 * Las tres productos (Cuota Protegida, Billetera Protegida y Rueda Seguro)
 * viven juntos en detalleDiaDia y se muestran en un solo bloque unificado; cada
 * fila se identifica con su producto (CP / BP / RS). Billetera y Rueda Seguro
 * llevan su tarjeta destacada cuando el asesor las tiene. */
const BADGE_ESTADO = {
  "AUDITADA WEB": "bg-emerald-900 text-emerald-200",
  "ALTA TRANSACCIONAL": "bg-emerald-900 text-emerald-200",
  "DIGITADA WEB": "bg-amber-900 text-amber-200",
  "CANCELADA": "bg-red-900 text-red-200",
};
const ESTADOS_ALTA = ["AUDITADA WEB", "ALTA TRANSACCIONAL"];
const BADGE_ESTADO_DEFAULT = "bg-white/15 text-white/80";

const BADGE_PRODUCTO = {
  CP: "bg-emerald-900/50 text-emerald-200 border border-emerald-700/40",
  CV: "bg-teal-900/50 text-teal-200 border border-teal-700/40",
  BP: "bg-sky-900/50 text-sky-200 border border-sky-700/40",
  RS: "bg-violet-900/50 text-violet-200 border border-violet-700/40",
};

const NOMBRE_PRODUCTO = {
  CP: "Cuota Protegida",
  CV: "Combo Vida",
  BP: "Billetera Protegida",
  RS: "Rueda Seguro",
};

function etiquetaProducto(producto) {
  const p = (producto || "").toString().toUpperCase();
  if (p.includes("BILLETERA")) return { corto: "BP", nombre: "Billetera Protegida" };
  if (p.includes("RUEDA")) return { corto: "RS", nombre: "Rueda Seguro" };
  if (p.includes("COMBO")) return { corto: "CV", nombre: "Combo Vida" };
  if (p.includes("CUOTA")) return { corto: "CP", nombre: "Cuota Protegida" };
  return { corto: "CP", nombre: "Cuota Protegida" };
}

function nombreProducto(corto) {
  return NOMBRE_PRODUCTO[corto] || corto;
}

function normContratoJs(v) {
  let s = v == null ? "" : String(v).trim();
  if (s.endsWith(".0")) s = s.slice(0, -2);
  return s.replace(/\s+/g, "");
}

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

/** Cuántas cuentas del conjunto caen en cada producto (CP / RS / BP). */
function contarPorProducto(ventas) {
  const conteo = new Map();
  for (const v of ventas) {
    const { corto } = etiquetaProducto(v.producto);
    conteo.set(corto, (conteo.get(corto) || 0) + 1);
  }
  // Orden estable: CP, CV, RS, BP.
  const orden = ["CP", "CV", "RS", "BP"];
  return [...conteo.entries()].sort((a, b) => orden.indexOf(a[0]) - orden.indexOf(b[0]));
}

/** Sección unificada: "Pólizas por estado" (clicables para filtrar) a la
 * izquierda y "Día a día" con los contratos a la derecha. Un solo bloque para
 * todos los productos; cada fila se identifica con CP / RS / BP. */
function SeccionVentas({ ventas, canceladas }) {
  const canceladasArr = canceladas || [];
  const [filtroEstado, setFiltroEstado] = useState(null);
  const [filtroProducto, setFiltroProducto] = useState(null);
  const [popup, setPopup] = useState(null);
  const [popupCanceladas, setPopupCanceladas] = useState(null);

  const canceladasDelDia = (items) =>
    canceladasArr.filter((c) => items.some((v) => normContratoJs(v.contrato) === normContratoJs(c.numero_contrato)));

  const estados = contarPorEstado(ventas);
  const productos = contarPorProducto(ventas);
  const total = ventas.length;
  const ventasFiltradas = ventas.filter((v) => {
    if (filtroEstado && (v.estado || "SIN ESTADO") !== filtroEstado) return false;
    if (filtroProducto) {
      const { corto } = etiquetaProducto(v.producto);
      if (corto !== filtroProducto) return false;
    }
    return true;
  });

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_1.3fr] gap-4 items-start">
      <div className="glass rounded-2xl px-5 py-4">
        <div className="text-xs uppercase tracking-wide text-white/60 font-semibold mb-3">
          Pólizas por estado
        </div>
        <div className="space-y-2">
          {estados.map(([estado, cantidad]) => {
            const pct = total ? (cantidad / total) * 100 : 0;
            const deEsteEstado = ventas.filter((v) => (v.estado || "SIN ESTADO") === estado);
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
          {productos.length > 1 && (
            <div className="flex items-center gap-1.5 pt-2 mt-2 border-t border-white/10 flex-wrap">
              <span className="text-[10px] uppercase tracking-wide text-white/40 font-semibold mr-1">
                Producto:
              </span>
              {productos.map(([corto, cantidad]) => {
                const activo = filtroProducto === corto;
                return (
                  <button
                    key={corto}
                    type="button"
                    onClick={() => setFiltroProducto(activo ? null : corto)}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold cursor-pointer transition-colors ${BADGE_PRODUCTO[corto]} ${activo ? "ring-1 ring-white/40" : "opacity-75 hover:opacity-100"}`}
                    title={nombreProducto(corto)}
                  >
                    {cantidad} {corto}
                  </button>
                );
              })}
              {filtroProducto && (
                <button
                  type="button"
                  onClick={() => setFiltroProducto(null)}
                  className="text-[10px] text-white/50 hover:text-white ml-1"
                >
                  ✕
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="glass rounded-2xl px-5 py-4 lg:sticky lg:top-[76px]">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs uppercase tracking-wide text-white/60 font-semibold">
            Día a día
          </div>
          <div className="flex items-center gap-1.5">
            {filtroProducto && (
              <button
                type="button"
                onClick={() => setFiltroProducto(null)}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ${BADGE_PRODUCTO[filtroProducto]}`}
              >
                {filtroProducto} ✕
              </button>
            )}
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
        </div>
        <div className="space-y-1.5 max-h-[calc(100vh-220px)] overflow-auto pr-1">
          {agruparPorDia(ventasFiltradas)
            .filter(([, items]) => items.length > 0)
            .map(([fecha, items]) => (
              <div key={fecha} className="rounded-lg border border-white/10 px-3 py-2 flex items-center justify-between gap-2 flex-wrap">
                <span className="font-semibold text-white text-xs shrink-0 flex items-center gap-1.5">
                  {fmtFecha(fecha)} <span className="text-white/40 font-normal">· {items.length}</span>
                  {canceladasDelDia(items).length > 0 && (
                    <button
                      type="button"
                      onClick={() => setPopupCanceladas(canceladasDelDia(items))}
                      className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-red-900/60 text-red-200 cursor-pointer hover:brightness-125 transition"
                      title="Ver revisión de canceladas de este día"
                    >
                      📋 {canceladasDelDia(items).length}
                    </button>
                  )}
                </span>
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  {contarPorProducto(items).map(([corto, cantidad]) => (
                    <button
                      key={`p-${corto}`}
                      type="button"
                      onClick={() => setFiltroProducto(filtroProducto === corto ? null : corto)}
                      className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold cursor-pointer hover:brightness-125 transition text-center min-w-[40px] ${BADGE_PRODUCTO[corto]}`}
                      title={nombreProducto(corto)}
                    >
                      {cantidad} {corto}
                    </button>
                  ))}
                  {contarPorEstado(items).map(([estado, cantidad]) => (
                    <button
                      key={estado}
                      type="button"
                      onClick={() =>
                        setPopup({
                          titulo: fmtFecha(fecha),
                          estado,
                          grupos: [[fecha, items.filter((v) => (v.estado || "SIN ESTADO") === estado)]],
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
        <div className="mt-2 text-[10px] text-white/40">
          CP = Cuota Protegida · CV = Combo Vida · RS = Rueda Seguro · BP = Billetera Protegida
        </div>
      </div>

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
              {popup.grupos.map(([fecha, items]) => (
                <div key={fecha}>
                  {popup.grupos.length > 1 && (
                    <div className="text-[11px] font-semibold text-white/50 uppercase tracking-wide mb-1.5">
                      {fmtFecha(fecha)} · {items.length}
                    </div>
                  )}
                  <div className="space-y-2">
                    {items.map((v, i) => {
                      const { corto } = etiquetaProducto(v.producto);
                      const canceladaDeContrato = canceladasArr.find(
                        (c) => normContratoJs(c.numero_contrato) === normContratoJs(v.contrato)
                      );
                      return (
                        <div key={`${v.contrato}-${i}`} className="flex items-center justify-between text-xs border-t border-white/10 pt-2 first:border-t-0 first:pt-0">
                          <span className="text-white font-semibold tabular-nums">{v.contrato || "—"}</span>
                          <span className="flex items-center gap-2">
                            <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${BADGE_PRODUCTO[corto]}`}>{corto}</span>
                            <span className="text-white/60">{v.producto || "—"}</span>
                            {canceladaDeContrato && (
                              <button
                                type="button"
                                onClick={() => setPopupCanceladas([canceladaDeContrato])}
                                className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-red-900/60 text-red-200 cursor-pointer hover:brightness-125 transition"
                                title="Ver observación de esta cancelada"
                              >
                                📋 revisión
                              </button>
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {popupCanceladas && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4"
          onClick={() => setPopupCanceladas(null)}
        >
          <div
            className="modal-solid rounded-2xl px-5 py-4 max-w-lg w-full max-h-[80vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs uppercase tracking-wide text-white/60 font-semibold">
                Canceladas con revisión ({popupCanceladas.length})
              </div>
              <button
                type="button"
                onClick={() => setPopupCanceladas(null)}
                className="w-7 h-7 rounded-lg border border-white/20 text-white/70 hover:bg-white/10 transition-colors"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3">
              {popupCanceladas.map((c, i) => (
                <div key={`${c.numero_contrato}-${i}`} className="rounded-xl border border-white/10 px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-semibold text-white text-xs tabular-nums">{c.numero_contrato || "—"}</span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {c.producto && (
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-white/10 text-white/70">{c.producto}</span>
                      )}
                      {c.gestion_supervisor_tmk && (
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-900/60 text-amber-200">{c.gestion_supervisor_tmk}</span>
                      )}
                      {c.estado_subsanacion && (
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-violet-900/60 text-violet-200">{c.estado_subsanacion}</span>
                      )}
                    </div>
                  </div>
                  {c.fecha_venta && <div className="text-[10px] text-white/40">Venta: {fmtFecha(c.fecha_venta)}</div>}
                  {c.causal_gestion && (
                    <div className="text-xs">
                      <span className="text-white/50 font-semibold">Motivo: </span>
                      <span className="text-white/75">{c.causal_gestion}</span>
                    </div>
                  )}
                  {c.observacion && (
                    <div className="text-xs">
                      <span className="text-white/50 font-semibold">Observación Kevin: </span>
                      <span className="text-white/90">{c.observacion}</span>
                    </div>
                  )}
                  {c.resultado_re_auditoria && (
                    <div className="text-xs">
                      <span className="text-white/50 font-semibold">Re-auditoría: </span>
                      <span className="text-white/75">{c.resultado_re_auditoria}</span>
                      {c.reauditoria && <span className="text-white/50"> · {c.reauditoria}</span>}
                    </div>
                  )}
                  {c.observacion_re_auditoria && (
                    <div className="text-xs">
                      <span className="text-white/50 font-semibold">Obs. re-auditoría: </span>
                      <span className="text-white/90">{c.observacion_re_auditoria}</span>
                    </div>
                  )}
                  {c.observaciones_reauditoria && (
                    <div className="text-xs">
                      <span className="text-white/50 font-semibold">Obs. subsanación: </span>
                      <span className="text-white/90">{c.observaciones_reauditoria}</span>
                    </div>
                  )}
                  {(c.fecha_gestion || c.gestor) && (
                    <div className="text-[10px] text-white/40">
                      {c.fecha_gestion ? `Gestión: ${fmtFecha(c.fecha_gestion)}` : ""}
                      {c.fecha_gestion && c.gestor ? " · " : ""}
                      {c.gestor ? `Gestor: ${c.gestor}` : ""}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MiResumenAsesor({ resumen, detalleDiaDia, billetera, canceladasRevision }) {
  const ventas = detalleDiaDia || [];
  const rs = ventas.filter((v) => etiquetaProducto(v.producto).corto === "RS");

  if (!resumen && ventas.length === 0) {
    return (
      <div className="glass rounded-2xl px-5 py-6 text-sm text-white/60">
        Todavía no tienes ventas registradas este mes.
      </div>
    );
  }

  const conMeta = !!resumen;
  const sinMeta = conMeta && resumen.categoria === "SIN META";
  const color = !conMeta || sinMeta ? WARNING : semaforo(resumen.pct_cumpl_acumulado, resumen.pct_cump_ideal);
  const avance = conMeta ? Math.min(resumen.pct_cumpl_acumulado * 100, 100) : 0;

  return (
    <div className="space-y-4">
      {conMeta && (
        <div className="space-y-3">
          {resumen.observaciones && (
            <div className="rounded-2xl border border-amber-300/40 bg-amber-400/10 px-4 py-3 text-xs text-amber-100">
              <div className="font-semibold mb-0.5">Ajuste en tu meta</div>
              {resumen.observaciones}
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            <StatTile label="Categoría" value={resumen.categoria} />
            <StatTile label="Meta del mes" value={fmtNumero(resumen.meta_mes)} />
            <StatTile label="Acumulado" value={fmtNumero(resumen.acumulado)} destacado />
            <StatTile label="Forecast de cierre" value={fmtNumero(resumen.forecast)} sub={fmtPct(resumen.pct_forecast) + " de la meta"} />
            {billetera?.total > 0 && (
              <StatTile
                label="Billetera Protegida"
                value={fmtNumero(billetera.total)}
                sub={`${fmtNumero(billetera.altas)} altas del mes`}
              />
            )}
            {rs.length > 0 && (
              <StatTile
                label="Rueda Seguro"
                value={fmtNumero(rs.length)}
                sub={`${fmtNumero(rs.filter((v) => ESTADOS_ALTA.includes(v.estado)).length)} altas del mes`}
              />
            )}
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
        </div>
      )}

      {ventas.length > 0 && (
        <SeccionVentas ventas={ventas} canceladas={canceladasRevision || []} />
      )}
    </div>
  );
}
