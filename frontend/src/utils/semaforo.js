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

// `color` es para rellenos (barras); `colorTexto` es para texto/íconos y cambia
// con el tema (en claro el ámbar y el verde claro no tendrían contraste).
export const SEMAFORO = {
  bien: { color: GOOD, colorTexto: "var(--sem-bien-txt)", icono: "▲", texto: "En ritmo o por encima del ideal" },
  alerta: { color: WARNING, colorTexto: "var(--sem-alerta-txt)", icono: "●", texto: "Entre 80% y 100% del ideal" },
  critico: { color: CRITICAL, colorTexto: "var(--sem-critico-txt)", icono: "▼", texto: "Por debajo del 80% del ideal" },
};
