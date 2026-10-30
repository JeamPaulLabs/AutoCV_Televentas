import { useState } from "react";
import { fmtNumero, fmtPct } from "../utils/formato";

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
 * Diseño de una sola pantalla (sin scroll de página): arriba la meta y los
 * indicadores clave en una franja compacta; debajo, una única tabla "día a día"
 * que ocupa el alto restante y solo hace scroll interno si hay muchos días.
 * Cada número de la tabla es clicable y abre el detalle de contratos. Los tres
 * productos (CP / PCV / RS / BP) viven juntos en detalleDiaDia. */
const BADGE_ESTADO = {
  "AUDITADA WEB": "bg-emerald-900 text-emerald-200",
  "ALTA TRANSACCIONAL": "bg-emerald-900 text-emerald-200",
  "DIGITADA WEB": "bg-amber-900 text-amber-200",
  "CANCELADA": "bg-red-900 text-red-200",
  "CANCELADA (EXCEDE)": "bg-purple-900 text-purple-200 border border-purple-500/40",
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

/** Agrupa las ventas del asesor por día -- una fila por fecha. */
function agruparPorDia(detalle) {
  const grupos = new Map();
  for (const v of detalle) {
    const key = v.fecha_venta || "sin-fecha";
    if (!grupos.has(key)) grupos.set(key, []);
    grupos.get(key).push(v);
  }
  return [...grupos.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
}

/** Detalle de canceladas con la observación de auditoría. */
function PopupCanceladas({ items, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] px-4" onClick={onClose}>
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
            onClick={onClose}
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

/** Detalle de los contratos de una celda de la tabla (día + producto o estado). */
function PopupContratos({ titulo, items, canceladas, onClose, onRevision }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4" onClick={onClose}>
      <div
        className="modal-solid rounded-2xl px-5 py-4 max-w-md w-full max-h-[70vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs text-white/60">
            {titulo} · {items.length} {items.length === 1 ? "contrato" : "contratos"}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg border border-white/20 text-white/70 hover:bg-white/10 transition-colors"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
        <div className="space-y-2">
          {items.map((v, i) => {
            const { corto } = etiquetaProducto(v.producto);
            const revision = canceladas.find((c) => normContratoJs(c.numero_contrato) === normContratoJs(v.contrato));
            return (
              <div
                key={`${v.contrato}-${i}`}
                className="flex items-center justify-between gap-2 text-xs border-t border-white/10 pt-2 first:border-t-0 first:pt-0"
              >
                <span className="text-white font-semibold tabular-nums">{v.contrato || "—"}</span>
                <span className="flex items-center gap-1.5 flex-wrap justify-end">
                  <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${BADGE_PRODUCTO[corto]}`} title={NOMBRE_PRODUCTO[corto]}>
                    {corto}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${BADGE_ESTADO[v.estado] || BADGE_ESTADO_DEFAULT}`}>
                    {v.estado === "CANCELADA (EXCEDE)" ? "🚫 Excede cupo" : (v.estado || "SIN ESTADO")}
                  </span>
                  {revision && (
                    <button
                      type="button"
                      onClick={() => onRevision([revision])}
                      className="px-1.5 py-0.5 rounded-full text-[9px] font-bold chip-revision cursor-pointer hover:brightness-125 transition"
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
    </div>
  );
}

const COLUMNAS_PRODUCTO = ["CP", "PCV", "RS", "BP"];

const COLUMNAS_ESTADO = [
  { clave: "positivas", etiqueta: "Positivas", titulo: "Auditada Web + Alta Transaccional", clase: "est-pos", punto: "bg-emerald-400" },
  { clave: "proceso", etiqueta: "En proceso", titulo: "Digitada Web, aún sin auditar", clase: "est-proc", punto: "bg-amber-400" },
  { clave: "canceladas", etiqueta: "Canceladas", titulo: "Canceladas", clase: "est-canc", punto: "bg-red-400" },
];

function claveEstado(estado) {
  if (ESTADOS_ALTA.includes(estado)) return "positivas";
  if (estado === "CANCELADA") return "canceladas";
  if (estado === "CANCELADA (EXCEDE)") return "excede";
  return "proceso";
}

const COLOR_PRODUCTO = { CP: "var(--prod-cp)", PCV: "var(--prod-pcv)", RS: "var(--prod-rs)", BP: "var(--prod-bp)" };

// Orden fijo de lectura del ciclo de vida de una venta: recién digitada, luego
// lo que ya maduró, cancelada al final.
const ORDEN_ESTADO = ["DIGITADA WEB", "AUDITADA WEB", "ALTA TRANSACCIONAL", "CANCELADA"];

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

/** Tarjeta "Pólizas por estado": los estados reales de Ilio con su cantidad. */
function TarjetaEstados({ ventas, onAbrir }) {
  const estados = contarPorEstado(ventas);
  const total = ventas.length;
  return (
    <section className="glass rounded-2xl px-4 py-3" aria-label="Pólizas por estado">
      <div className="text-[11px] uppercase tracking-wide text-white/60 font-semibold mb-2">Pólizas por estado</div>
      <div className="space-y-1">
        {estados.map(([estado, cantidad]) => {
          const pct = total ? (cantidad / total) * 100 : 0;
          return (
            <button
              key={estado}
              type="button"
              onClick={() => onAbrir(`${estado} · total del mes`, ventas.filter((v) => (v.estado || "SIN ESTADO") === estado))}
              title="Ver los contratos de este estado"
              className="w-full flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-white/10 transition-colors cursor-pointer text-left"
            >
              <span className="w-36 shrink-0 text-xs text-white/80 truncate">{estado}</span>
              <span className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <span className="block h-full rounded-full bg-xuma-green-dark" style={{ width: `${pct}%` }} />
              </span>
              <span className="w-8 shrink-0 text-right text-xs font-bold text-white tabular-nums">{cantidad}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** Tabla completa día a día. Ocupa todo el alto disponible: las filas se
 * reparten el espacio (más aire con pocos días, compactas con muchos) y solo
 * hay scroll interno si aun así no caben. Encabezado y totales fijos. Cada
 * número abre el detalle de contratos; el botón 📋 va junto a las canceladas. */
function TablaDesempeno({ ventas, canceladas }) {
  const [detalle, setDetalle] = useState(null);
  const [popupCanceladas, setPopupCanceladas] = useState(null);

  const vacio = () => ({ ...Object.fromEntries(COLUMNAS_PRODUCTO.map((c) => [c, 0])), positivas: 0, proceso: 0, canceladas: 0 });
  const totales = vacio();
  const filas = agruparPorDia(ventas)
    .slice()
    .reverse() // cronológico: del día 1 hacia adelante
    .map(([fecha, items]) => {
      const f = vacio();
      for (const v of items) {
        const { corto } = etiquetaProducto(v.producto);
        for (const acc of [f, totales]) {
          acc[corto] += 1;
          acc[claveEstado(v.estado)] += 1;
        }
      }
      return { fecha, items, f };
    });
  // Solo los productos que el asesor realmente vendió: menos columnas vacías.
  const productos = COLUMNAS_PRODUCTO.filter((c) => totales[c] > 0);

  const abrir = (titulo, items) => items.length > 0 && setDetalle({ titulo, items });

  const boton = (n, clase, onClick, titulo) => (
    <button
      type="button"
      onClick={onClick}
      title={titulo}
      className={`min-w-[1.75rem] rounded px-1 cursor-pointer hover:bg-white/10 transition-colors ${clase}`}
    >
      {n}
    </button>
  );
  const vacioCelda = <span className="text-white/25">·</span>;

  return (
    <section className="glass rounded-2xl overflow-hidden flex flex-col min-h-0" aria-label="Ventas día a día">
      <div className="px-4 py-2 flex items-center justify-between gap-x-4 gap-y-1 flex-wrap border-b border-white/10">
        <h3 className="text-xs uppercase tracking-wide text-white/60 font-semibold">
          Ventas día a día · {filas.length} {filas.length === 1 ? "día" : "días"}
        </h3>
        <span className="text-[10px] text-white/40">
          {productos.map((c) => `${c} = ${NOMBRE_PRODUCTO[c]}`).join(" · ")} · Toca un número para ver los contratos
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        <table className="tabla-fija w-full text-xs xl:text-[13px]">
          <thead className="sticky top-0 z-10">
            <tr className="tabla-header text-white/60">
              <th className="text-left font-semibold px-3 py-1.5">Fecha</th>
              {productos.map((c) => (
                <th key={c} className="text-right font-semibold px-2 py-1.5" title={NOMBRE_PRODUCTO[c]}>
                  <span className="inline-block w-2 h-2 rounded-sm mr-1" style={{ background: COLOR_PRODUCTO[c] }} />
                  {c}
                </th>
              ))}
              {COLUMNAS_ESTADO.map((e, i) => (
                <th key={e.clave} title={e.titulo} className={`text-right font-semibold px-2 py-1.5 ${i === 0 ? "border-l border-white/15" : ""}`}>
                  <span className={`inline-block w-2 h-2 rounded-full mr-1 ${e.punto}`} />
                  {e.etiqueta}
                </th>
              ))}
              <th className="text-right font-semibold px-3 py-1.5 border-l border-white/15">Total</th>
            </tr>
          </thead>
          <tbody className={filas.length > 12 ? "[&_td]:py-1" : "[&_td]:py-2.5"}>
            {filas.map(({ fecha, items, f }) => {
              const nCanc = canceladas.filter((c) => items.some((v) => normContratoJs(v.contrato) === normContratoJs(c.numero_contrato)));
              return (
                <tr key={fecha} className="border-t border-white/10 hover:bg-white/[0.04]">
                  <td className="px-3 py-0.5 text-white whitespace-nowrap">{fmtFecha(fecha)}</td>
                  {productos.map((c) => (
                    <td key={c} className="px-2 py-0.5 text-right tabular-nums">
                      {f[c]
                        ? boton(f[c], "text-white font-semibold", () => abrir(`${fmtFecha(fecha)} · ${NOMBRE_PRODUCTO[c]}`, items.filter((v) => etiquetaProducto(v.producto).corto === c)), NOMBRE_PRODUCTO[c])
                        : vacioCelda}
                    </td>
                  ))}
                  {COLUMNAS_ESTADO.map((e, i) => (
                    <td key={e.clave} className={`px-2 py-0.5 text-right tabular-nums ${i === 0 ? "border-l border-white/10" : ""}`}>
                      {e.clave === "canceladas" && nCanc.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setPopupCanceladas(nCanc)}
                          className="mr-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold chip-revision cursor-pointer hover:brightness-125 transition"
                          title="Ver revisión de las canceladas de este día"
                        >
                          📋 revisión
                        </button>
                      )}
                      {e.clave === "canceladas" && items.some((v) => v.estado === "CANCELADA (EXCEDE)") && (
                        <button
                          type="button"
                          onClick={() => abrir(`${fmtFecha(fecha)} · Excede cupo`, items.filter((v) => v.estado === "CANCELADA (EXCEDE)"))}
                          className="mr-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-900/60 text-purple-200 border border-purple-500/40 cursor-pointer hover:brightness-125 transition"
                          title="Hubo póliza cancelada por exceder cupo / duplicidad (no suma al acumulado)"
                        >
                          🚫 excede
                        </button>
                      )}
                      {f[e.clave]
                        ? boton(f[e.clave], `${e.clase} font-bold`, () => abrir(`${fmtFecha(fecha)} · ${e.etiqueta}`, items.filter((v) => claveEstado(v.estado) === e.clave)), e.etiqueta)
                        : vacioCelda}
                    </td>
                  ))}
                  <td className="px-3 py-0.5 text-right text-white font-bold tabular-nums border-l border-white/10">
                    {boton(items.length, "", () => abrir(`${fmtFecha(fecha)} · Total`, items), "Ver todos los contratos del día")}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="sticky bottom-0 z-10">
            <tr className="tabla-header font-extrabold border-t border-white/20">
              <td className="px-3 py-1.5 text-white">Total</td>
              {productos.map((c) => (
                <td key={c} className="px-2 py-1.5 text-right text-white tabular-nums">{totales[c]}</td>
              ))}
              {COLUMNAS_ESTADO.map((e, i) => (
                <td key={e.clave} className={`px-2 py-1.5 text-right tabular-nums ${e.clase} ${i === 0 ? "border-l border-white/10" : ""}`}>{totales[e.clave]}</td>
              ))}
              <td className="px-3 py-1.5 text-right text-white tabular-nums border-l border-white/10">{ventas.length}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {detalle && (
        <PopupContratos
          titulo={detalle.titulo}
          items={detalle.items}
          canceladas={canceladas}
          onClose={() => setDetalle(null)}
          onRevision={setPopupCanceladas}
        />
      )}
      {popupCanceladas && <PopupCanceladas items={popupCanceladas} onClose={() => setPopupCanceladas(null)} />}
    </section>
  );
}

export default function MiResumenAsesor({ resumen, detalleDiaDia, canceladasRevision, otrosi }) {
  const ventas = detalleDiaDia || [];
  const [popupEstado, setPopupEstado] = useState(null);
  const [popupRev, setPopupRev] = useState(null);

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
  const nPositivas = ventas.filter((v) => ESTADOS_ALTA.includes(v.estado)).length;
  const nEnProceso = ventas.filter((v) => claveEstado(v.estado) === "proceso").length;
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

  // Desde md: columna izquierda (meta + estados) y tabla a la derecha ocupando
  // todo el alto de la ventana. En pantallas angostas todo se apila.
  return (
    <div className="flex flex-col gap-3 md:flex-row md:h-[calc(100dvh-var(--alto-cabecera,9rem))] md:min-h-[460px]">
      <aside className="flex flex-col gap-3 md:w-[19rem] lg:w-[22rem] xl:w-[26rem] shrink-0 md:overflow-y-auto md:min-h-0">
        {conMeta && resumen.observaciones && (
          <div className="rounded-2xl border border-amber-300/40 bg-amber-400/10 px-4 py-2 text-xs text-amber-100">
            <span className="font-semibold">Ajuste en tu meta: </span>
            {resumen.observaciones}
          </div>
        )}

        {conMeta && (
          <section className="glass rounded-2xl px-4 py-3" aria-label={metaAjustada != null ? "Meta ajustada" : "Meta del mes"}>
            <div className="text-[11px] uppercase tracking-wide text-white/60 font-semibold">
              {metaAjustada != null ? `Meta ajustada · otrosí ${fmtPct(otrosi.pct_minimo_comision)}` : "Meta del mes"} · Categoría {resumen.categoria}
            </div>
            {sinMeta ? (
              <p className="mt-2 text-sm text-white/70">Todavía no tienes una meta asignada este mes.</p>
            ) : (
              <>
                <div className="mt-1 text-4xl font-extrabold text-white tabular-nums leading-none">
                  {fmtNumero(resumen.acumulado)}
                  <span className="text-lg font-semibold text-white/60"> / {fmtNumero(metaPrincipal)}</span>
                </div>
                <div
                  className={`mt-2 inline-block text-xs font-bold px-2.5 py-1 rounded-full ${faltanPrincipal === 0 ? "chip-ok" : "chip-falta"}`}
                >
                  {faltanPrincipal === 0
                    ? "¡Ya alcanzaste tu meta!"
                    : `Te faltan ${fmtNumero(faltanPrincipal)} para ${metaAjustada != null ? "habilitar tu comisión" : "tu meta"}`}
                </div>
                <div
                  className={metaAjustada != null ? "mt-6" : "mt-3"}
                  role="img"
                  aria-label={`Positivas ${nPositivas} y acumulado ${resumen.acumulado} sobre una meta de ${fmtNumero(metaPrincipal)}`}
                >
                  <div className="relative h-3 rounded-full bg-white/10">
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
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-white/60">
                    <span><i className="inline-block w-2 h-2 rounded-sm mr-1.5 bg-xuma-green-light" />Positivas {fmtNumero(nPositivas)}</span>
                    <span><i className="inline-block w-2 h-2 rounded-sm mr-1.5" style={{ background: "rgb(0 205 147 / 0.45)" }} />Acumulado {fmtNumero(resumen.acumulado)}</span>
                  </div>
                  <div className="mt-1 text-[11px] text-white/60">
                    Ideal a la fecha: {fmtPct(resumen.pct_cump_ideal)} · cumplimiento: {fmtPct(resumen.pct_cumpl_acumulado)}
                  </div>
                  <div className="mt-1 text-[11px] text-white/60">
                    Forecast de cierre: <b className="text-white tabular-nums">{fmtNumero(resumen.forecast)}</b> ({fmtPct(resumen.pct_forecast)}
                    {otrosi ? " de la meta ajustada" : " de la meta"})
                  </div>
                </div>
              </>
            )}
          </section>
        )}

        {conMeta && !sinMeta && (
          <div className="grid grid-cols-3 gap-2" aria-label="Resumen de ventas">
            {[
              ["Acumulado", resumen.acumulado, "text-white", "Todas las ventas del mes"],
              ["Positivas", nPositivas, "est-pos", "Auditada Web + Alta Transaccional"],
              ["En proceso", nEnProceso, "est-proc", "Digitada Web, aún sin auditar"],
            ].map(([etiqueta, valor, clase, ayuda]) => (
              <div key={etiqueta} title={ayuda} className="glass rounded-2xl px-3 py-2">
                <div className="text-[10px] uppercase tracking-wide text-white/60 font-semibold truncate">{etiqueta}</div>
                <div className={`text-2xl font-extrabold tabular-nums leading-tight ${clase}`}>{fmtNumero(valor)}</div>
              </div>
            ))}
          </div>
        )}

        {listaCanceladas.length > 0 && (
          <section className="glass rounded-2xl px-4 py-3" aria-label="Tus canceladas">
            <div className="text-[11px] uppercase tracking-wide text-white/60 font-semibold mb-2">
              Tus canceladas · {listaCanceladas.length}
            </div>
            <div className="space-y-1.5">
              {listaCanceladas.map(({ venta, revision }) => {
                const { corto } = etiquetaProducto(venta.producto);
                return (
                  <button
                    key={`${venta.contrato}-${venta.fecha_venta}`}
                    type="button"
                    disabled={!revision}
                    onClick={() => revision && setPopupRev([revision])}
                    title={revision ? "Ver el detalle de la revisión" : undefined}
                    className="w-full text-left rounded-xl border border-white/10 px-3 py-2 transition-colors enabled:hover:bg-white/10 enabled:cursor-pointer disabled:cursor-default"
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

        {ventas.length > 0 && <TarjetaEstados ventas={ventas} onAbrir={(titulo, items) => setPopupEstado({ titulo, items })} />}
      </aside>

      {ventas.length > 0 && (
        <div className="flex flex-col min-h-0 min-w-0 flex-1 max-md:min-h-[320px] max-md:max-h-[75vh]">
          <TablaDesempeno ventas={ventas} canceladas={conRevision} />
        </div>
      )}

      {popupEstado && (
        <PopupContratos
          titulo={popupEstado.titulo}
          items={popupEstado.items}
          canceladas={conRevision}
          onClose={() => setPopupEstado(null)}
          onRevision={setPopupRev}
        />
      )}
      {popupRev && <PopupCanceladas items={popupRev} onClose={() => setPopupRev(null)} />}
    </div>
  );
}
