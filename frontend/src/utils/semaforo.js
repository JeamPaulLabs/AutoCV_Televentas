// Paleta de estado validada (skill dataviz). Fuente única para la vista
// administrativa; el color nunca es la única señal: siempre va con un ícono.
export const GOOD = "#0ca30c";
export const WARNING = "#fab219";
export const CRITICAL = "#d03b3b";

/** Compara el % de cumplimiento con el % ideal a la fecha. */
export function nivelSemaforo(pctCumpl, pctCumplIdeal) {
  if (pctCumplIdeal <= 0) return "bien";
  const razon = pctCumpl / pctCumplIdeal;
  if (razon >= 1) return "bien";
  if (razon >= 0.8) return "alerta";
  return "critico";
}

export const SEMAFORO = {
  bien: { color: GOOD, icono: "▲", texto: "En ritmo o por encima del ideal" },
  alerta: { color: WARNING, icono: "●", texto: "Entre 80% y 100% del ideal" },
  critico: { color: CRITICAL, icono: "▼", texto: "Por debajo del 80% del ideal" },
};
