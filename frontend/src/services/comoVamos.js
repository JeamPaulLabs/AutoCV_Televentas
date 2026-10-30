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

export function listarSeguimiento(periodo, asesor) {
  const params = new URLSearchParams({ periodo, asesor });
  return apiGet(`/api/como-vamos/auditorias/seguimiento?${params.toString()}`);
}

export function guardarSeguimiento(cuerpo) {
  return apiPost("/api/como-vamos/auditorias/seguimiento", cuerpo);
}

/** Solicita la actualizacion de Ilio (encola la solicitud; el job lo ejecuta un
 * proceso en el host). Devuelve { solicitud, creada }. */
export function solicitarActualizacionIlio() {
  return apiPost("/api/como-vamos/actualizar-ilio", {});
}

/** Estado de la ultima solicitud de actualizacion de Ilio + hora real del
 * ultimo corrido exitoso. */
export function estadoActualizacionIlio() {
  return apiGet("/api/como-vamos/actualizar-ilio/estado");
}
