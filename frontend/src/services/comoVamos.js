import { apiGet } from "./api";

export function obtenerDashboard(periodo, fechaCorte, modo) {
  const params = new URLSearchParams({ periodo });
  if (fechaCorte) params.set("fecha_corte", fechaCorte);
  if (modo) params.set("modo", modo);
  return apiGet(`/api/como-vamos/dashboard?${params.toString()}`);
}
