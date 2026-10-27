import { useMemo, useState } from "react";
import { fmtDia, fmtMoney, fmtNumero } from "../../utils/formato";

export const ORDEN_PRODUCTO = ["CP", "BP", "RS", "PCV"];
export const NOMBRE_PRODUCTO = {
  CP: "Cuota Protegida",
  BP: "Billetera Protegida",
  RS: "Rueda Seguro",
  PCV: "Plan Combo Vida",
};
const ESTADOS_ALTA = ["AUDITADA WEB", "ALTA TRANSACCIONAL"];

export function claseEstado(estado) {
  if (ESTADOS_ALTA.includes(estado)) return "altas";
  if (estado === "DIGITADA WEB") return "digitadas";
  if (estado === "CANCELADA") return "canceladas";
  return "otros";
}

/** Suma un conjunto de filas (fecha x asesor x producto x estado) en una sola fila de totales. */
export function sumar(filas) {
  const t = { porProducto: {}, altas: 0, digitadas: 0, canceladas: 0, otros: 0, total: 0, fact: 0 };
  for (const f of filas) {
    t.porProducto[f.producto] = (t.porProducto[f.producto] || 0) + f.cantidad;
    t[claseEstado(f.nombre_estado)] += f.cantidad;
    t.total += f.cantidad;
    t.fact += f.facturacion_servi;
  }
  return t;
}

function agrupar(filas, clave) {
  const m = new Map();
  for (const f of filas) {
    const k = f[clave];
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(f);
  }
  return m;
}

const num = (n) => (n ? fmtNumero(n) : <span className="text-white/30">·</span>);

function Celdas({ t, productos, hayOtros, acum, conFacturacion }) {
  return (
    <>
      {productos.map((p) => (
        <td key={p} className="px-2 py-0.5 text-right tabular-nums">{num(t.porProducto[p])}</td>
      ))}
      <td className="px-2 py-0.5 text-right tabular-nums border-l border-white/10">{num(t.altas)}</td>
      <td className="px-2 py-0.5 text-right tabular-nums">{num(t.digitadas)}</td>
      <td className="px-2 py-0.5 text-right tabular-nums">{num(t.canceladas)}</td>
      {hayOtros && <td className="px-2 py-0.5 text-right tabular-nums">{num(t.otros)}</td>}
      <td className="px-2 py-0.5 text-right tabular-nums font-bold border-l border-white/10">{fmtNumero(t.total)}</td>
      <td className="px-2 py-0.5 text-right tabular-nums text-white/70">{acum == null ? "" : fmtNumero(acum)}</td>
      {conFacturacion && (
        <td className="px-2 py-0.5 text-right tabular-nums">{t.fact ? fmtMoney(t.fact) : <span className="text-white/30">·</span>}</td>
      )}
    </>
  );
}

/** Día a día de los productos (CP, BP, RS, PCV): una fila por día con
 * conteos por producto y por estado. Sin desglose por asesor (eso va en "Como
 * vamos por asesor"); con conFacturacion=false es la versión Vanti. */
export default function TablaDiaProductos({ filas, titulo, conFacturacion = true }) {
  const [producto, setProducto] = useState("TODOS");

  const presentes = useMemo(() => {
    const set = new Set(filas.map((f) => f.producto));
    return ORDEN_PRODUCTO.filter((p) => set.has(p) || p !== "PCV");
  }, [filas]);

  const filtradas = useMemo(
    () => filas.filter((f) => producto === "TODOS" || f.producto === producto),
    [filas, producto]
  );

  const productosCol = producto === "TODOS" ? presentes : [producto];
  const dias = useMemo(() => {
    const porDia = agrupar(filtradas, "fecha_venta");
    let acum = 0;
    return [...porDia.keys()]
      .sort()
      .map((fecha) => {
        const t = sumar(porDia.get(fecha));
        acum += t.total;
        return { fecha, t, acum };
      })
      .reverse();
  }, [filtradas]);
  const totalGeneral = useMemo(() => sumar(filtradas), [filtradas]);
  const hayOtros = totalGeneral.otros > 0;
  const totalPorProducto = useMemo(() => sumar(filas).porProducto, [filas]);

  const chip = (activo) =>
    `px-2 py-0.5 rounded-full text-[11px] font-semibold transition-colors ${
      activo ? "bg-xuma-green-dark text-xuma-bg-dark" : "glass text-white/75 hover:text-white"
    }`;


  return (
    <div>
      <div className="flex items-center justify-between gap-2 flex-wrap border-b-2 border-xuma-green-dark pb-1 mb-2">
        <h3 className="text-xs uppercase tracking-wide text-white/75 font-bold">{titulo}</h3>
        <div className="flex items-center gap-1.5 flex-wrap">
          <button type="button" className={chip(producto === "TODOS")} onClick={() => setProducto("TODOS")}>
            Todos · {fmtNumero(Object.values(totalPorProducto).reduce((a, b) => a + b, 0))}
          </button>
          {presentes.map((p) => (
            <button key={p} type="button" className={chip(producto === p)} onClick={() => setProducto(p)} title={NOMBRE_PRODUCTO[p]}>
              {p} · {fmtNumero(totalPorProducto[p] || 0)}
            </button>
          ))}
        </div>
      </div>

      {dias.length === 0 ? (
        <div className="glass rounded-xl px-3 py-4 text-sm text-white/70">Sin ventas para este filtro.</div>
      ) : (
        <div className="glass rounded-xl overflow-x-auto text-xs">
          <table className="w-full border-collapse">
            <thead>
              <tr className="tabla-header text-white text-left">
                <th className="px-2 py-0.5 font-semibold">Fecha</th>
                {productosCol.map((p) => (
                  <th key={p} className="px-2 py-0.5 font-semibold text-right" title={NOMBRE_PRODUCTO[p]}>{p}</th>
                ))}
                <th className="px-2 py-0.5 font-semibold text-right border-l border-white/10" title="Auditada Web + Alta Transaccional">Altas</th>
                <th className="px-2 py-0.5 font-semibold text-right">Digitadas</th>
                <th className="px-2 py-0.5 font-semibold text-right">Canceladas</th>
                {hayOtros && <th className="px-2 py-0.5 font-semibold text-right">Otros</th>}
                <th className="px-2 py-0.5 font-semibold text-right border-l border-white/10">Total</th>
                <th className="px-2 py-0.5 font-semibold text-right">Acumulado</th>
                {conFacturacion && <th className="px-2 py-0.5 font-semibold text-right">Facturación SERVI</th>}
              </tr>
            </thead>
            <tbody>
              {dias.map(({ fecha, t, acum }) => (
                <tr key={fecha} className="border-t border-white/10 text-white/90 hover:bg-white/5">
                  <td className="px-2 py-0.5 whitespace-nowrap">{fmtDia(fecha)}</td>
                  <Celdas t={t} productos={productosCol} hayOtros={hayOtros} acum={acum} conFacturacion={conFacturacion} />
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-white/20 bg-xuma-surface-2 font-bold text-white">
                <td className="px-2 py-0.5">Total del mes</td>
                <Celdas t={totalGeneral} productos={productosCol} hayOtros={hayOtros} acum={null} conFacturacion={conFacturacion} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <p className="mt-1.5 text-[11px] text-white/60">
        CP = Cuota Protegida · BP = Billetera Protegida · RS = Rueda Seguro · PCV = Plan Combo Vida · Altas = Auditada Web + Alta Transaccional
      </p>
    </div>
  );
}
