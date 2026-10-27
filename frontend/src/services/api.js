/** Cliente fetch base: rutas relativas /api/..., timeout con AbortController,
 * errores uniformes en español. Única capa del frontend que hace fetch (ver
 * .claude/skills/desarrollador-portal). */

const TIMEOUT_MS = 15000;

async function solicitar(path, opciones = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let respuesta;
  try {
    // credentials: "include" -- manda la cookie xuma_session del portal
    // (misma sesión que el CRM/ActiXuma) para que el backend sepa quién
    // consulta y filtre a solo su información.
    respuesta = await fetch(path, { signal: controller.signal, credentials: "include", ...opciones });
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error("La solicitud tardó demasiado. Intenta de nuevo.");
    }
    throw new Error("No se pudo conectar con el servidor.");
  } finally {
    clearTimeout(timeoutId);
  }

  if (!respuesta.ok) {
    let detalle = "";
    try {
      const cuerpo = await respuesta.json();
      detalle = cuerpo.detail || "";
    } catch {
      /* respuesta sin cuerpo JSON */
    }
    throw new Error((typeof detalle === "string" && detalle) || `Error del servidor (${respuesta.status})`);
  }

  return respuesta.json();
}

export function apiGet(path) {
  return solicitar(path);
}

export function apiPost(path, cuerpo) {
  return solicitar(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
  });
}
