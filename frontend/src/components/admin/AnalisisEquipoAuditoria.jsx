import { useEffect, useState } from "react";
import { obtenerAnalisisCanceladas } from "../../services/comoVamos";
import CumplimientoProductos from "../CumplimientoProductos";
import { fmtPct } from "../../utils/formato";

/** Vista general del análisis de auditoría (Martha / Kevin): todo el equipo
 * contra los criterios del guion. Arriba el pulso del mes, al medio dónde se
 * concentran los hallazgos del equipo, abajo el detalle por asesor con su
 * retroalimentación (la misma que ve cada asesor en su pestaña). */

const fmt = (n) => Number(n || 0).toLocaleString("es-CO");

function Kpi({ etiqueta, valor, acento }) {
  return (
    <div className="glass rounded-2xl px-4 py-3">
      <div className={`text-2xl font-extrabold tabular-nums ${acento || "text-white"}`}>{fmt(valor)}</div>
      <div className="text-[11px] uppercase tracking-wide text-white/65 mt-0.5">{etiqueta}</div>
    </div>
  );
}

function Barras({ items, max, conAudio = false }) {
  return (
    <ul className="space-y-2">
      {items.map((c) => (
        <li key={c.id}>
          <div className="flex justify-between gap-2 text-xs text-white/85 mb-0.5">
            <span className="truncate pr-2">{c.nombre}</span>
            <span className="tabular-nums font-semibold">
              {fmt(c.total)}
              {conAudio && c.con_audio > 0 && (
                <span className="text-white/50 font-normal"> · {fmt(c.con_audio)} por audio</span>
              )}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-xuma-green-dark transition-[width] duration-300"
              style={{ width: `${Math.max((c.total / max) * 100, 3)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function ChipsProductos({ productos }) {
  if (!productos?.length) return null;
  return (
    <>
      {productos.map((p) =>
        p.pendiente ? (
          <span key={p.producto} className="rounded-full px-2 py-0.5 border border-white/20 text-white/50 tabular-nums">
            {p.producto} pendiente
          </span>
        ) : (
          <span
            key={p.producto}
            className={`rounded-full px-2 py-0.5 border tabular-nums ${
              p.pct_global >= 0.95
                ? "border-xuma-green-dark/60 text-xuma-green-dark"
                : p.pct_global >= 0.85
                ? "border-amber-300/50 text-amber-300"
                : "border-red-300/60 text-red-300"
            }`}
            title={`${p.nombre}: cumplimiento del guion sobre ${fmt(p.total_audios)} ventas auditadas`}
          >
            {p.producto} {fmtPct(p.pct_global)}
          </span>
        )
      )}
    </>
  );
}

function FilaAsesor({ a }) {
  const maxCrit = Math.max(...a.criterios.map((c) => c.total), 1);
  if (a.total_revisadas === 0) {
    return (
      <details className="rounded-xl border border-white/10 open:bg-white/5 transition-colors">
        <summary className="cursor-pointer px-3 py-2 flex items-center justify-between gap-3 text-sm text-white">
          <span className="font-semibold truncate">{a.asesor}</span>
          <span className="flex items-center gap-2 flex-none text-[11px] flex-wrap justify-end">
            <span className="rounded-full px-2 py-0.5 border border-xuma-green-dark/60 text-xuma-green-dark">
              ✓ sin canceladas auditadas
            </span>
            <ChipsProductos productos={a.productos} />
          </span>
        </summary>
        <p className="px-3 pb-3 pt-1 text-xs text-white/75">
          Ninguna de sus ventas del mes quedó con cancelación en la revisión: cumplió los criterios
          del guion en todas sus ventas auditadas.
        </p>
      </details>
    );
  }
  return (
    <details className="rounded-xl border border-white/10 open:bg-white/5 transition-colors">
      <summary className="cursor-pointer px-3 py-2 flex items-center justify-between gap-3 text-sm text-white">
        <span className="font-semibold truncate">{a.asesor}</span>
        <span className="flex items-center gap-2 flex-none text-[11px] flex-wrap justify-end">
          <span className="rounded-full px-2 py-0.5 bg-white/10 text-white/85 tabular-nums">
            {fmt(a.total_revisadas)} audio{a.total_revisadas === 1 ? "" : "s"}
          </span>
          <span className="rounded-full px-2 py-0.5 border border-sky-300/50 text-sky-200 tabular-nums">
            {fmt(a.fallas_audio)} audio técnico
          </span>
          <span className="rounded-full px-2 py-0.5 border border-amber-300/50 text-amber-300 tabular-nums">
            {fmt(Math.max(a.con_gestion, 0))} gestión
          </span>
          <ChipsProductos productos={a.productos} />
        </span>
      </summary>
      <div className="px-3 pb-3 pt-1 grid gap-4 md:grid-cols-2">
        <div>
          <h4 className="text-[11px] uppercase tracking-wide text-white/60 mb-2">Hallazgos por criterio</h4>
          {a.criterios.length === 0 ? (
            <p className="text-xs text-white/65">Sin hallazgos ubicados en el guion.</p>
          ) : (
            <Barras items={a.criterios} max={maxCrit} conAudio />
          )}
          {a.aspectos.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {a.aspectos.map((s) => (
                <span key={s.id} className="rounded-full px-2 py-0.5 text-[11px] bg-white/10 text-white/85">
                  {s.nombre} · {fmt(s.total)}
                </span>
              ))}
            </div>
          )}
        </div>
        <div>
          <h4 className="text-[11px] uppercase tracking-wide text-white/60 mb-2">Retroalimentación sugerida</h4>
          {a.recomendaciones.length === 0 ? (
            <p className="text-xs text-white/65">
              Sus hallazgos se explican por fallas técnicas de audio.
            </p>
          ) : (
            <ol className="space-y-1.5 text-xs text-white/85 list-decimal list-inside">
              {a.recomendaciones.map((r) => (
                <li key={r.tema}>
                  <span className="font-semibold text-white">{r.tema}</span>
                  <span className="text-white/50"> ({fmt(r.casos)})</span>: {r.texto}
                </li>
              ))}
            </ol>
          )}
          {a.fortalezas.length > 0 && (
            <p className="text-[11px] text-xuma-green-dark mt-2">
              ✓ Sin hallazgos en: {a.fortalezas.join(", ")}.
            </p>
          )}
        </div>
      </div>
    </details>
  );
}

export default function AnalisisEquipoAuditoria({ periodo }) {
  const [estado, setEstado] = useState({ cargando: true, error: null, data: null });

  useEffect(() => {
    let vivo = true;
    setEstado({ cargando: true, error: null, data: null });
    obtenerAnalisisCanceladas(periodo)
      .then((d) => vivo && setEstado({ cargando: false, error: null, data: d }))
      .catch((e) => vivo && setEstado({ cargando: false, error: e.message, data: null }));
    return () => { vivo = false; };
  }, [periodo]);

  if (estado.cargando) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Cargando análisis de auditoría">
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className="glass rounded-2xl h-[72px] animate-pulse" />)}
        </div>
        <div className="glass rounded-2xl h-56 animate-pulse" />
        <div className="glass rounded-2xl h-72 animate-pulse" />
      </div>
    );
  }
  if (estado.error) {
    return (
      <div className="glass rounded-2xl p-4 text-sm text-white">
        <p className="text-red-300 font-semibold">No se pudo cargar el análisis de auditoría.</p>
        <p className="text-white/70 mt-1">{estado.error}</p>
      </div>
    );
  }
  const data = estado.data;
  if (!data?.disponible) {
    return (
      <div className="glass rounded-2xl p-6 text-center text-sm text-white/75">
        Aún no hay canceladas revisadas cargadas para este mes. El análisis se activa
        solo cuando auditoría interna carga su revisión.
      </div>
    );
  }

  const eq = data.equipo;
  const maxCrit = Math.max(...eq.criterios.map((c) => c.total), 1);
  const conGestion = data.detalle_asesores.reduce((s, a) => s + Math.max(a.con_gestion, 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Kpi etiqueta="Audios auditados con cancelación" valor={eq.total_revisadas} />
        <Kpi etiqueta="Asesores con revisión" valor={eq.asesores} />
        <Kpi etiqueta="Con falla técnica de audio" valor={eq.fallas_audio} acento="text-sky-200" />
        <Kpi etiqueta="Con hallazgo de gestión" valor={conGestion} acento="text-amber-300" />
      </div>

      <CumplimientoProductos
        productos={eq.productos}
        titulo="Cumplimiento del guion por producto · equipo"
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="glass rounded-2xl p-4 space-y-3">
          <h3 className="text-sm font-extrabold text-white uppercase tracking-wide">
            Criterios del guion · equipo
          </h3>
          <Barras items={eq.criterios} max={maxCrit} />
          <p className="text-[11px] text-white/50">
            Un mismo audio puede tocar varios criterios; «por audio» significa que el hallazgo en ese
            tramo fue una fluctuación o intermitencia técnica, no un incumplimiento del asesor.
          </p>
        </section>
        <section className="glass rounded-2xl p-4 space-y-3">
          <h3 className="text-sm font-extrabold text-white uppercase tracking-wide">
            Aspectos de gestión · equipo
          </h3>
          {eq.aspectos.length === 0 ? (
            <p className="text-xs text-white/65">Sin hallazgos de gestión este mes.</p>
          ) : (
            <Barras items={eq.aspectos} max={Math.max(...eq.aspectos.map((a) => a.total), 1)} />
          )}
          <p className="text-[11px] text-white/50">
            Esto es lo que cada asesor sí controla: es el insumo para la retroalimentación individual.
          </p>
        </section>
      </div>

      <section className="space-y-1.5" aria-label="Detalle por asesor">
        <h3 className="text-sm font-extrabold text-white uppercase tracking-wide px-1 pb-1">
          Detalle por asesor
        </h3>
        {data.detalle_asesores.map((a) => <FilaAsesor key={a.asesor} a={a} />)}
      </section>
    </div>
  );
}
