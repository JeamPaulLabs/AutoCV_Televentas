import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Tabs from "../Tabs";
import TablaAsesores from "../TablaAsesores";
import TablaDetalleAsesor from "../TablaDetalleAsesor";
import TablaFacturacion from "../TablaFacturacion";
import AvanceEquipo from "./AvanceEquipo";
import ReporteResumen from "./ReporteResumen";
import VistaAuditoria from "./VistaAuditoria";
import SeccionTitulo from "./SeccionTitulo";

/** Avisos de datos: una pastilla llamativa en la fila de pestañas (no ocupa
 * espacio en el tablero ni tapa los botones flotantes); el detalle se abre al
 * hacer clic. */
function Avisos({ avisos }) {
  const { sin_meta: sinMeta, sin_tarifa: sinTarifa } = avisos;
  const [slot, setSlot] = useState(null);
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);
  useEffect(() => setSlot(document.getElementById("acciones-tab")), []);
  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => ref.current && !ref.current.contains(e.target) && setAbierto(false);
    const esc = (e) => e.key === "Escape" && setAbierto(false);
    document.addEventListener("mousedown", fuera);
    window.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fuera);
      window.removeEventListener("keydown", esc);
    };
  }, [abierto]);

  const total = sinMeta.length + sinTarifa.length;
  if (total === 0 || !slot) return null;
  return createPortal(
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-expanded={abierto}
        onClick={() => setAbierto((a) => !a)}
        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold border border-amber-300/60 bg-amber-400/15 text-amber-100 hover:bg-amber-400/25 transition-colors"
      >
        <span className="relative flex h-2 w-2" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full rounded-full bg-amber-300 opacity-75 animate-ping" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-300" />
        </span>
        {total} {total === 1 ? "aviso" : "avisos"} de datos
      </button>
      {abierto && (
        <div className="absolute right-0 top-full mt-2 z-30 modal-solid rounded-2xl p-4 w-[min(420px,90vw)] text-sm text-white/90 space-y-2">
          {sinMeta.length > 0 && (
            <p>
              <span className="font-semibold text-amber-200">Sin meta cargada:</span> {sinMeta.join(", ")}
            </p>
          )}
          {sinTarifa.length > 0 && (
            <p>
              <span className="font-semibold text-amber-200">Planes sin tarifa SERVI:</span> {sinTarifa.join(", ")}
            </p>
          )}
        </div>
      )}
    </div>,
    slot
  );
}

function Detalle({ data }) {
  return (
    <>
      <AvanceEquipo data={data} />
      <div className="grid lg:grid-cols-[minmax(0,1fr)_2fr] gap-3">
        <div>
          <SeccionTitulo>Ventas por estado</SeccionTitulo>
          <TablaFacturacion filas={data.tabla_estados} colEtiqueta="nombre_estado" etiqueta="Estado" campoCantidad="cantidad" />
        </div>
        <div>
          <SeccionTitulo>Detalle por vendedor — pólizas por estado</SeccionTitulo>
          <TablaDetalleAsesor filas={data.detalle_asesor_estado} />
        </div>
      </div>
    </>
  );
}

/** Vista administrativa (equipo): Martha, Orlando, Kevin, Isaac. Pensada para
 * PC en la red interna. La vista del asesor vive aparte (MiResumenAsesor). */
export default function VistaEquipo({ data, tema }) {
  return (
    <>
      <Tabs
        tabs={[
          { id: "resumen", label: "Resumen", content: <ReporteResumen data={data} tema={tema} /> },
          { id: "vanti", label: "Vanti", content: <ReporteResumen data={data} tema={tema} conFacturacion={false} /> },
          {
            id: "asesor",
            label: "Como vamos por asesor",
            content: (
              <>
                <AvanceEquipo data={data} />
                <SeccionTitulo>Como vamos por asesor</SeccionTitulo>
                <TablaAsesores filas={data.asesores} otrosi={data.otrosi} />
              </>
            ),
          },
          { id: "detalle", label: "Detalle por vendedor", content: <Detalle data={data} /> },
          // Auditoría por asesor: coordinación comercial (Martha) y auditoría interna (Kevin).
          ...(data.puede_auditar ? [{ id: "auditoria", label: "Auditoría", content: <VistaAuditoria data={data} /> }] : []),
        ]}
      />
      <Avisos avisos={data.avisos} />
    </>
  );
}
