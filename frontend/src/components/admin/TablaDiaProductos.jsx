import { useMemo } from "react";
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

const vacio = <span className="text-white/30">·</span>;

/** Una tabla de desempeño diario: una fila por día con ventas de los productos
 * del grupo, con su cantidad (suma del grupo) y, si se pide, la facturación. */
function TablaGrupo({ titulo, filas, productos, conFacturacion }) {
  const dias = useMemo(() => {
    const porDia = agrupar(filas.filter((f) => productos.includes(f.producto)), "fecha_venta");
    return [...porDia.keys()]
      .sort()
      .reverse()
      .map((fecha) => ({ fecha, t: sumar(porDia.get(fecha)) }));
  }, [filas, productos]);
  const total = useMemo(() => sumar(filas.filter((f) => productos.includes(f.producto))), [filas, productos]);

  return (
    <div className="flex flex-col min-w-0">
      <h3 className="text-xs uppercase tracking-wide text-white/75 font-bold border-b-2 border-xuma-green-dark pb-1 mb-2">{titulo}</h3>
      {dias.length === 0 ? (
        <div className="glass rounded-xl px-3 py-4 text-sm text-white/70">Sin ventas en el mes.</div>
      ) : (
        <div className="glass rounded-xl overflow-x-auto text-xs flex-1">
          <table className="w-full h-full border-collapse">
            <thead>
              <tr className="tabla-header text-white text-left">
                <th className="px-2 py-0.5 font-semibold">Fecha</th>
                <th className="px-2 py-0.5 font-semibold text-right">Cantidad</th>
                {conFacturacion && <th className="px-2 py-0.5 font-semibold text-right border-l border-white/10">Facturación</th>}
              </tr>
            </thead>
            <tbody>
              {dias.map(({ fecha, t }) => (
                <tr key={fecha} className="border-t border-white/10 text-white/90 hover:bg-white/5">
                  <td className="px-2 py-0.5 whitespace-nowrap">{fmtDia(fecha)}</td>
                  <td className="px-2 py-0.5 text-right tabular-nums">{t.total ? fmtNumero(t.total) : vacio}</td>
                  {conFacturacion && (
                    <td className="px-2 py-0.5 text-right tabular-nums border-l border-white/10">{t.fact ? fmtMoney(t.fact) : vacio}</td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-white/20 bg-xuma-surface-2 font-bold text-white">
                <td className="px-2 py-0.5">Total</td>
                <td className="px-2 py-0.5 text-right tabular-nums">{fmtNumero(total.total)}</td>
                {conFacturacion && <td className="px-2 py-0.5 text-right tabular-nums border-l border-white/10">{fmtMoney(total.fact)}</td>}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

/** Desempeño diario en tres tablas: Cuota Protegida + Plan Combo Vida (con
 * facturación en la versión Resumen), Rueda Seguro y Billetera Protegida (solo
 * fecha y cantidad). Sin desglose por asesor ni por estado. */
export default function TablaDiaProductos({ filas, conFacturacion = true }) {
  return (
    <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2 items-stretch">
      <TablaGrupo titulo="Desempeño CP y PCV" filas={filas} productos={["CP", "PCV"]} conFacturacion={conFacturacion} />
      <TablaGrupo titulo="Desempeño Rueda Seguro" filas={filas} productos={["RS"]} conFacturacion={false} />
      <TablaGrupo titulo="Desempeño Billetera" filas={filas} productos={["BP"]} conFacturacion={false} />
    </div>
  );
}
