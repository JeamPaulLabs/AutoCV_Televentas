import { fmtMoney, fmtNumero, fmtPct } from "../utils/formato";

/** Tabla etiqueta | cantidad | facturación | %participación, sobre filas ya
 * calculadas por el backend (mismos campos que src/pivote.py). */
export default function TablaFacturacion({ filas, colEtiqueta, etiqueta, campoCantidad }) {
  const totalCant = filas.reduce((acc, f) => acc + f[campoCantidad], 0);
  const totalFact = filas.reduce((acc, f) => acc + f.facturacion_servi, 0);
  const etiquetaCant = campoCantidad === "polizas" ? "Pólizas" : "Cant.";

  return (
    <div className="glass rounded-xl overflow-hidden text-xs">
      <div className="max-h-56 overflow-y-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="tabla-header text-white text-left">
              <th className="px-2.5 py-1.5 font-semibold">{etiqueta}</th>
              <th className="px-2.5 py-1.5 font-semibold text-right">{etiquetaCant}</th>
              <th className="px-2.5 py-1.5 font-semibold text-right">Facturación SERVI</th>
              <th className="px-2.5 py-1.5 font-semibold text-right">% Part.</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f[colEtiqueta]} className="border-t border-white/10 text-white/85">
                <td className="px-2.5 py-1">{f[colEtiqueta]}</td>
                <td className="px-2.5 py-1 text-right tabular-nums">{fmtNumero(f[campoCantidad])}</td>
                <td className="px-2.5 py-1 text-right tabular-nums">{fmtMoney(f.facturacion_servi)}</td>
                <td className="px-2.5 py-1 text-right tabular-nums">{fmtPct(f.pct_participacion)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="sticky bottom-0">
            <tr className="border-t border-white/20 bg-xuma-surface-2 font-bold text-white">
              <td className="px-2.5 py-1.5">Total general</td>
              <td className="px-2.5 py-1.5 text-right tabular-nums">{fmtNumero(totalCant)}</td>
              <td className="px-2.5 py-1.5 text-right tabular-nums">{fmtMoney(totalFact)}</td>
              <td className="px-2.5 py-1.5 text-right tabular-nums">100,0%</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
