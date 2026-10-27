import { useCallback, useEffect, useMemo, useState } from "react";
import { listarAuditorias, obtenerDashboard } from "../../services/comoVamos";
import MiResumenAsesor from "../MiResumenAsesor";
import { AuditoriaSoloLectura, ROL_NOMBRE } from "./AuditoriaComun";
import PanelAuditoria from "./PanelAuditoria";
import PanelInterna from "./PanelInterna";
import SeguimientoAuditoria from "./SeguimientoAuditoria";

/** Pestaña "Auditoría": se elige un asesor, se ve su Como vamos tal como lo ve
 * él y, al lado, la auditoría Comercial (coordinación) o Interna (calidad). Quien
 * tiene el rol la edita; la del otro rol se ve en solo lectura. El seguimiento
 * es un hilo compartido. */
export default function VistaAuditoria({ data }) {
  const periodo = data.periodo.slice(0, 7);
  const roles = data.roles_auditoria?.length ? data.roles_auditoria : ["comercial"];
  const asesores = useMemo(
    () => [...new Set(data.asesores.map((a) => a.asesor))].sort((a, b) => a.localeCompare(b, "es")),
    [data.asesores]
  );
  const [asesor, setAsesor] = useState("");
  const [tipo, setTipo] = useState(roles[0]);
  const [estado, setEstado] = useState({ cargando: false, error: "", datos: null });
  const [hist, setHist] = useState({ listo: false, error: "", auditorias: [] });

  useEffect(() => {
    if (!asesor) return undefined;
    let vivo = true;
    setEstado({ cargando: true, error: "", datos: null });
    obtenerDashboard(periodo, data.fecha_corte, "personal", asesor)
      .then((datos) => vivo && setEstado({ cargando: false, error: "", datos }))
      .catch((e) => vivo && setEstado({ cargando: false, error: e.message, datos: null }));
    return () => {
      vivo = false;
    };
  }, [asesor, periodo, data.fecha_corte]);

  const cargarHistorial = useCallback(() => {
    if (!asesor) return Promise.resolve();
    return listarAuditorias(periodo, asesor)
      .then((r) => setHist({ listo: true, error: "", auditorias: r.auditorias }))
      .catch((e) => setHist({ listo: false, error: e.message, auditorias: [] }));
  }, [asesor, periodo]);

  useEffect(() => {
    setHist({ listo: false, error: "", auditorias: [] });
    cargarHistorial();
  }, [cargarHistorial]);

  const { cargando, error, datos } = estado;
  const puedeEditar = roles.includes(tipo);
  const propsPanel = {
    datos, asesor, periodo, fechaCorte: datos?.fecha_corte,
    auditorias: hist.auditorias, historialListo: hist.listo, errorHistorial: hist.error, recargar: cargarHistorial,
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <label htmlFor="selector-asesor" className="text-xs uppercase tracking-wide text-white/70">
          Asesor a auditar
        </label>
        <select id="selector-asesor" value={asesor} onChange={(e) => setAsesor(e.target.value)} className="campo text-sm min-w-[280px]">
          <option value="">Selecciona un asesor…</option>
          {asesores.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        {cargando && <span className="text-xs text-white/60">Cargando…</span>}

        <div className="glass rounded-full p-1 flex gap-1 ml-auto" role="tablist" aria-label="Tipo de auditoría">
          {["comercial", "interna"].map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tipo === t}
              onClick={() => setTipo(t)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors duration-200 ${
                tipo === t ? "bg-xuma-green-dark text-xuma-bg-dark" : "text-white/70 hover:text-white"
              }`}
            >
              {ROL_NOMBRE[t]}
              {!roles.includes(t) && <span className="opacity-70"> · lectura</span>}
            </button>
          ))}
        </div>
      </div>

      {!asesor && (
        <div className="glass rounded-2xl px-4 py-6 text-sm text-white/70">
          Elige un asesor para ver su Como vamos y auditarlo. La auditoría comercial la hace la coordinación comercial y la
          interna, el auditor de calidad; ambas se ven aquí.
        </div>
      )}
      {error && <div className="glass rounded-2xl px-4 py-4 text-sm text-red-300">{error}</div>}

      {datos && !datos.disponible && (
        <div className="glass rounded-2xl px-4 py-6 text-sm text-white/70">Este asesor no tiene información en el periodo.</div>
      )}

      {datos?.disponible && (
        <div className="grid xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-4 items-start">
          <div className="min-w-0">
            <MiResumenAsesor
              resumen={datos.resumen}
              detalleDiaDia={datos.detalle_dia_dia}
              billetera={datos.billetera}
              canceladasRevision={datos.canceladas_revision}
            />
          </div>
          <div className="space-y-4 xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:overflow-auto">
            {puedeEditar && tipo === "comercial" && <PanelAuditoria key={`c|${asesor}|${datos.fecha_corte}`} {...propsPanel} />}
            {puedeEditar && tipo === "interna" && <PanelInterna key={`i|${asesor}|${datos.fecha_corte}`} {...propsPanel} />}
            {!puedeEditar && (
              <AuditoriaSoloLectura tipo={tipo} asesor={asesor} auditorias={hist.auditorias.filter((a) => a.tipo === tipo)} />
            )}
            <SeguimientoAuditoria key={`s|${asesor}`} asesor={asesor} periodo={periodo} roles={roles} />
          </div>
        </div>
      )}
    </div>
  );
}
