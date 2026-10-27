import { useMemo, useState } from "react";
import { guardarAuditoria } from "../../services/comoVamos";
import { fmtDia, fmtPct } from "../../utils/formato";
import { diasEfectivos, sugerenciasAuditoria } from "../../utils/sugerenciasAuditoria";
import { CierreAuditoria, ETIQUETA_RESULTADO, HistorialAuditorias, INPUT, Seccion, hace } from "./AuditoriaComun";

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

const ESTILO_SUGERENCIA = {
  bien: { icono: "▲", clase: "text-xuma-green-dark" },
  alerta: { icono: "⚠", clase: "text-amber-300" },
  info: { icono: "ℹ", clase: "text-sky-300" },
};

/** Auditoría COMERCIAL de un asesor (coordinación comercial): desempeño, meta,
 * días laborados y novedades. Las cancelaciones las revisa la auditoría interna;
 * aquí solo se muestra un resumen de lo que esa auditoría validó. */
export default function PanelAuditoria({ datos, asesor, periodo, fechaCorte, auditorias, historialListo, errorHistorial, recargar }) {
  const resumen = datos.resumen;
  const cal = datos.calendario;
  const ventas = useMemo(
    () => (datos.detalle_dia_dia || []).map((v) => ({ fecha_venta: v.fecha_venta, producto: v.producto, estado: v.estado })),
    [datos]
  );
  const propias = useMemo(() => auditorias.filter((a) => a.tipo === "comercial"), [auditorias]);
  const internaReciente = useMemo(() => auditorias.find((a) => a.tipo === "interna"), [auditorias]);

  const items = useMemo(() => {
    const base = [
      { id: "meta", label: "Meta cargada y correcta" },
      { id: "ventas", label: "Ventas del tablero coinciden con la base" },
      { id: "dias", label: "Días laborados revisados" },
    ];
    if (datos.otrosi) base.push({ id: "otrosi", label: `Estado frente al ${fmtPct(datos.otrosi.pct_minimo_comision)} del otrosí` });
    return base;
  }, [datos.otrosi]);

  const [marcas, setMarcas] = useState(() => ({ meta: Boolean(resumen && resumen.meta_mes > 0) }));
  const [resultado, setResultado] = useState(null);
  const [observaciones, setObservaciones] = useState("");
  const [diasAj, setDiasAj] = useState(null);
  const [fechasNo, setFechasNo] = useState([]);
  const [fechaNueva, setFechaNueva] = useState("");
  const [motivoDias, setMotivoDias] = useState("");
  const [novedades, setNovedades] = useState([]);
  const [nueva, setNueva] = useState({ tipo: TIPOS_NOVEDAD[0], desde: "", hasta: "", nota: "", afecto_ventas: false });
  const [formNovedad, setFormNovedad] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState(null);

  const audioValidadas = internaReciente?.canceladas_audio?.length ?? 0;
  const sugerencias = useMemo(
    () =>
      sugerenciasAuditoria({
        resumen, ventas, calendario: cal, otrosi: datos.otrosi, equipoRef: datos.equipo_ref,
        fechaCorte, diasAjustados: diasAj, fechasNoLaboradas: fechasNo, audioMarcadas: audioValidadas,
      }),
    [resumen, ventas, cal, datos.otrosi, datos.equipo_ref, fechaCorte, diasAj, fechasNo, audioValidadas]
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

  const totalCanceladas = ventas.filter((v) => v.estado === "CANCELADA").length;

  async function guardar() {
    setGuardando(true);
    setAviso(null);
    try {
      const diasCal = cal.dias_laborados;
      await guardarAuditoria({
        tipo: "comercial",
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
      await recargar();
    } catch (e) {
      setAviso({ ok: false, texto: e.message });
    } finally {
      setGuardando(false);
    }
  }

  const ultima = propias[0];
  const dias = diasEfectivos(cal, diasAj);

  return (
    <aside className="glass rounded-2xl p-4 space-y-4" aria-label={`Auditoría comercial de ${asesor}`}>
      <div>
        <div className="text-[11px] uppercase tracking-wide text-white/70">Auditoría comercial · corte al {fechaCorte}</div>
        <div className="text-base font-extrabold text-white leading-tight">{asesor}</div>
        <div className="text-[11px] text-white/65 mt-0.5">
          {!historialListo
            ? errorHistorial || "Consultando historial…"
            : ultima
            ? `Última auditoría comercial ${hace(ultima.creado_en)} (${ETIQUETA_RESULTADO[ultima.resultado].toLowerCase()}).`
            : "Sin auditoría comercial este mes."}
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
        <select value={motivoDias} onChange={(e) => setMotivoDias(e.target.value)} className={INPUT} aria-label="Motivo del ajuste">
          <option value="">Motivo…</option>
          {MOTIVOS_DIAS.map((m) => <option key={m}>{m}</option>)}
        </select>
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
          <p className="text-[11px] text-amber-200">Ajuste solo para esta auditoría: el Como vamos del asesor no cambia.</p>
        )}
      </Seccion>

      <Seccion titulo="Cancelaciones (lo ve la auditoría interna)">
        <p className="text-xs text-white/80">
          {totalCanceladas === 0
            ? "Sin cancelaciones."
            : `${totalCanceladas} cancelada${totalCanceladas === 1 ? "" : "s"} en el tablero.`}
          {internaReciente
            ? ` Auditoría interna (${ETIQUETA_RESULTADO[internaReciente.resultado].toLowerCase()}, ${hace(internaReciente.creado_en)}): ${audioValidadas} validada${audioValidadas === 1 ? "" : "s"} como falla de audio.`
            : " Aún sin auditoría interna este mes."}
        </p>
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

      <CierreAuditoria
        grupo="comercial"
        observaciones={observaciones} setObservaciones={setObservaciones}
        resultado={resultado} setResultado={setResultado}
        onGuardar={guardar} guardando={guardando} aviso={aviso}
        placeholder="Observaciones y plan de acción con el asesor…"
      />

      <HistorialAuditorias auditorias={propias} titulo="Historial comercial" />
    </aside>
  );
}
