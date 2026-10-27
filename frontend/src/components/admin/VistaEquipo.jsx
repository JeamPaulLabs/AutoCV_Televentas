import Tabs from "../Tabs";
import TablaAsesores from "../TablaAsesores";
import TablaDetalleAsesor from "../TablaDetalleAsesor";
import TablaFacturacion from "../TablaFacturacion";
import AvanceEquipo from "./AvanceEquipo";
import ReporteResumen from "./ReporteResumen";
import SeccionTitulo from "./SeccionTitulo";

function Avisos({ avisos }) {
  const { sin_meta: sinMeta, sin_tarifa: sinTarifa } = avisos;
  if (sinMeta.length === 0 && sinTarifa.length === 0) return null;
  return (
    <div className="rounded-xl border border-amber-300/40 bg-amber-400/10 px-3 py-2 mb-3 text-xs text-amber-100 space-y-1">
      {sinMeta.length > 0 && (
        <p>
          <span className="font-semibold">Sin meta cargada:</span> {sinMeta.join(", ")}
        </p>
      )}
      {sinTarifa.length > 0 && (
        <p>
          <span className="font-semibold">Planes sin tarifa SERVI:</span> {sinTarifa.join(", ")}
        </p>
      )}
    </div>
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
      <Avisos avisos={data.avisos} />
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
        ]}
      />
    </>
  );
}
