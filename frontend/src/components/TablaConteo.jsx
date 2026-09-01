import { fmtNumero, fmtPct } from "../utils/formato";

/** Igual a TablaFacturacion pero sin columna de dinero -- para resúmenes que
 * no tienen facturacion_servi (ej. Rueda Segura, ver src/pivote.py). */
export default function TablaConteo({ filas, colEtiqueta, etiqueta, campoCantidad = "cantidad" }) {
  const totalCant = filas.reduce((acc, f) => acc + f[campoCantidad], 0);

  return (
    <div className="glass rounded-xl overflow-hidden text-xs">
      <div className="max-h-56 overflow-y-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="tabla-header text-white text-left">
              <th className="px-2.5 py-1.5 font-semibold">{etiqueta}</th>
              <th className="px-2.5 py-1.5 font-semibold text-right">Cant.</th>
              <th className="px-2.5 py-1.5 font-semibold text-right">% Part.</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f[colEtiqueta]} className="border-t border-white/10 text-white/85">
                <td className="px-2.5 py-1">{f[colEtiqueta]}</td>
                <td className="px-2.5 py-1 text-right tabular-nums">{fmtNumero(f[campoCantidad])}</td>
                <td className="px-2.5 py-1 text-right tabular-nums">
                  {fmtPct(totalCant ? f[campoCantidad] / totalCant : 0)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="sticky bottom-0">
            <tr className="border-t border-white/20 bg-xuma-surface-2 font-bold text-white">
              <td className="px-2.5 py-1.5">Total general</td>
              <td className="px-2.5 py-1.5 text-right tabular-nums">{fmtNumero(totalCant)}</td>
              <td className="px-2.5 py-1.5 text-right tabular-nums">100,0%</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
