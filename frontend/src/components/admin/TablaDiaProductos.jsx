import { Fragment, useMemo, useState } from "react";
import { fmtDia, fmtMoney, fmtNumero } from "../../utils/formato";

const ORDEN_PRODUCTO = ["CP", "BP", "RS", "PCV"];
const NOMBRE_PRODUCTO = {
  CP: "Cuota Protegida",
  BP: "Billetera Protegida",
  RS: "Rueda Seguro",
  PCV: "Plan Combo Vida",
};
const ESTADOS_ALTA = ["AUDITADA WEB", "ALTA TRANSACCIONAL"];

function claseEstado(estado) {
  if (ESTADOS_ALTA.includes(estado)) return "altas";
  if (estado === "DIGITADA WEB") return "digitadas";
  if (estado === "CANCELADA") return "canceladas";
  return "otros";
}

/** Suma un conjunto de filas (fecha x asesor x producto x estado) en una sola celda de totales. */
function sumar(filas) {
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

function Celdas({ t, productos, hayOtros, acum }) {
  return (
    <>
      {productos.map((p) => (
        <td key={p} className="px-2.5 py-1.5 text-right tabular-nums">{num(t.porProducto[p])}</td>
      ))}
      <td className="px-2.5 py-1.5 text-right tabular-nums border-l border-white/10">{num(t.altas)}</td>
      <td className="px-2.5 py-1.5 text-right tabular-nums">{num(t.digitadas)}</td>
      <td className="px-2.5 py-1.5 text-right tabular-nums">{num(t.canceladas)}</td>
      {hayOtros && <td className="px-2.5 py-1.5 text-right tabular-nums">{num(t.otros)}</td>}
      <td className="px-2.5 py-1.5 text-right tabular-nums font-bold border-l border-white/10">{fmtNumero(t.total)}</td>
      <td className="px-2.5 py-1.5 text-right tabular-nums text-white/70">{acum == null ? "" : fmtNumero(acum)}</td>
      <td className="px-2.5 py-1.5 text-right tabular-nums">{t.fact ? fmtMoney(t.fact) : <span className="text-white/30">·</span>}</td>
    </>
  );
}

/** Día a día de los productos (CP, BP, RS, PCV): una fila por día con
 * conteos por producto y por estado; clic en un día para ver el detalle por asesor. */
export default function TablaDiaProductos({ filas }) {
  const [producto, setProducto] = useState("TODOS");
  const [asesor, setAsesor] = useState("TODOS");
  const [abierto, setAbierto] = useState(null);

  const presentes = useMemo(() => {
    const set = new Set(filas.map((f) => f.producto));
    return ORDEN_PRODUCTO.filter((p) => set.has(p) || p !== "PCV");
  }, [filas]);
  const asesores = useMemo(() => [...new Set(filas.map((f) => f.asesor))].sort(), [filas]);

  const filtradas = useMemo(
    () =>
      filas.filter(
        (f) => (producto === "TODOS" || f.producto === producto) && (asesor === "TODOS" || f.asesor === asesor)
      ),
    [filas, producto, asesor]
  );

  const productosCol = producto === "TODOS" ? presentes : [producto];
  const dias = useMemo(() => {
    const porDia = agrupar(filtradas, "fecha_venta");
    let acum = 0;
    return [...porDia.keys()]
      .sort()
      .map((fecha) => {
        const items = porDia.get(fecha);
        const t = sumar(items);
        acum += t.total;
        return { fecha, items, t, acum };
      })
      .reverse();
  }, [filtradas]);
  const totalGeneral = useMemo(() => sumar(filtradas), [filtradas]);
  const hayOtros = totalGeneral.otros > 0;
  const totalPorProducto = useMemo(() => sumar(filas).porProducto, [filas]);

  const chip = (activo) =>
    `px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
      activo ? "bg-xuma-green-dark text-xuma-bg-dark" : "glass text-white/75 hover:text-white"
    }`;

  function alternar(fecha) {
    setAbierto(abierto === fecha ? null : fecha);
  }

  return (
    <div>
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <button type="button" className={chip(producto === "TODOS")} onClick={() => setProducto("TODOS")}>
          Todos · {fmtNumero(Object.values(totalPorProducto).reduce((a, b) => a + b, 0))}
        </button>
        {presentes.map((p) => (
          <button key={p} type="button" className={chip(producto === p)} onClick={() => setProducto(p)} title={NOMBRE_PRODUCTO[p]}>
            {p} · {fmtNumero(totalPorProducto[p] || 0)}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-xs text-white/75">
          Asesor
          <select
            value={asesor}
            onChange={(e) => setAsesor(e.target.value)}
            className="glass rounded-lg px-2 py-1 text-xs text-white bg-xuma-surface-2"
          >
            <option value="TODOS">Todos</option>
            {asesores.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </label>
      </div>

      {dias.length === 0 ? (
        <div className="glass rounded-xl px-3 py-4 text-sm text-white/70">Sin ventas para este filtro.</div>
      ) : (
        <div className="glass rounded-xl overflow-auto text-xs max-h-[560px]">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="tabla-header text-white text-left">
                <th className="px-2.5 py-1.5 font-semibold">Fecha</th>
                {productosCol.map((p) => (
                  <th key={p} className="px-2.5 py-1.5 font-semibold text-right" title={NOMBRE_PRODUCTO[p]}>{p}</th>
                ))}
                <th className="px-2.5 py-1.5 font-semibold text-right border-l border-white/10" title="Auditada Web + Alta Transaccional">Altas</th>
                <th className="px-2.5 py-1.5 font-semibold text-right">Digitadas</th>
                <th className="px-2.5 py-1.5 font-semibold text-right">Canceladas</th>
                {hayOtros && <th className="px-2.5 py-1.5 font-semibold text-right">Otros</th>}
                <th className="px-2.5 py-1.5 font-semibold text-right border-l border-white/10">Total</th>
                <th className="px-2.5 py-1.5 font-semibold text-right">Acumulado</th>
                <th className="px-2.5 py-1.5 font-semibold text-right">Facturación SERVI</th>
              </tr>
            </thead>
            <tbody>
              {dias.map(({ fecha, items, t, acum }) => {
                const open = abierto === fecha;
                return (
                  <Fragment key={fecha}>
                    <tr
                      onClick={() => alternar(fecha)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          alternar(fecha);
                        }
                      }}
                      tabIndex={0}
                      aria-expanded={open}
                      title="Clic para ver el detalle por asesor"
                      className={`border-t border-white/10 cursor-pointer text-white/90 hover:bg-white/5 ${open ? "bg-white/10" : ""}`}
                    >
                      <td className="px-2.5 py-1.5 whitespace-nowrap">
                        <span className="text-white/50 mr-1.5" aria-hidden="true">{open ? "▾" : "▸"}</span>
                        {fmtDia(fecha)}
                      </td>
                      <Celdas t={t} productos={productosCol} hayOtros={hayOtros} acum={acum} />
                    </tr>
                    {open &&
                      [...agrupar(items, "asesor").entries()]
                        .map(([nombre, its]) => [nombre, sumar(its)])
                        .sort((a, b) => b[1].total - a[1].total)
                        .map(([nombre, ta]) => (
                          <tr key={`${fecha}-${nombre}`} className="bg-white/[0.03] text-white/75">
                            <td className="pl-8 pr-2.5 py-1 whitespace-nowrap">{nombre}</td>
                            <Celdas t={ta} productos={productosCol} hayOtros={hayOtros} acum={null} />
                          </tr>
                        ))}
                  </Fragment>
                );
              })}
            </tbody>
            <tfoot className="sticky bottom-0">
              <tr className="border-t border-white/20 bg-xuma-surface-2 font-bold text-white">
                <td className="px-2.5 py-1.5">Total del mes</td>
                <Celdas t={totalGeneral} productos={productosCol} hayOtros={hayOtros} acum={null} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <p className="mt-2 text-[11px] text-white/60">
        CP = Cuota Protegida · BP = Billetera Protegida · RS = Rueda Seguro · PCV = Plan Combo Vida · Altas = Auditada Web + Alta Transaccional
      </p>
    </div>
  );
}
