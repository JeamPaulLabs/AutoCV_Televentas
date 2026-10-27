import { fmtDia, fmtNumero } from "../../utils/formato";

export const INPUT = "campo w-full text-xs";

export const RESULTADOS = [
  { id: "conforme", label: "Conforme" },
  { id: "con_observaciones", label: "Con observaciones" },
  { id: "requiere_revision", label: "Requiere revisión" },
];
export const ETIQUETA_RESULTADO = Object.fromEntries(RESULTADOS.map((r) => [r.id, r.label]));

export const ROL_NOMBRE = { comercial: "Comercial", interna: "Interna" };

/** Eventualidades que pueden explicar una cancelación (la auditoría interna las
 * asigna por póliza). "Falla de audio" es la de la cláusula 8 del otrosí. */
export const EVENTUALIDADES = [
  "Falla de audio",
  "Caída del sistema",
  "Cliente desiste",
  "Calidad de la venta",
  "Otra",
];

export const ITEMS_COMERCIAL = {
  meta: "Meta cargada y correcta",
  ventas: "Ventas del tablero coinciden con la base",
  dias: "Días laborados revisados",
  otrosi: "Estado frente al mínimo del otrosí",
};
export const ITEMS_INTERNA = {
  ventas_base: "Ventas coinciden con la base",
  causales: "Causales de cancelación revisadas",
  subsanacion: "Subsanaciones al día",
  reauditoria: "Re-auditorías gestionadas",
  audio: "Cancelaciones por audio validadas",
};

export function hace(isoFecha) {
  const dias = Math.floor((Date.now() - new Date(isoFecha).getTime()) / 86400000);
  if (dias <= 0) return "hoy";
  return dias === 1 ? "hace 1 día" : `hace ${dias} días`;
}

export function fmtMomento(iso) {
  return new Date(iso).toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "numeric", minute: "2-digit" });
}

export function Seccion({ titulo, derecha, children }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2 border-b border-white/15 pb-1">
        <h3 className="text-[11px] uppercase tracking-wide font-bold text-white/80">{titulo}</h3>
        {derecha}
      </div>
      {children}
    </section>
  );
}

/** Observaciones + resultado + guardar: igual en las dos auditorías. */
export function CierreAuditoria({ observaciones, setObservaciones, resultado, setResultado, onGuardar, guardando, aviso, placeholder, grupo }) {
  return (
    <Seccion titulo="Cierre de la auditoría">
      <textarea
        value={observaciones}
        onChange={(e) => setObservaciones(e.target.value)}
        rows={3}
        maxLength={4000}
        placeholder={placeholder}
        className={INPUT}
      />
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {RESULTADOS.map((r) => (
          <label key={r.id} className="flex items-center gap-1.5 text-xs text-white/90 cursor-pointer">
            <input type="radio" name={`resultado-${grupo}`} checked={resultado === r.id} onChange={() => setResultado(r.id)} className="accent-[#00cd93]" />
            {r.label}
          </label>
        ))}
      </div>
      <button
        type="button"
        onClick={onGuardar}
        disabled={!resultado || guardando}
        className="w-full rounded-lg px-3 py-2 text-sm font-bold bg-xuma-green-dark text-xuma-bg-dark disabled:opacity-40"
      >
        {guardando ? "Guardando…" : "Guardar auditoría"}
      </button>
      {!resultado && <p className="text-[11px] text-white/60">Elige un resultado para poder guardar.</p>}
      {aviso && (
        <p role="status" className={`text-xs ${aviso.ok ? "text-xuma-green-dark" : "text-red-300"}`}>
          {aviso.texto}
        </p>
      )}
    </Seccion>
  );
}

function Entrada({ a, abierta }) {
  const items = a.tipo === "interna" ? ITEMS_INTERNA : ITEMS_COMERCIAL;
  const marcados = Object.entries(a.items || {});
  const evs = Object.entries(a.eventualidades || {});
  return (
    <details open={abierta} className="rounded-lg border border-white/10 p-2 text-xs text-white/85">
      <summary className="cursor-pointer flex justify-between gap-2">
        <span className="font-semibold">{ETIQUETA_RESULTADO[a.resultado]}</span>
        <span className="text-white/60">{fmtMomento(a.creado_en)}</span>
      </summary>
      <div className="mt-1.5 space-y-1.5">
        <div className="text-white/65">
          Corte {a.fecha_corte}
          {a.auditor_nombre ? ` · ${a.auditor_nombre}` : ""}
          {a.resumen?.acumulado != null ? ` · ${fmtNumero(a.resumen.acumulado)} ventas` : ""}
          {a.dias_ajustados != null ? ` · días ajustados: ${a.dias_ajustados}/${a.dias_calendario}` : ""}
        </div>
        {a.observaciones && <p className="text-white/90">{a.observaciones}</p>}
        {marcados.length > 0 && (
          <ul className="space-y-0.5">
            {marcados.map(([k, v]) => (
              <li key={k} className={v ? "text-white/85" : "text-white/45"}>
                {v ? "☑" : "☐"} {items[k] || k}
              </li>
            ))}
          </ul>
        )}
        {a.novedades?.length > 0 && (
          <p className="text-white/70">
            Novedades:{" "}
            {a.novedades.map((n) => `${n.tipo}${n.desde ? ` (${fmtDia(n.desde)})` : ""}`).join(", ")}
          </p>
        )}
        {evs.length > 0 && (
          <p className="text-white/70">
            Eventualidades:{" "}
            {Object.entries(evs.reduce((m, [, e]) => ({ ...m, [e]: (m[e] || 0) + 1 }), {}))
              .map(([e, n]) => `${e} ${n}`)
              .join(" · ")}
          </p>
        )}
      </div>
    </details>
  );
}

/** Historial de un tipo de auditoría (la más reciente abierta). */
export function HistorialAuditorias({ auditorias, titulo = "Historial" }) {
  return (
    <details className="text-xs text-white/85">
      <summary className="cursor-pointer font-semibold">{titulo} ({auditorias.length})</summary>
      <div className="mt-2 space-y-2">
        {auditorias.map((a, i) => <Entrada key={a.id} a={a} abierta={i === 0} />)}
        {auditorias.length === 0 && <p className="text-white/60">Aún no hay auditorías.</p>}
      </div>
    </details>
  );
}

/** Vista de solo lectura de la auditoría del otro rol. */
export function AuditoriaSoloLectura({ auditorias, tipo, asesor }) {
  return (
    <aside className="glass rounded-2xl p-4 space-y-3" aria-label={`Auditoría ${ROL_NOMBRE[tipo]} de ${asesor}`}>
      <div>
        <div className="text-[11px] uppercase tracking-wide text-white/70">Auditoría {ROL_NOMBRE[tipo].toLowerCase()} · solo lectura</div>
        <div className="text-base font-extrabold text-white leading-tight">{asesor}</div>
      </div>
      {auditorias.length === 0 ? (
        <p className="text-xs text-white/65">Todavía no hay una auditoría {ROL_NOMBRE[tipo].toLowerCase()} de este asesor.</p>
      ) : (
        <div className="space-y-2">
          {auditorias.map((a, i) => <Entrada key={a.id} a={a} abierta={i === 0} />)}
        </div>
      )}
    </aside>
  );
}
