import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import StatTile from "../StatTile";
import TablaConteo from "../TablaConteo";
import TablaFacturacion from "../TablaFacturacion";
import { fmtDia, fmtMoney, fmtNumero, fmtPct, mesNombreDe } from "../../utils/formato";
import logoClaro from "../../assets/logo-claro.png";
import logoOscuro from "../../assets/logo-oscuro.png";
import BarraExportar from "./BarraExportar";
import PodioCard from "./PodioCard";
import SeccionTitulo from "./SeccionTitulo";
import TablaDiaProductos, { NOMBRE_PRODUCTO, ORDEN_PRODUCTO, sumar } from "./TablaDiaProductos";

// Categóricos que se leen sobre fondo oscuro y claro; la identidad de cada
// producto la lleva también la etiqueta, no solo el color.
const COLOR_PRODUCTO = { CP: "#00b383", BP: "#5b8cff", RS: "#a876ff", PCV: "#e8a400" };
const COLOR_ESTADO = { altas: "#00b383", digitadas: "#5b8cff", canceladas: "#8b90a8", otros: "#5c6180" };
const NOMBRE_ESTADO = { altas: "Altas confirmadas", digitadas: "En proceso (digitadas)", canceladas: "Canceladas", otros: "Otros" };

function agrupar(filas, clave) {
  const m = new Map();
  for (const f of filas) {
    if (!m.has(f[clave])) m.set(f[clave], []);
    m.get(f[clave]).push(f);
  }
  return m;
}

/** Cifras e insights del mes, todos derivados de los datos. Solo se incluyen
 * los mensajes que son verdaderos: nada se infla ni se inventa. */
function analizar(filas, calendario) {
  const total = filas.reduce((s, f) => s + f.cantidad, 0);
  const porDia = new Map([...agrupar(filas, "fecha_venta").entries()].map(([fecha, its]) => [fecha, sumar(its)]));
  const dias = [...porDia.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const tot = sumar(filas);
  const mejor = dias.reduce((m, d) => (d[1].total > (m?.[1].total ?? -1) ? d : m), null);
  const diasLab = calendario.dias_laborados || dias.length || 1;

  const productos = ORDEN_PRODUCTO.map((p) => [p, tot.porProducto[p] || 0]).filter(([, n]) => n > 0);
  const lider = [...productos].sort((a, b) => b[1] - a[1])[0];

  const insights = [];
  if (mejor) insights.push(`Mejor día del mes: ${fmtDia(mejor[0])} con ${fmtNumero(mejor[1].total)} ventas.`);
  if (total) insights.push(`Promedio de ${(total / diasLab).toFixed(1).replace(".", ",")} ventas por día laborado.`);
  if (total && tot.altas) insights.push(`${fmtPct(tot.altas / total)} de las ventas ya está en alta confirmada.`);
  if (lider && total) insights.push(`${NOMBRE_PRODUCTO[lider[0]]} lidera con ${fmtPct(lider[1] / total)} de las ventas.`);
  if (dias.length >= 6) {
    const suma = (arr) => arr.reduce((s, d) => s + d[1].total, 0);
    const ult = suma(dias.slice(-3));
    const prev = suma(dias.slice(-6, -3));
    if (prev > 0 && ult > prev) {
      insights.push(`Ritmo en alza: los últimos 3 días suman ${fmtNumero(ult)} ventas, ${fmtPct(ult / prev - 1)} más que los 3 anteriores.`);
    }
  }
  return { total, porDia, tot, productos, insights, diasLab };
}

/** Ancho y alto reales del contenedor, para dibujar el SVG en pixeles. */
function useMedida(ref) {
  const [m, setM] = useState({ w: 640, h: 150 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) =>
      setM({ w: Math.floor(e.contentRect.width), h: Math.floor(e.contentRect.height) })
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return m;
}

/** Ventas por día de TODO el mes (1..último día): los días que faltan por
 * llegar quedan vacíos, así la gráfica siempre muestra el mes completo. */
function VentasPorDia({ porDia, productos, periodo, fechaCorte }) {
  const cont = useRef(null);
  const medida = useMedida(cont);
  const W = Math.max(medida.w, 280);
  const H = Math.max(medida.h, 110);
  const PL = 28, PB = 20, PT = 14;
  const [anio, mes] = periodo.split("-").map(Number);
  const nDias = new Date(anio, mes, 0).getDate();
  const clave = (d) => `${anio}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const max = Math.max(...[...porDia.values()].map((t) => t.total), 1);
  const techo = Math.max(Math.ceil(max / 5) * 5, 5);
  const paso = (W - PL) / nDias;
  const ancho = Math.max(Math.min(paso * 0.7, 26), 3);
  const y = (v) => PT + (H - PT - PB) * (1 - v / techo);
  const cadaEtiqueta = paso >= 20 ? 1 : paso >= 11 ? 2 : 5;
  const conValor = paso >= 22;

  return (
    <div className="flex flex-col flex-1 min-h-0">
    <div ref={cont} className="relative flex-1 min-h-[130px] overflow-hidden">
      <svg width={W} height={H} style={{ maxWidth: "100%" }} className="text-white absolute inset-0" role="img" aria-label="Ventas por día del mes, apiladas por producto">
        {[0, techo / 2, techo].map((v) => (
          <g key={v}>
            <line x1={PL} x2={W} y1={y(v)} y2={y(v)} stroke="currentColor" strokeOpacity="0.12" />
            <text x={PL - 5} y={y(v) + 3} textAnchor="end" fontSize="10" fill="currentColor" fillOpacity="0.65">{Math.round(v)}</text>
          </g>
        ))}
        {Array.from({ length: nDias }, (_, i) => {
          const dia = i + 1;
          const fecha = clave(dia);
          const t = porDia.get(fecha);
          const x = PL + i * paso + (paso - ancho) / 2;
          const futuro = fecha > fechaCorte;
          let base = 0;
          return (
            <g key={fecha}>
              <title>{t ? `${fmtDia(fecha)}: ${t.total} ventas` : fmtDia(fecha)}</title>
              {futuro && <rect x={PL + i * paso} y={PT} width={paso} height={H - PT - PB} fill="currentColor" fillOpacity="0.04" />}
              {t &&
                productos.map(([p]) => {
                  const v = t.porProducto[p] || 0;
                  if (!v) return null;
                  const y1 = y(base + v);
                  const alto = y(base) - y1;
                  base += v;
                  return <rect key={p} x={x} y={y1} width={ancho} height={alto} rx="1.5" fill={COLOR_PRODUCTO[p]} />;
                })}
              {t && conValor && (
                <text x={x + ancho / 2} y={y(t.total) - 3} textAnchor="middle" fontSize="9" fill="currentColor" fillOpacity="0.8">{t.total}</text>
              )}
              {(dia === 1 || dia % cadaEtiqueta === 0 || dia === nDias) && (
                <text x={x + ancho / 2} y={H - 6} textAnchor="middle" fontSize="10" fill="currentColor" fillOpacity={futuro ? 0.4 : 0.75}>{dia}</text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
      <div className="flex gap-3 flex-wrap mt-0.5">
        {productos.map(([p]) => (
          <span key={p} className="flex items-center gap-1.5 text-[11px] text-white/80">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: COLOR_PRODUCTO[p] }} aria-hidden="true" />
            {p}
          </span>
        ))}
      </div>
    </div>
  );
}

function BarrasProducto({ productos, total }) {
  const max = Math.max(...productos.map(([, n]) => n), 1);
  return (
    <ul className="space-y-2">
      {productos.map(([p, n]) => (
        <li key={p}>
          <div className="flex justify-between text-xs text-white/85 mb-0.5">
            <span>{NOMBRE_PRODUCTO[p]}</span>
            <span className="tabular-nums font-semibold">{fmtNumero(n)} · {fmtPct(total ? n / total : 0)}</span>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${(n / max) * 100}%`, background: COLOR_PRODUCTO[p] }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function BarraEstados({ tot }) {
  const partes = ["altas", "digitadas", "canceladas", "otros"].filter((k) => tot[k] > 0);
  return (
    <div>
      <div className="flex h-3 rounded-full overflow-hidden bg-white/10" role="img" aria-label="Estado de las ventas">
        {partes.map((k) => (
          <div key={k} style={{ width: `${(tot[k] / tot.total) * 100}%`, background: COLOR_ESTADO[k] }} title={`${NOMBRE_ESTADO[k]}: ${tot[k]}`} />
        ))}
      </div>
      <ul className="mt-2 space-y-0.5">
        {partes.map((k) => (
          <li key={k} className="flex items-center justify-between text-xs text-white/85">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: COLOR_ESTADO[k] }} aria-hidden="true" />
              {NOMBRE_ESTADO[k]}
            </span>
            <span className="tabular-nums font-semibold">{fmtNumero(tot[k])} · {fmtPct(tot[k] / tot.total)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Panel({ titulo, children, className = "" }) {
  return (
    <div className={`glass rounded-2xl px-4 py-3 flex flex-col ${className}`}>
      <SeccionTitulo>{titulo}</SeccionTitulo>
      {children}
    </div>
  );
}

/** Reporte de las vistas "Resumen" y "Vanti": todo en una pantalla pensada
 * para PC a zoom 100%, descargable como imagen o enviable por WhatsApp.
 * conFacturacion=false es la versión Vanti (solo cantidades, sin pesos). */
export default function ReporteResumen({ data, tema, conFacturacion = true }) {
  const objetivo = useRef(null);
  const a = useMemo(() => analizar(data.dia_producto_estado, data.calendario), [data]);
  const nombre = conFacturacion ? "Resumen" : "Vanti";
  const mes = mesNombreDe(data.periodo);

  // La barra de acciones se pinta en la fila de las pestanas (ver Tabs.jsx).
  const [slot, setSlot] = useState(null);
  useEffect(() => setSlot(document.getElementById("acciones-tab")), []);

  const barra = (
    <BarraExportar
      objetivoRef={objetivo}
      tema={tema}
      insights={a.insights}
      nombreArchivo={`como-vamos-televentas_${nombre.toLowerCase()}_${data.fecha_corte}.png`}
      textoWhatsApp={`COMO VAMOS · TELEVENTAS — ${nombre} · ${mes} · corte al ${data.fecha_corte}`}
    />
  );
  const tabla = (filas, colEtiqueta, etiqueta) =>
    conFacturacion ? (
      <TablaFacturacion compacto filas={filas} colEtiqueta={colEtiqueta} etiqueta={etiqueta} campoCantidad="cantidad" />
    ) : (
      <TablaConteo compacto filas={filas} colEtiqueta={colEtiqueta} etiqueta={etiqueta} />
    );

  return (
    <div>
      {slot ? createPortal(barra, slot) : barra}

      <div ref={objetivo} className="space-y-3">
        {/* Cabecera que solo aparece en la imagen exportada */}
        <div className="solo-captura items-center justify-between gap-4">
          <img src={tema === "claro" ? logoClaro : logoOscuro} alt="Xuma" className="h-12 w-auto" />
          <div className="text-right">
            <div className="text-lg font-extrabold text-white">COMO VAMOS · TELEVENTAS — {nombre}</div>
            <div className="text-xs text-white/70">{mes} · corte al {data.fecha_corte} · Seguros Vanti — Zurich</div>
          </div>
        </div>

        <div className="grid xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-3 items-stretch">
          <div className="grid grid-cols-2 gap-2 [&>*]:flex [&>*]:flex-col [&>*]:justify-center">
            <StatTile label="Total ventas" value={fmtNumero(a.total)} sub={`Corte al ${data.fecha_corte}`} destacado />
            {conFacturacion && <StatTile label="Facturación SERVI" value={fmtMoney(data.kpis.total_facturacion)} />}
            <StatTile label="Altas confirmadas" value={fmtNumero(a.tot.altas)} sub={`${fmtPct(a.total ? a.tot.altas / a.total : 0)} del total`} />
            <StatTile label="Ventas por día" value={(a.total / a.diasLab).toFixed(1).replace(".", ",")} sub={`${a.diasLab} días laborados`} />
          </div>
          <PodioCard podio={data.podio} />
        </div>

        {/* Todo el reporte en una sola pantalla: la tabla completa a la izquierda
            (sin scroll) y, a la derecha, grafica, gasera, producto, mezcla y estado. */}
        <div className="grid xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-3 items-stretch">
          <TablaDiaProductos titulo="Desempeño diario por producto" filas={data.dia_producto_estado} conFacturacion={conFacturacion} />

          <div className="flex flex-col gap-3 min-w-0">
            {a.total > 0 && (
              <Panel titulo="Ventas por día — mes completo" className="flex-1">
                <VentasPorDia porDia={a.porDia} productos={a.productos} periodo={data.periodo} fechaCorte={data.fecha_corte} />
              </Panel>
            )}
            <div className="grid sm:grid-cols-2 gap-3 items-start">
              <div>
                <SeccionTitulo>{conFacturacion ? "Facturación por gasera" : "Ventas por gasera"}</SeccionTitulo>
                {tabla(data.tabla_gasera, "entidad_facturacion", "Gasera")}
                <SeccionTitulo className="mt-3">{conFacturacion ? "Facturación por producto" : "Ventas por producto"}</SeccionTitulo>
                {tabla(data.tabla_producto, "producto", "Producto")}
              </div>
              {a.total > 0 && (
                <div className="space-y-3">
                  <Panel titulo="Mezcla de productos">
                    <BarrasProducto productos={a.productos} total={a.total} />
                  </Panel>
                  <Panel titulo="Estado de las ventas">
                    <BarraEstados tot={a.tot} />
                  </Panel>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
