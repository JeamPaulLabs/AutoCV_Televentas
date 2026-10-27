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


/** "2026-10-05" -> "lun 05 oct". Se arma como fecha LOCAL (new Date("YYYY-MM-DD")
 * la lee como UTC y en Colombia cae un día antes). */
export function fmtDia(iso) {
  const [anio, mes, dia] = String(iso).split("T")[0].split("-").map(Number);
  if (!anio || !mes || !dia) return String(iso);
  const d = new Date(anio, mes - 1, dia);
  const sem = d.toLocaleDateString("es-CO", { weekday: "short" }).replace(".", "");
  const mesCorto = d.toLocaleDateString("es-CO", { month: "short" }).replace(".", "");
  return `${sem} ${String(dia).padStart(2, "0")} ${mesCorto}`;
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** "2026-10-01" -> "Octubre 2026". */
export function mesNombreDe(periodoIso) {
  const [anio, mes] = String(periodoIso).split("-");
  const nombre = MESES[Number(mes) - 1] || "";
  return `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} ${anio}`;
}
