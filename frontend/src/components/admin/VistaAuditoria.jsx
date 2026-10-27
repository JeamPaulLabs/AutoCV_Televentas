import { useEffect, useMemo, useState } from "react";
import { obtenerDashboard } from "../../services/comoVamos";
import MiResumenAsesor from "../MiResumenAsesor";
import PanelAuditoria from "./PanelAuditoria";

/** Pestaña "Auditoría" (solo Martha): elige un asesor, ve su Como vamos tal
 * como lo ve él y, al lado, el panel para auditarlo. */
export default function VistaAuditoria({ data }) {
  const periodo = data.periodo.slice(0, 7);
  const asesores = useMemo(
    () => [...new Set(data.asesores.map((a) => a.asesor))].sort((a, b) => a.localeCompare(b, "es")),
    [data.asesores]
  );
  const [asesor, setAsesor] = useState("");
  const [estado, setEstado] = useState({ cargando: false, error: "", datos: null });

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

  const { cargando, error, datos } = estado;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <label htmlFor="selector-asesor" className="text-xs uppercase tracking-wide text-white/70">
          Asesor a auditar
        </label>
        <select
          id="selector-asesor"
          value={asesor}
          onChange={(e) => setAsesor(e.target.value)}
          className="campo text-sm min-w-[280px]"
        >
          <option value="">Selecciona un asesor…</option>
          {asesores.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        {cargando && <span className="text-xs text-white/60">Cargando…</span>}
      </div>

      {!asesor && (
        <div className="glass rounded-2xl px-4 py-6 text-sm text-white/70">
          Elige un asesor para ver su Como vamos y auditarlo.
        </div>
      )}
      {error && <div className="glass rounded-2xl px-4 py-4 text-sm text-red-300">{error}</div>}

      {datos && !datos.disponible && (
        <div className="glass rounded-2xl px-4 py-6 text-sm text-white/70">
          Este asesor no tiene información en el periodo.
        </div>
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
          <div className="xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:overflow-auto">
            <PanelAuditoria key={`${asesor}|${datos.fecha_corte}`} datos={datos} asesor={asesor} periodo={periodo} fechaCorte={datos.fecha_corte} />
          </div>
        </div>
      )}
    </div>
  );
}
