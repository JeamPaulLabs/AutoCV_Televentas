import { useMemo } from "react";
import StatTile from "../StatTile";
import { fmtDia, fmtMoney, fmtNumero, fmtPct } from "../../utils/formato";
import PodioCard from "./PodioCard";
import SeccionTitulo from "./SeccionTitulo";
import { NOMBRE_PRODUCTO, ORDEN_PRODUCTO, sumar } from "./TablaDiaProductos";

// Categóricos sobre fondo oscuro (contraste AA con el vidrio); la identidad
// de cada producto la lleva también la etiqueta, no solo el color.
const COLOR_PRODUCTO = { CP: "#00cd93", BP: "#7aa2ff", RS: "#c4a1ff", PCV: "#fab219" };
const COLOR_ESTADO = { altas: "#00cd93", digitadas: "#7aa2ff", canceladas: "#8b90a8", otros: "#5c6180" };
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
  const porDia = [...agrupar(filas, "fecha_venta").entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([fecha, its]) => ({ fecha, t: sumar(its) }));
  const tot = sumar(filas);
  const mejor = porDia.reduce((m, d) => (d.t.total > (m?.t.total ?? -1) ? d : m), null);
  const diasLab = calendario.dias_laborados || porDia.length || 1;

  const productos = ORDEN_PRODUCTO.map((p) => [p, tot.porProducto[p] || 0]).filter(([, n]) => n > 0);
  const lider = [...productos].sort((a, b) => b[1] - a[1])[0];

  const insights = [];
  if (mejor) insights.push(`Mejor día del mes: ${fmtDia(mejor.fecha)} con ${fmtNumero(mejor.t.total)} ventas.`);
  if (total) insights.push(`Promedio de ${(total / diasLab).toFixed(1).replace(".", ",")} ventas por día laborado.`);
  if (total && tot.altas) insights.push(`${fmtPct(tot.altas / total)} de las ventas ya está en alta confirmada.`);
  if (lider && total) insights.push(`${NOMBRE_PRODUCTO[lider[0]]} lidera con ${fmtPct(lider[1] / total)} de las ventas.`);
  const n = porDia.length;
  if (n >= 6) {
    const suma = (arr) => arr.reduce((s, d) => s + d.t.total, 0);
    const ult = suma(porDia.slice(-3));
    const prev = suma(porDia.slice(-6, -3));
    if (prev > 0 && ult > prev) {
      insights.push(`Ritmo en alza: los últimos 3 días suman ${fmtNumero(ult)} ventas, ${fmtPct(ult / prev - 1)} más que los 3 anteriores.`);
    }
  }
  return { total, porDia, tot, productos, insights, diasLab };
}

function VentasPorDia({ porDia, productos }) {
  if (porDia.length === 0) return null;
  const W = 640, H = 190, PL = 30, PB = 22, PT = 8;
  const max = Math.max(...porDia.map((d) => d.t.total), 1);
  const techo = Math.ceil(max / 5) * 5 || 5;
  const paso = (W - PL) / porDia.length;
  const ancho = Math.max(Math.min(paso * 0.68, 28), 4);
  const y = (v) => PT + (H - PT - PB) * (1 - v / techo);
  const cada = Math.ceil(porDia.length / 16);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Ventas por día, apiladas por producto">
        {[0, techo / 2, techo].map((v) => (
          <g key={v}>
            <line x1={PL} x2={W} y1={y(v)} y2={y(v)} stroke="white" strokeOpacity="0.1" />
            <text x={PL - 5} y={y(v) + 3} textAnchor="end" fontSize="10" fill="white" fillOpacity="0.65">{Math.round(v)}</text>
          </g>
        ))}
        {porDia.map((d, i) => {
          const x = PL + i * paso + (paso - ancho) / 2;
          let base = 0;
          return (
            <g key={d.fecha}>
              <title>{`${fmtDia(d.fecha)}: ${d.t.total} ventas`}</title>
              {productos.map(([p]) => {
                const v = d.t.porProducto[p] || 0;
                if (!v) return null;
                const y1 = y(base + v);
                const alto = y(base) - y1;
                base += v;
                return <rect key={p} x={x} y={y1} width={ancho} height={alto} rx="2" fill={COLOR_PRODUCTO[p]} />;
              })}
              {i % cada === 0 && (
                <text x={x + ancho / 2} y={H - 6} textAnchor="middle" fontSize="10" fill="white" fillOpacity="0.7">
                  {d.fecha.slice(8)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="flex gap-3 flex-wrap mt-1">
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
    <ul className="space-y-2.5">
      {productos.map(([p, n]) => (
        <li key={p}>
          <div className="flex justify-between text-xs text-white/85 mb-1">
            <span title={NOMBRE_PRODUCTO[p]}>{NOMBRE_PRODUCTO[p]}</span>
            <span className="tabular-nums font-semibold">
              {fmtNumero(n)} · {fmtPct(total ? n / total : 0)}
            </span>
          </div>
          <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
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
      <div className="flex h-4 rounded-full overflow-hidden bg-white/10" role="img" aria-label="Estado de las ventas">
        {partes.map((k) => (
          <div key={k} style={{ width: `${(tot[k] / tot.total) * 100}%`, background: COLOR_ESTADO[k] }} title={`${NOMBRE_ESTADO[k]}: ${tot[k]}`} />
        ))}
      </div>
      <ul className="mt-2 space-y-1">
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
    <div className={`glass rounded-2xl px-5 py-4 ${className}`}>
      <SeccionTitulo>{titulo}</SeccionTitulo>
      {children}
    </div>
  );
}

/** Parte alta de Resumen y Vanti: cifras, insights en positivo, podio y gráficas.
 * conFacturacion=false es la versión Vanti (sin pesos). */
export default function ResumenVisual({ data, conFacturacion = true }) {
  const a = useMemo(() => analizar(data.dia_producto_estado, data.calendario), [data]);
  if (a.total === 0) return null;

  return (
    <div className="space-y-3">
      <div className="grid xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-3 items-stretch">
        <div className="glass rounded-2xl px-5 py-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
            <StatTile label="Total ventas" value={fmtNumero(a.total)} sub={`Corte al ${data.fecha_corte}`} destacado />
            {conFacturacion && <StatTile label="Facturación SERVI" value={fmtMoney(data.kpis.total_facturacion)} />}
            <StatTile label="Altas confirmadas" value={fmtNumero(a.tot.altas)} sub={`${fmtPct(a.tot.altas / a.total)} del total`} />
            <StatTile label="Ventas por día" value={(a.total / a.diasLab).toFixed(1).replace(".", ",")} sub={`${a.diasLab} días laborados`} />
          </div>
          <div className="text-[11px] uppercase tracking-wide text-white/70 mb-1.5">Lo que va bien</div>
          <ul className="space-y-1 text-sm text-white/90">
            {a.insights.map((t) => (
              <li key={t} className="flex gap-2">
                <span className="text-xuma-green-dark" aria-hidden="true">▲</span>
                {t}
              </li>
            ))}
          </ul>
        </div>
        <PodioCard podio={data.podio} />
      </div>

      <div className="grid xl:grid-cols-3 gap-3 items-stretch">
        <Panel titulo="Ventas por día" className="xl:col-span-2">
          <VentasPorDia porDia={a.porDia} productos={a.productos} />
        </Panel>
        <div className="grid gap-3">
          <Panel titulo="Mezcla de productos">
            <BarrasProducto productos={a.productos} total={a.total} />
          </Panel>
          <Panel titulo="Estado de las ventas">
            <BarraEstados tot={a.tot} />
          </Panel>
        </div>
      </div>
    </div>
  );
}
