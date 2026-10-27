import { apiGet, apiPost } from "./api";

export function obtenerDashboard(periodo, fechaCorte, modo, asesor) {
  const params = new URLSearchParams({ periodo });
  if (fechaCorte) params.set("fecha_corte", fechaCorte);
  if (modo) params.set("modo", modo);
  if (asesor) params.set("asesor", asesor);
  return apiGet(`/api/como-vamos/dashboard?${params.toString()}`);
}

/** Auditorías (solo supervisión de televentas). `periodo` es YYYY-MM. */
export function listarAuditorias(periodo, asesor) {
  const params = new URLSearchParams({ periodo, asesor });
  return apiGet(`/api/como-vamos/auditorias?${params.toString()}`);
}

export function guardarAuditoria(cuerpo) {
  return apiPost("/api/como-vamos/auditorias", cuerpo);
}
