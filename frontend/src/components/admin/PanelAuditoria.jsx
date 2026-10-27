import { useEffect, useMemo, useState } from "react";
import { guardarAuditoria, listarAuditorias } from "../../services/comoVamos";
import { fmtDia, fmtNumero, fmtPct } from "../../utils/formato";
import { diasEfectivos, sugerenciasAuditoria } from "../../utils/sugerenciasAuditoria";

const TIPOS_NOVEDAD = [
  "Falla de audio",
  "Caída del sistema",
  "Incapacidad",
  "Permiso",
  "Capacitación",
  "Cambio de campaña",
  "Otro",
];

const MOTIVOS_DIAS = ["Incapacidad", "Permiso", "Capacitación", "Falla de audio / sistema", "Otro"];

const RESULTADOS = [
  { id: "conforme", label: "Conforme" },
  { id: "con_observaciones", label: "Con observaciones" },
  { id: "requiere_revision", label: "Requiere revisión" },
];

const ETIQUETA_RESULTADO = Object.fromEntries(RESULTADOS.map((r) => [r.id, r.label]));

const ESTILO_SUGERENCIA = {
  bien: { icono: "▲", clase: "text-xuma-green-dark" },
  alerta: { icono: "⚠", clase: "text-amber-300" },
  info: { icono: "ℹ", clase: "text-sky-300" },
};

const ES_AUDIO = /audio|fluctu|falla/i;
const INPUT = "campo w-full text-xs";

function textoObservacion(c) {
  return c.observacion || c.observacion_re_auditoria || c.observaciones_reauditoria || "";
}

function Seccion({ titulo, derecha, children }) {
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

function hace(isoFecha) {
  const dias = Math.floor((Date.now() - new Date(isoFecha).getTime()) / 86400000);
  if (dias <= 0) return "hoy";
  return dias === 1 ? "hace 1 día" : `hace ${dias} días`;
}

/** Panel de auditoría de un asesor (solo Martha). Todo lo que se marca o escribe
 * se guarda en una auditoría nueva; el historial del asesor queda abajo. */
export default function PanelAuditoria({ datos, asesor, periodo, fechaCorte }) {
  const resumen = datos.resumen;
  const cal = datos.calendario;
  const ventas = useMemo(
    () => (datos.detalle_dia_dia || []).map((v) => ({ fecha_venta: v.fecha_venta, producto: v.producto, estado: v.estado })),
    [datos]
  );
  const canceladas = useMemo(() => datos.canceladas_revision || [], [datos]);

  // ---- estado del formulario (se reinicia al cambiar de asesor: ver `key` en VistaAuditoria)
  const items = useMemo(() => {
    const base = [
      { id: "meta", label: "Meta cargada y correcta" },
      { id: "ventas", label: "Ventas del tablero coinciden con la base" },
      { id: "canceladas", label: "Cancelaciones revisadas" },
      { id: "dias", label: "Días laborados revisados" },
    ];
    if (datos.otrosi) base.push({ id: "otrosi", label: `Estado frente al ${fmtPct(datos.otrosi.pct_minimo_comision)} del otrosí` });
    return base;
  }, [datos.otrosi]);

  const [marcas, setMarcas] = useState(() => ({
    meta: Boolean(resumen && resumen.meta_mes > 0),
    canceladas: canceladas.length === 0,
  }));
  const [resultado, setResultado] = useState(null);
  const [observaciones, setObservaciones] = useState("");
  const [diasAj, setDiasAj] = useState(null);
  const [fechasNo, setFechasNo] = useState([]);
  const [fechaNueva, setFechaNueva] = useState("");
  const [motivoDias, setMotivoDias] = useState("");
  const [novedades, setNovedades] = useState([]);
  const [nueva, setNueva] = useState({ tipo: TIPOS_NOVEDAD[0], desde: "", hasta: "", nota: "", afecto_ventas: false });
  const [formNovedad, setFormNovedad] = useState(false);
  const [audio, setAudio] = useState(
    () => new Set(canceladas.filter((c) => ES_AUDIO.test(`${c.causal_gestion || ""} ${textoObservacion(c)}`)).map((c) => c.numero_contrato))
  );
  const [filtroCausal, setFiltroCausal] = useState("");

  const [historial, setHistorial] = useState(null);
  const [errorHistorial, setErrorHistorial] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState(null);

  function cargarHistorial() {
    return listarAuditorias(periodo, asesor)
      .then((r) => {
        setHistorial(r.auditorias);
        setErrorHistorial("");
      })
      .catch((e) => setErrorHistorial(e.message));
  }

  useEffect(() => {
    cargarHistorial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asesor, periodo]);

  const sugerencias = useMemo(
    () =>
      sugerenciasAuditoria({
        resumen, ventas, calendario: cal, otrosi: datos.otrosi, equipoRef: datos.equipo_ref,
        fechaCorte, diasAjustados: diasAj, fechasNoLaboradas: fechasNo, audioMarcadas: audio.size,
      }),
    [resumen, ventas, cal, datos.otrosi, datos.equipo_ref, fechaCorte, diasAj, fechasNo, audio]
  );

  function agregarFechaNoLaborada() {
    if (!fechaNueva || fechasNo.includes(fechaNueva)) return;
    const nuevas = [...fechasNo, fechaNueva].sort();
    setFechasNo(nuevas);
    setDiasAj(Math.max(cal.dias_laborados - nuevas.length, 0));
    setFechaNueva("");
  }

  function quitarFecha(f) {
    const nuevas = fechasNo.filter((x) => x !== f);
    setFechasNo(nuevas);
    setDiasAj(nuevas.length ? Math.max(cal.dias_laborados - nuevas.length, 0) : null);
  }

  function agregarNovedad() {
    if (!nueva.nota.trim() && !nueva.desde) return;
    setNovedades((n) => [...n, { ...nueva, desde: nueva.desde || null, hasta: nueva.hasta || null }]);
    setNueva({ tipo: TIPOS_NOVEDAD[0], desde: "", hasta: "", nota: "", afecto_ventas: false });
    setFormNovedad(false);
  }

  const causales = useMemo(() => {
    const m = new Map();
    for (const c of canceladas) {
      const k = c.causal_gestion || "Sin causal";
      m.set(k, (m.get(k) || 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [canceladas]);
  const canceladasVista = canceladas.filter((c) => !filtroCausal || (c.causal_gestion || "Sin causal") === filtroCausal);
  const totalCanceladasTablero = ventas.filter((v) => v.estado === "CANCELADA").length;

  function alternarAudio(contrato) {
    setAudio((s) => {
      const n = new Set(s);
      if (n.has(contrato)) n.delete(contrato);
      else n.add(contrato);
      return n;
    });
  }

  async function guardar() {
    setGuardando(true);
    setAviso(null);
    try {
      const diasCal = cal.dias_laborados;
      await guardarAuditoria({
        periodo,
        fecha_corte: fechaCorte,
        asesor,
        items: Object.fromEntries(items.map((i) => [i.id, Boolean(marcas[i.id])])),
        resultado,
        observaciones,
        dias_calendario: diasCal,
        dias_ajustados: diasAj != null && diasAj !== diasCal ? diasAj : null,
        fechas_no_laboradas: fechasNo,
        motivo_dias: motivoDias,
        novedades,
        canceladas_audio: [...audio],
        sugerencias: sugerencias.map((s) => s.texto),
        resumen: resumen
          ? {
              meta_mes: resumen.meta_mes,
              acumulado: resumen.acumulado,
              pct_cumpl_acumulado: resumen.pct_cumpl_acumulado,
              forecast: resumen.forecast,
              pct_forecast: resumen.pct_forecast,
            }
          : {},
      });
      setAviso({ ok: true, texto: "Auditoría guardada." });
      setResultado(null);
      setObservaciones("");
      await cargarHistorial();
    } catch (e) {
      setAviso({ ok: false, texto: e.message });
    } finally {
      setGuardando(false);
    }
  }

  const ultima = historial?.[0];
  const dias = diasEfectivos(cal, diasAj);

  return (
    <aside className="glass rounded-2xl p-4 space-y-4" aria-label={`Auditoría de ${asesor}`}>
      <div>
        <div className="text-[11px] uppercase tracking-wide text-white/70">Auditoría · corte al {fechaCorte}</div>
        <div className="text-base font-extrabold text-white leading-tight">{asesor}</div>
        <div className="text-[11px] text-white/65 mt-0.5">
          {historial == null
            ? errorHistorial || "Consultando historial…"
            : ultima
            ? `Última auditoría ${hace(ultima.creado_en)} (${ETIQUETA_RESULTADO[ultima.resultado].toLowerCase()}).`
            : "Sin auditorías este mes."}
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

      <Seccion titulo="Revisión">
        <ul className="space-y-1">
          {items.map((i) => (
            <li key={i.id}>
              <label className="flex items-center gap-2 text-xs text-white/90 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(marcas[i.id])}
                  onChange={(e) => setMarcas((m) => ({ ...m, [i.id]: e.target.checked }))}
                  className="accent-[#00cd93]"
                />
                {i.label}
              </label>
            </li>
          ))}
        </ul>
      </Seccion>

      <Seccion titulo="Días laborados">
        <div className="grid grid-cols-2 gap-2 text-xs text-white/80">
          <div>
            Calendario
            <div className="text-lg font-bold text-white tabular-nums">{cal.dias_laborados}</div>
          </div>
          <label>
            Ajustado
            <input
              type="number"
              min={0}
              max={cal.dias_laborados}
              value={diasAj ?? cal.dias_laborados}
              onChange={(e) => {
                const v = e.target.value === "" ? null : Math.min(Math.max(Number(e.target.value), 0), cal.dias_laborados);
                setDiasAj(v);
              }}
              className={`${INPUT} text-lg font-bold tabular-nums`}
            />
          </label>
        </div>
        <div className="flex gap-2">
          <select value={motivoDias} onChange={(e) => setMotivoDias(e.target.value)} className={INPUT} aria-label="Motivo del ajuste">
            <option value="">Motivo…</option>
            {MOTIVOS_DIAS.map((m) => <option key={m}>{m}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <input type="date" value={fechaNueva} onChange={(e) => setFechaNueva(e.target.value)} className={INPUT} aria-label="Fecha no laborada" />
          <button type="button" onClick={agregarFechaNoLaborada} className="rounded-lg px-3 text-xs font-semibold glass text-white/90 hover:text-white">
            + Día
          </button>
        </div>
        {fechasNo.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {fechasNo.map((f) => (
              <button key={f} type="button" onClick={() => quitarFecha(f)} className="rounded-full px-2 py-0.5 text-[11px] glass text-white/85" title="Quitar">
                {fmtDia(f)} ✕
              </button>
            ))}
          </div>
        )}
        {dias !== cal.dias_laborados && (
          <p className="text-[11px] text-amber-200">
            Ajuste solo para esta auditoría: el Como vamos del asesor no cambia.
          </p>
        )}
      </Seccion>

      <Seccion
        titulo={`Cancelaciones (${totalCanceladasTablero})`}
        derecha={<span className="text-[11px] text-white/60">con revisión cargada: {canceladas.length}</span>}
      >
        {canceladas.length === 0 ? (
          <p className="text-xs text-white/65">
            {totalCanceladasTablero === 0 ? "Sin cancelaciones." : "No hay revisión de canceladas cargada para este asesor."}
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={() => setFiltroCausal("")} className={`rounded-full px-2 py-0.5 text-[11px] ${!filtroCausal ? "bg-xuma-green-dark text-xuma-bg-dark font-semibold" : "glass text-white/80"}`}>
                Todas · {canceladas.length}
              </button>
              {causales.map(([c, n]) => (
                <button key={c} type="button" onClick={() => setFiltroCausal(c)} className={`rounded-full px-2 py-0.5 text-[11px] ${filtroCausal === c ? "bg-xuma-green-dark text-xuma-bg-dark font-semibold" : "glass text-white/80"}`}>
                  {c} · {n}
                </button>
              ))}
            </div>
            <div className="max-h-56 overflow-auto glass rounded-xl">
              <table className="w-full text-[11px] border-collapse">
                <thead>
                  <tr className="tabla-header text-white text-left">
                    <th className="px-2 py-1">Fecha</th>
                    <th className="px-2 py-1">Causal y observación</th>
                    <th className="px-2 py-1">Estado</th>
                    <th className="px-2 py-1 text-center" title="Falla de audio: se reconoce según el otrosí">Audio</th>
                  </tr>
                </thead>
                <tbody>
                  {canceladasVista.map((c) => (
                    <tr key={c.numero_contrato} className="border-t border-white/10 align-top text-white/90">
                      <td className="px-2 py-1 whitespace-nowrap">{c.fecha_venta ? fmtDia(c.fecha_venta) : "—"}</td>
                      <td className="px-2 py-1">
                        <div className="font-semibold">{c.causal_gestion || "Sin causal"}</div>
                        {textoObservacion(c) && <div className="text-white/70">{textoObservacion(c)}</div>}
                      </td>
                      <td className="px-2 py-1">{c.estado_subsanacion || c.resultado_re_auditoria || "—"}</td>
                      <td className="px-2 py-1 text-center">
                        <input
                          type="checkbox"
                          checked={audio.has(c.numero_contrato)}
                          onChange={() => alternarAudio(c.numero_contrato)}
                          aria-label={`Marcar ${c.numero_contrato} como falla de audio`}
                          className="accent-[#00cd93]"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Seccion>

      <Seccion
        titulo={`Novedades (${novedades.length})`}
        derecha={
          <button type="button" onClick={() => setFormNovedad((a) => !a)} className="text-[11px] font-semibold text-xuma-green-dark">
            {formNovedad ? "Cancelar" : "+ Reportar"}
          </button>
        }
      >
        {novedades.map((n, i) => (
          <div key={`${n.tipo}-${i}`} className="flex items-start justify-between gap-2 text-xs text-white/90">
            <span>
              <span className="font-semibold">{n.tipo}</span>
              {n.desde && ` · ${fmtDia(n.desde)}${n.hasta && n.hasta !== n.desde ? ` – ${fmtDia(n.hasta)}` : ""}`}
              {n.afecto_ventas && " · afectó ventas"}
              {n.nota && <span className="text-white/70"> — {n.nota}</span>}
            </span>
            <button type="button" onClick={() => setNovedades((l) => l.filter((_, j) => j !== i))} className="text-white/50 hover:text-white" aria-label="Quitar novedad">✕</button>
          </div>
        ))}
        {formNovedad && (
          <div className="space-y-2 rounded-xl border border-white/15 p-2">
            <select value={nueva.tipo} onChange={(e) => setNueva({ ...nueva, tipo: e.target.value })} className={INPUT}>
              {TIPOS_NOVEDAD.map((t) => <option key={t}>{t}</option>)}
            </select>
            <div className="flex gap-2">
              <input type="date" value={nueva.desde} onChange={(e) => setNueva({ ...nueva, desde: e.target.value })} className={INPUT} aria-label="Desde" />
              <input type="date" value={nueva.hasta} onChange={(e) => setNueva({ ...nueva, hasta: e.target.value })} className={INPUT} aria-label="Hasta" />
            </div>
            <textarea value={nueva.nota} onChange={(e) => setNueva({ ...nueva, nota: e.target.value })} rows={2} maxLength={1000} placeholder="¿Qué pasó?" className={INPUT} />
            <label className="flex items-center gap-2 text-xs text-white/85">
              <input type="checkbox" checked={nueva.afecto_ventas} onChange={(e) => setNueva({ ...nueva, afecto_ventas: e.target.checked })} className="accent-[#00cd93]" />
              Afectó las ventas
            </label>
            <button type="button" onClick={agregarNovedad} className="rounded-lg px-3 py-1 text-xs font-bold bg-xuma-green-dark text-xuma-bg-dark">
              Agregar novedad
            </button>
          </div>
        )}
      </Seccion>

      <Seccion titulo="Cierre de la auditoría">
        <textarea
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
          rows={3}
          maxLength={4000}
          placeholder="Observaciones de la auditoría…"
          className={INPUT}
        />
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {RESULTADOS.map((r) => (
            <label key={r.id} className="flex items-center gap-1.5 text-xs text-white/90 cursor-pointer">
              <input type="radio" name="resultado-auditoria" checked={resultado === r.id} onChange={() => setResultado(r.id)} className="accent-[#00cd93]" />
              {r.label}
            </label>
          ))}
        </div>
        <button
          type="button"
          onClick={guardar}
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

      <details className="text-xs text-white/85">
        <summary className="cursor-pointer font-semibold">Historial ({historial?.length ?? 0})</summary>
        <ul className="mt-2 space-y-2">
          {(historial || []).map((h) => (
            <li key={h.id} className="rounded-lg border border-white/10 p-2">
              <div className="flex justify-between gap-2">
                <span className="font-semibold">{ETIQUETA_RESULTADO[h.resultado]}</span>
                <span className="text-white/60">{new Date(h.creado_en).toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "numeric", minute: "2-digit" })}</span>
              </div>
              <div className="text-white/65">
                Corte {h.fecha_corte}
                {h.auditor_nombre ? ` · ${h.auditor_nombre}` : ""}
                {h.resumen?.acumulado != null ? ` · ${fmtNumero(h.resumen.acumulado)} ventas` : ""}
                {h.dias_ajustados != null ? ` · días ajustados: ${h.dias_ajustados}/${h.dias_calendario}` : ""}
              </div>
              {h.observaciones && <p className="mt-1 text-white/80">{h.observaciones}</p>}
              {h.novedades?.length > 0 && <p className="mt-1 text-white/70">Novedades: {h.novedades.map((n) => n.tipo).join(", ")}</p>}
            </li>
          ))}
        </ul>
      </details>
    </aside>
  );
}
