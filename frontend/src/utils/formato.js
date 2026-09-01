/** Formato numérico colombiano (punto de miles, coma decimal). */

export function fmtMoney(valor) {
  return `$ ${Math.round(valor).toLocaleString("es-CO")}`;
}

export function fmtNumero(valor) {
  return Math.round(valor).toLocaleString("es-CO");
}

export function fmtPct(valor) {
  return `${(valor * 100).toFixed(1).replace(".", ",")}%`;
}

/** Primer nombre + primer apellido, para tarjetas angostas (mismo criterio
 * que src/reporte_html.py::_nombre_corto). */
export function nombreCorto(nombre) {
  const tokens = nombre.split(" ").filter(Boolean);
  if (tokens.length <= 2) return nombre;
  const mitad = Math.floor((tokens.length + 1) / 2);
  return `${tokens[0]} ${tokens[mitad]}`;
}
