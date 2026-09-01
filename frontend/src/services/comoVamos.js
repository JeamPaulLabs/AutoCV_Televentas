import { apiGet } from "./api";

export function obtenerDashboard(periodo, fechaCorte) {
  const params = new URLSearchParams({ periodo });
  if (fechaCorte) params.set("fecha_corte", fechaCorte);
  return apiGet(`/api/como-vamos/dashboard?${params.toString()}`);
}
