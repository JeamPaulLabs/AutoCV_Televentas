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
  PCV: "bg-teal-900/50 text-teal-200 border border-teal-700/40",
  BP: "bg-sky-900/50 text-sky-200 border border-sky-700/40",
  RS: "bg-violet-900/50 text-violet-200 border border-violet-700/40",
};

const NOMBRE_PRODUCTO = {
  CP: "Cuota Protegida",
  PCV: "Plan Combo Vida",
  BP: "Billetera Protegida",
  RS: "Rueda Seguro",
};

function etiquetaProducto(producto) {
  const p = (producto || "").toString().toUpperCase();
  if (p.includes("BILLETERA")) return { corto: "BP", nombre: "Billetera Protegida" };
  if (p.includes("RUEDA")) return { corto: "RS", nombre: "Rueda Seguro" };
  if (p.includes("COMBO")) return { corto: "PCV", nombre: "Plan Combo Vida" };
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
  // Orden estable: CP, PCV, RS, BP.
  const orden = ["CP", "PCV", "RS", "BP"];
  return [...conteo.entries()].sort((a, b) => orden.indexOf(a[0]) - orden.indexOf(b[0]));
}

/** Detalle de canceladas con la observación de auditoría; lo abren el día a día y el resumen. */
function PopupCanceladas({ items, onClose }) {
  return (
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
              Canceladas con revisión ({items.length})
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
            {items.map((c, i) => (
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
  );
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
          CP = Cuota Protegida · PCV = Plan Combo Vida · RS = Rueda Seguro · BP = Billetera Protegida
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

      {popupCanceladas && <PopupCanceladas items={popupCanceladas} onClose={() => setPopupCanceladas(null)} />}
    </div>
  );
}

const COLOR_PRODUCTO = { CP: "var(--prod-cp)", PCV: "var(--prod-pcv)", RS: "var(--prod-rs)", BP: "var(--prod-bp)" };
const COLUMNAS_PRODUCTO = ["CP", "PCV", "RS", "BP"];

const COLUMNAS_ESTADO = [
  { clave: "positivas", etiqueta: "Positivas", titulo: "Auditada Web + Alta Transaccional", clase: "text-emerald-300", punto: "bg-emerald-400" },
  { clave: "proceso", etiqueta: "En proceso", titulo: "Digitada Web", clase: "text-amber-300", punto: "bg-amber-400" },
  { clave: "canceladas", etiqueta: "Canceladas", titulo: "Canceladas", clase: "text-red-300", punto: "bg-red-400" },
];

function claveEstado(estado) {
  if (ESTADOS_ALTA.includes(estado)) return "positivas";
  if (estado === "CANCELADA") return "canceladas";
  return "proceso";
}

/** Ventas día a día: una fila por fecha, con cuántas fueron de cada producto y
 * en qué estado va cada una (positivas / en proceso / canceladas). */
function TablaDesempeno({ ventas }) {
  const vacio = () => ({ ...Object.fromEntries(COLUMNAS_PRODUCTO.map((c) => [c, 0])), positivas: 0, proceso: 0, canceladas: 0 });
  const totales = vacio();
  const filas = agruparPorDia(ventas).map(([fecha, items]) => {
    const f = vacio();
    for (const v of items) {
      const { corto } = etiquetaProducto(v.producto);
      for (const acc of [f, totales]) {
        acc[corto] += 1;
        acc[claveEstado(v.estado)] += 1;
      }
    }
    return { fecha, f, total: items.length };
  });
  const celda = (k, n, clase) => (
    <td key={k} className={`px-3 py-2 text-right tabular-nums ${n ? clase : "text-white/25"}`}>{n || "·"}</td>
  );
  return (
    <section className="glass rounded-2xl overflow-hidden" aria-label="Tus ventas por día y estado">
      <h3 className="px-4 py-3 text-xs uppercase tracking-wide text-white/60 font-semibold">Tus ventas por día y estado</h3>
      <div className="max-h-[420px] overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0">
            <tr className="tabla-header text-white/60">
              <th className="text-left font-semibold px-4 py-2">Fecha</th>
              {COLUMNAS_PRODUCTO.map((c) => (
                <th key={c} className="text-right font-semibold px-3 py-2">
                  <span className="inline-block w-2 h-2 rounded-sm mr-1.5" style={{ background: COLOR_PRODUCTO[c] }} />
                  {c}
                </th>
              ))}
              {COLUMNAS_ESTADO.map((e, i) => (
                <th key={e.clave} title={e.titulo} className={`text-right font-semibold px-3 py-2 ${i === 0 ? "border-l border-white/15" : ""}`}>
                  <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${e.punto}`} />
                  {e.etiqueta}
                </th>
              ))}
              <th className="text-right font-semibold px-4 py-2 border-l border-white/15">Total</th>
            </tr>
          </thead>
          <tbody>
            {filas.map(({ fecha, f, total }) => (
              <tr key={fecha} className="border-t border-white/10">
                <td className="px-4 py-2 text-white">{fmtFecha(fecha)}</td>
                {COLUMNAS_PRODUCTO.map((c) => celda(c, f[c], "text-white font-semibold"))}
                {COLUMNAS_ESTADO.map((e) => celda(e.clave, f[e.clave], `${e.clase} font-bold`))}
                <td className="px-4 py-2 text-right text-white font-bold tabular-nums">{total}</td>
              </tr>
            ))}
            <tr className="border-t border-white/10 bg-white/5 font-extrabold">
              <td className="px-4 py-2 text-white">Total</td>
              {COLUMNAS_PRODUCTO.map((c) => (
                <td key={c} className="px-3 py-2 text-right text-white tabular-nums">{totales[c]}</td>
              ))}
              {COLUMNAS_ESTADO.map((e) => (
                <td key={e.clave} className={`px-3 py-2 text-right tabular-nums ${e.clase}`}>{totales[e.clave]}</td>
              ))}
              <td className="px-4 py-2 text-right text-white tabular-nums">{ventas.length}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TileProducto({ corto, nombre, cantidad }) {
  return (
    <div className={`glass rounded-2xl px-3.5 py-3 flex items-center gap-3 ${cantidad === 0 ? "opacity-55" : ""}`}>
      <span
        className="w-9 h-9 rounded-[10px] flex items-center justify-center text-[11px] font-extrabold flex-none"
        style={cantidad === 0 ? { background: "rgb(128 128 128 / 0.2)" } : { background: COLOR_PRODUCTO[corto], color: "#0a0052" }}
      >
        {corto}
      </span>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-white/60 font-semibold truncate">{nombre}</div>
        <div className="text-2xl font-extrabold text-white tabular-nums leading-tight">{cantidad}</div>
      </div>
    </div>
  );
}

export default function MiResumenAsesor({ resumen, detalleDiaDia, canceladasRevision, otrosi }) {
  const ventas = detalleDiaDia || [];
  const [popupResumen, setPopupResumen] = useState(null);

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
  const cuenta = (corto) => ventas.filter((v) => etiquetaProducto(v.producto).corto === corto).length;
  const nPositivas = ventas.filter((v) => ESTADOS_ALTA.includes(v.estado)).length;
  const nEnProceso = ventas.filter((v) => v.estado === "DIGITADA WEB").length;
  const nCanceladas = ventas.filter((v) => v.estado === "CANCELADA").length;
  const conRevision = canceladasRevision || [];
  const listaCanceladas = ventas
    .filter((v) => v.estado === "CANCELADA")
    .map((venta) => ({
      venta,
      revision: conRevision.find((c) => normContratoJs(c.numero_contrato) === normContratoJs(venta.contrato)),
    }));
  // Otrosí vigente: la comisión se habilita desde pct_minimo_comision de la meta
  // individual -- se le ajusta la meta a todo asesor que tenga una.
  const metaAjustada = otrosi && conMeta && !sinMeta && resumen.meta_mes > 0 ? resumen.meta_mes * otrosi.pct_minimo_comision : null;
  const metaPrincipal = metaAjustada ?? (conMeta ? resumen.meta_mes : 0);
  const faltanPrincipal = Math.max(Math.ceil(metaPrincipal - (resumen?.acumulado ?? 0)), 0);
  // La barra se dibuja sobre la meta original (100%) y marca dónde cae la ajustada.
  const escala = conMeta && resumen.meta_mes > 0 ? resumen.meta_mes : 1;
  const pctDe = (n) => Math.min((n / escala) * 100, 100);

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

          <div className="grid lg:grid-cols-[1.25fr_1fr] gap-3">
            <section className="glass rounded-2xl px-5 py-5" aria-label={metaAjustada != null ? "Meta ajustada" : "Meta del mes"}>
              <div className="text-[11px] uppercase tracking-wide text-white/60 font-semibold">
                {metaAjustada != null ? `Meta ajustada · otrosí ${fmtPct(otrosi.pct_minimo_comision)}` : "Meta del mes"} · Categoría {resumen.categoria}
              </div>
              {sinMeta ? (
                <p className="mt-3 text-sm text-white/70">Todavía no tienes una meta asignada este mes.</p>
              ) : (
                <>
                  <div className="mt-2 text-5xl font-extrabold text-white tabular-nums leading-none">
                    {fmtNumero(resumen.acumulado)}
                    <span className="text-xl font-semibold text-white/60"> / {fmtNumero(metaPrincipal)}</span>
                  </div>
                  {metaAjustada != null && (
                    <div className="mt-1 text-xs text-white/60">
                      Meta original del mes: <s className="text-white/40 tabular-nums">{fmtNumero(resumen.meta_mes)}</s> · ajustada{" "}
                      <b className="text-white tabular-nums">{fmtNumero(metaAjustada)}</b>
                    </div>
                  )}
                  <div
                    className={`mt-3 inline-block text-xs font-bold px-2.5 py-1 rounded-full border ${
                      faltanPrincipal === 0
                        ? "bg-emerald-400/15 text-emerald-200 border-emerald-400/40"
                        : "bg-amber-400/15 text-amber-200 border-amber-400/40"
                    }`}
                  >
                    {faltanPrincipal === 0
                      ? "¡Ya alcanzaste tu meta!"
                      : `Te faltan ${fmtNumero(faltanPrincipal)} para ${metaAjustada != null ? "habilitar tu comisión" : "tu meta"}`}
                  </div>

                  <div className="mt-6" role="img" aria-label={`Positivas ${nPositivas} y acumulado ${resumen.acumulado} sobre una meta de ${fmtNumero(metaPrincipal)}`}>
                    <div className="relative h-3.5 rounded-full bg-white/10">
                      <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pctDe(resumen.acumulado)}%`, background: "rgb(0 205 147 / 0.35)" }} />
                      <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pctDe(nPositivas)}%`, background: `linear-gradient(90deg, ${color}, var(--color-xuma-green-light))` }} />
                      {metaAjustada != null && (
                        <div className="absolute -top-1 -bottom-1 w-0.5 rounded bg-white" style={{ left: `${pctDe(metaAjustada)}%` }}>
                          <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[10px] text-white/60 whitespace-nowrap">
                            Meta ajustada · {fmtNumero(metaAjustada)}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-white/60">
                      <span><i className="inline-block w-2 h-2 rounded-sm mr-1.5 bg-xuma-green-light" />Positivas {fmtNumero(nPositivas)}</span>
                      <span><i className="inline-block w-2 h-2 rounded-sm mr-1.5" style={{ background: "rgb(0 205 147 / 0.45)" }} />Acumulado {fmtNumero(resumen.acumulado)} (incluye digitadas y canceladas)</span>
                      <span className="sm:ml-auto">Ideal a la fecha: {fmtPct(resumen.pct_cump_ideal)} · cumplimiento: {fmtPct(resumen.pct_cumpl_acumulado)}</span>
                    </div>
                  </div>
                </>
              )}
            </section>

            <div className="grid grid-cols-2 gap-3">
              <StatTile label="Acumulado" value={fmtNumero(resumen.acumulado)} sub="Todas las ventas del mes" />
              <StatTile label="Positivas" value={fmtNumero(nPositivas)} sub="Auditada Web + Alta Transaccional" destacado />
              <StatTile label="En proceso" value={fmtNumero(nEnProceso)} sub="Digitada Web, aún sin auditar" />
              <StatTile
                label="Forecast de cierre"
                value={fmtNumero(resumen.forecast)}
                sub={fmtPct(resumen.pct_forecast) + (otrosi ? " de la meta ajustada" : " de la meta")}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <TileProducto corto="CP" nombre="Cuota Protegida" cantidad={cuenta("CP")} />
            <TileProducto corto="PCV" nombre="Plan Combo Vida" cantidad={cuenta("PCV")} />
            <TileProducto corto="RS" nombre="Rueda Seguro" cantidad={cuenta("RS")} />
            <TileProducto corto="BP" nombre="Billetera Protegida" cantidad={cuenta("BP")} />
          </div>

          {nCanceladas > 0 && (
            <section className="glass rounded-2xl px-4 py-3" aria-label="Tus canceladas">
              <div className="flex items-center gap-3 flex-wrap mb-2">
                <span className="text-sm font-bold text-white">
                  {fmtNumero(nCanceladas)} {nCanceladas === 1 ? "cancelada" : "canceladas"} este mes
                </span>
                <span className="text-[11px] text-white/50">Toca una para ver el detalle completo</span>
              </div>
              <div className="grid md:grid-cols-2 gap-2">
                {listaCanceladas.map(({ venta, revision }) => {
                  const { corto } = etiquetaProducto(venta.producto);
                  return (
                    <button
                      key={`${venta.contrato}-${venta.fecha_venta}`}
                      type="button"
                      disabled={!revision}
                      onClick={() => revision && setPopupResumen([revision])}
                      className="text-left rounded-xl border border-red-400/25 bg-red-400/5 px-3 py-2 transition-colors enabled:hover:bg-red-400/10 enabled:cursor-pointer disabled:cursor-default"
                    >
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-semibold text-white tabular-nums">{venta.contrato || "—"}</span>
                        <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${BADGE_PRODUCTO[corto]}`}>{corto}</span>
                        <span className="text-white/50 ml-auto">{fmtFecha(venta.fecha_venta)}</span>
                      </div>
                      <div className="mt-1 text-xs text-white/80 line-clamp-2">
                        {revision?.observacion || revision?.causal_gestion || (
                          <span className="text-white/40">Aún sin observación de auditoría</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}

      {ventas.length > 0 && <TablaDesempeno ventas={ventas} />}

      {ventas.length > 0 && <SeccionVentas ventas={ventas} canceladas={conRevision} />}

      {popupResumen && <PopupCanceladas items={popupResumen} onClose={() => setPopupResumen(null)} />}
    </div>
  );
}
