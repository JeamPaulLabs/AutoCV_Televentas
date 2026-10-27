import { useMemo, useState } from "react";
import { guardarAuditoria } from "../../services/comoVamos";
import { fmtDia, fmtNumero } from "../../utils/formato";
import { productoCorto, sugerenciasInterna } from "../../utils/sugerenciasAuditoria";
import {
  CierreAuditoria, ETIQUETA_RESULTADO, EVENTUALIDADES, HistorialAuditorias, INPUT, ITEMS_INTERNA, Seccion, hace,
} from "./AuditoriaComun";

const ES_AUDIO = /audio|fluctu|falla/i;
const ESTILO_SUGERENCIA = {
  bien: { icono: "▲", clase: "text-xuma-green-dark" },
  alerta: { icono: "⚠", clase: "text-amber-300" },
  info: { icono: "ℹ", clase: "text-sky-300" },
};

const textoObservacion = (c) => c.observacion || c.observacion_re_auditoria || c.observaciones_reauditoria || "";

function Tarjeta({ c, eventualidad, onEventualidad }) {
  const [abierta, setAbierta] = useState(false);
  const obs = textoObservacion(c);
  const larga = obs.length > 110;
  return (
    <li className="rounded-lg bg-white/5 px-2.5 py-2 space-y-1">
      <div className="flex items-center justify-between gap-2 text-[11px] text-white/70">
        <span>
          {c.fecha_venta ? fmtDia(c.fecha_venta) : "—"} · {productoCorto(c.producto)}
        </span>
        <span className="rounded-full px-2 py-0.5 bg-white/10 text-white/85">
          {c.estado_subsanacion || c.resultado_re_auditoria || c.gestion_supervisor_tmk || "Sin gestión"}
        </span>
      </div>
      {obs && (
        <p className={`text-xs text-white/90 ${abierta ? "" : "line-clamp-2"}`}>
          {obs}
          {larga && (
            <button type="button" onClick={() => setAbierta((a) => !a)} className="ml-1 text-xuma-green-dark font-semibold">
              {abierta ? "ver menos" : "ver completo"}
            </button>
          )}
        </p>
      )}
      <select
        value={eventualidad || ""}
        onChange={(e) => onEventualidad(e.target.value)}
        className="campo w-full text-[11px] py-1"
        aria-label="Eventualidad de la cancelación"
      >
        <option value="">Eventualidad: sin asignar</option>
        {EVENTUALIDADES.map((ev) => <option key={ev}>{ev}</option>)}
      </select>
    </li>
  );
}

/** Auditoría INTERNA de un asesor (auditoría de calidad): cancelaciones, causales,
 * subsanación y las eventualidades que las explican. Presentación en capas: un
 * resumen arriba y el detalle por causal que se despliega solo al abrirlo. */
export default function PanelInterna({ datos, asesor, periodo, fechaCorte, auditorias, historialListo, errorHistorial, recargar }) {
  const canceladas = useMemo(() => datos.canceladas_revision || [], [datos]);
  const ventas = datos.detalle_dia_dia || [];
  const totalCanceladas = ventas.filter((v) => v.estado === "CANCELADA").length;
  const propias = useMemo(() => auditorias.filter((a) => a.tipo === "interna"), [auditorias]);

  const [eventualidades, setEventualidades] = useState(() =>
    Object.fromEntries(
      canceladas
        .filter((c) => ES_AUDIO.test(`${c.causal_gestion || ""} ${textoObservacion(c)}`))
        .map((c) => [c.numero_contrato, "Falla de audio"])
    )
  );
  const [marcas, setMarcas] = useState({});
  const [resultado, setResultado] = useState(null);
  const [observaciones, setObservaciones] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState(null);

  const porCausal = useMemo(() => {
    const m = new Map();
    for (const c of canceladas) {
      const k = c.causal_gestion || "Sin causal";
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(c);
    }
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [canceladas]);
  const maxCausal = Math.max(...porCausal.map(([, l]) => l.length), 1);

  const porEstado = useMemo(() => {
    const m = new Map();
    for (const c of canceladas) {
      const k = c.estado_subsanacion || c.resultado_re_auditoria || "Sin gestión";
      m.set(k, (m.get(k) || 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [canceladas]);

  const conteoEvent = useMemo(() => {
    const m = {};
    for (const e of Object.values(eventualidades)) if (e) m[e] = (m[e] || 0) + 1;
    return m;
  }, [eventualidades]);

  const sugerencias = useMemo(
    () => sugerenciasInterna({ canceladas, totalCanceladasTablero: totalCanceladas, totalVentas: ventas.length, eventualidades }),
    [canceladas, totalCanceladas, ventas.length, eventualidades]
  );

  function asignar(contrato, valor) {
    setEventualidades((prev) => {
      const n = { ...prev };
      if (valor) n[contrato] = valor;
      else delete n[contrato];
      return n;
    });
  }

  async function guardar() {
    setGuardando(true);
    setAviso(null);
    try {
      const resumen = datos.resumen;
      await guardarAuditoria({
        tipo: "interna",
        periodo,
        fecha_corte: fechaCorte,
        asesor,
        items: Object.fromEntries(Object.keys(ITEMS_INTERNA).map((k) => [k, Boolean(marcas[k])])),
        resultado,
        observaciones,
        canceladas_audio: Object.entries(eventualidades).filter(([, e]) => e === "Falla de audio").map(([c]) => c),
        eventualidades,
        sugerencias: sugerencias.map((s) => s.texto),
        resumen: {
          canceladas_tablero: totalCanceladas,
          canceladas_revision: canceladas.length,
          acumulado: resumen?.acumulado,
          meta_mes: resumen?.meta_mes,
        },
      });
      setAviso({ ok: true, texto: "Auditoría guardada." });
      setResultado(null);
      setObservaciones("");
      await recargar();
    } catch (e) {
      setAviso({ ok: false, texto: e.message });
    } finally {
      setGuardando(false);
    }
  }

  const ultima = propias[0];

  return (
    <aside className="glass rounded-2xl p-4 space-y-4" aria-label={`Auditoría interna de ${asesor}`}>
      <div>
        <div className="text-[11px] uppercase tracking-wide text-white/70">Auditoría interna · corte al {fechaCorte}</div>
        <div className="text-base font-extrabold text-white leading-tight">{asesor}</div>
        <div className="text-[11px] text-white/65 mt-0.5">
          {!historialListo
            ? errorHistorial || "Consultando historial…"
            : ultima
            ? `Última auditoría interna ${hace(ultima.creado_en)} (${ETIQUETA_RESULTADO[ultima.resultado].toLowerCase()}).`
            : "Sin auditoría interna este mes."}
        </div>
      </div>

      <Seccion titulo={`Sugerencias automáticas (${sugerencias.length})`}>
        <ul className="space-y-1.5 text-xs text-white/90">
          {sugerencias.map((s) => {
            const e = ESTILO_SUGERENCIA[s.tipo];
            return (
              <li key={s.texto} className="flex gap-2">
                <span className={`${e.clase} flex-none`} aria-hidden="true">{e.icono}</span>
                {s.texto}
              </li>
            );
          })}
        </ul>
      </Seccion>

      <Seccion titulo={`Cancelaciones (${totalCanceladas})`} derecha={<span className="text-[11px] text-white/60">con revisión: {canceladas.length}</span>}>
        {canceladas.length === 0 ? (
          <p className="text-xs text-white/65">
            {totalCanceladas === 0 ? "Sin cancelaciones." : "No hay revisión de canceladas cargada para este asesor."}
          </p>
        ) : (
          <>
            {/* Capa 1: lectura rápida */}
            <ul className="space-y-1.5">
              {porCausal.slice(0, 4).map(([causal, lista]) => (
                <li key={causal}>
                  <div className="flex justify-between text-[11px] text-white/85 mb-0.5">
                    <span className="truncate pr-2">{causal}</span>
                    <span className="tabular-nums font-semibold">{lista.length}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full rounded-full bg-xuma-green-dark" style={{ width: `${(lista.length / maxCausal) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-1.5">
              {porEstado.map(([e, n]) => (
                <span key={e} className="rounded-full px-2 py-0.5 text-[11px] bg-white/10 text-white/85">{e} · {n}</span>
              ))}
              {Object.entries(conteoEvent).map(([e, n]) => (
                <span key={e} className="rounded-full px-2 py-0.5 text-[11px] border border-sky-300/50 text-sky-200">{e} · {n}</span>
              ))}
            </div>

            {/* Capa 2: detalle por causal, cerrado por defecto */}
            <div className="space-y-1.5">
              {porCausal.map(([causal, lista]) => (
                <details key={causal} className="rounded-xl border border-white/10">
                  <summary className="cursor-pointer px-3 py-1.5 text-xs font-semibold text-white flex justify-between gap-2">
                    <span className="truncate">{causal}</span>
                    <span className="tabular-nums text-white/70">{lista.length}</span>
                  </summary>
                  <ul className="p-2 space-y-1.5 max-h-72 overflow-auto">
                    {lista.map((c) => (
                      <Tarjeta key={c.numero_contrato} c={c} eventualidad={eventualidades[c.numero_contrato]} onEventualidad={(v) => asignar(c.numero_contrato, v)} />
                    ))}
                  </ul>
                </details>
              ))}
            </div>
          </>
        )}
      </Seccion>

      <Seccion titulo="Revisión">
        <ul className="space-y-1">
          {Object.entries(ITEMS_INTERNA).map(([id, label]) => (
            <li key={id}>
              <label className="flex items-center gap-2 text-xs text-white/90 cursor-pointer">
                <input type="checkbox" checked={Boolean(marcas[id])} onChange={(e) => setMarcas((m) => ({ ...m, [id]: e.target.checked }))} className="accent-[#00cd93]" />
                {label}
              </label>
            </li>
          ))}
        </ul>
        {Object.keys(conteoEvent).length === 0 && canceladas.length > 0 && (
          <p className="text-[11px] text-white/60">Asigna eventualidades dentro de cada causal para explicar qué pasó.</p>
        )}
      </Seccion>

      <CierreAuditoria
        grupo="interna"
        observaciones={observaciones} setObservaciones={setObservaciones}
        resultado={resultado} setResultado={setResultado}
        onGuardar={guardar} guardando={guardando} aviso={aviso}
        placeholder={`Hallazgos de la auditoría interna (${fmtNumero(canceladas.length)} canceladas revisadas)…`}
      />

      <HistorialAuditorias auditorias={propias} titulo="Historial interno" />
    </aside>
  );
}
