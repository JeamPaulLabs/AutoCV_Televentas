/** Pestaña "Mi auditoría" de la vista personal del asesor.
 *
 * Muestra el análisis agregado de TODOS sus audios auditados del mes que
 * tuvieron cancelación (incluidos los que luego se subsanaron): en qué parte
 * del guion se concentraron los hallazgos, qué aspectos de gestión mejorar y
 * qué criterios tiene limpios. Enfocado en retroalimentación, no caso a caso.
 */

const fmt = (n) => Number(n || 0).toLocaleString("es-CO");

function Barra({ etiqueta, total, max, detalle }) {
  return (
    <li>
      <div className="flex justify-between gap-2 text-xs text-white/85 mb-0.5">
        <span className="truncate pr-2">{etiqueta}</span>
        <span className="tabular-nums font-semibold">
          {fmt(total)}
          {detalle && <span className="text-white/50 font-normal"> · {detalle}</span>}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-xuma-green-dark"
          style={{ width: `${Math.max((total / max) * 100, 4)}%` }}
        />
      </div>
    </li>
  );
}

function Tarjeta({ titulo, children, derecha }) {
  return (
    <section className="glass rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-extrabold text-white uppercase tracking-wide">{titulo}</h2>
        {derecha}
      </div>
      {children}
    </section>
  );
}

export default function MiAnalisisAuditoria({ analisis, mesNombre, sinRevisiones }) {
  if (sinRevisiones) {
    return (
      <div className="glass rounded-2xl p-6 text-center space-y-2">
        <p className="text-lg font-extrabold text-white">Sin cancelaciones auditadas en {mesNombre} 🎉</p>
        <p className="text-sm text-white/70 max-w-xl mx-auto">
          Ninguno de tus audios del mes quedó con cancelación en la revisión de auditoría.
          Sigue aplicando el guion tal como lo vienes haciendo.
        </p>
      </div>
    );
  }
  if (!analisis) return null;

  const { total_revisadas, fallas_audio, solo_audio, criterios, aspectos, recomendaciones, fortalezas } = analisis;
  const maxCrit = Math.max(...criterios.map((c) => c.total), 1);
  const deGestion = total_revisadas - solo_audio - (analisis.administrativas || 0) - (analisis.sin_clasificar || 0);

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div className="glass rounded-2xl p-4">
        <div className="text-[11px] uppercase tracking-wide text-white/70">Mi auditoría · {mesNombre}</div>
        <div className="flex flex-wrap gap-x-6 gap-y-1 mt-1 items-baseline">
          <span className="text-2xl font-extrabold text-white tabular-nums">{fmt(total_revisadas)}</span>
          <span className="text-xs text-white/70">audios auditados con cancelación</span>
          <span className="rounded-full px-2 py-0.5 text-[11px] border border-sky-300/50 text-sky-200">
            {fmt(fallas_audio)} con falla técnica de audio
          </span>
          <span className="rounded-full px-2 py-0.5 text-[11px] bg-white/10 text-white/85">
            {fmt(Math.max(deGestion, 0))} con hallazgo de gestión
          </span>
        </div>
        <p className="text-xs text-white/60 mt-2">
          Este análisis reúne la retroalimentación de auditoría interna sobre todos tus audios del mes.
          No busca señalar casos puntuales: te muestra dónde concentrar tu mejora. Las fluctuaciones de
          audio se cuentan aparte porque no dependen de tu gestión, aunque sí afectan la venta.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Tarjeta titulo="Dónde se concentraron los hallazgos">
          {criterios.length === 0 ? (
            <p className="text-xs text-white/65">Sin hallazgos ubicados en el guion.</p>
          ) : (
            <ul className="space-y-2">
              {criterios.map((c) => (
                <Barra
                  key={c.id}
                  etiqueta={c.nombre}
                  total={c.total}
                  max={maxCrit}
                  detalle={c.con_audio > 0 ? `${fmt(c.con_audio)} por audio` : null}
                />
              ))}
            </ul>
          )}
          {aspectos.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {aspectos.map((a) => (
                <span key={a.id} className="rounded-full px-2 py-0.5 text-[11px] bg-white/10 text-white/85">
                  {a.nombre} · {fmt(a.total)}
                </span>
              ))}
            </div>
          )}
        </Tarjeta>

        <Tarjeta titulo="En qué enfocar tu mejora">
          {recomendaciones.length === 0 ? (
            <p className="text-xs text-white/65">
              Tus hallazgos se explican por fallas técnicas de audio: revisa diadema y conexión, y si una
              frase clave se entrecorta, repítela completa.
            </p>
          ) : (
            <ol className="space-y-2.5">
              {recomendaciones.map((r, i) => (
                <li key={r.tema} className="flex gap-2.5 text-xs text-white/90">
                  <span className="flex-none w-5 h-5 rounded-full bg-xuma-green-dark text-xuma-bg-dark font-extrabold text-[11px] grid place-items-center">
                    {i + 1}
                  </span>
                  <div>
                    <span className="font-semibold text-white">{r.tema}</span>
                    <span className="text-white/50"> · {fmt(r.casos)} caso{r.casos === 1 ? "" : "s"}</span>
                    <p className="text-white/80 mt-0.5">{r.texto}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Tarjeta>
      </div>

      {fortalezas.length > 0 && (
        <Tarjeta titulo="Criterios sin hallazgos" derecha={<span className="text-[11px] text-white/60">¡mantenlos así!</span>}>
          <div className="flex flex-wrap gap-1.5">
            {fortalezas.map((f) => (
              <span key={f} className="rounded-full px-2.5 py-1 text-[11px] border border-xuma-green-dark/60 text-xuma-green-dark font-semibold">
                ✓ {f}
              </span>
            ))}
          </div>
        </Tarjeta>
      )}
    </div>
  );
}
