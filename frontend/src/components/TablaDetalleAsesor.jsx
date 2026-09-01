import { fmtNumero } from "../utils/formato";

/** Pivote asesor x estado (columnas dinámicas, incluye 'Total general'). */
export default function TablaDetalleAsesor({ filas }) {
  if (!filas || filas.length === 0) {
    return <div className="glass rounded-xl px-3 py-2 text-sm text-white/50">Sin datos</div>;
  }
  const columnas = Object.keys(filas[0]).filter((c) => c !== "asesor");

  return (
    <div className="glass rounded-xl overflow-auto text-xs max-h-[420px]">
      <table className="w-full border-collapse">
        <thead>
          <tr className="tabla-header text-white text-left sticky top-0 z-10">
            <th className="px-2.5 py-1.5 font-semibold whitespace-nowrap">Asesor</th>
            {columnas.map((c) => (
              <th key={c} className="px-2.5 py-1.5 font-semibold text-right whitespace-nowrap">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila) => {
            const esTotal = fila.asesor === "Total general";
            return (
              <tr
                key={fila.asesor}
                className={`border-t border-white/10 whitespace-nowrap ${
                  esTotal ? "font-bold bg-white/5 text-white sticky bottom-0" : "text-white/85"
                }`}
              >
                <td className="px-2.5 py-1">{fila.asesor}</td>
                {columnas.map((c) => (
                  <td key={c} className="px-2.5 py-1 text-right tabular-nums">
                    {fmtNumero(fila[c])}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
