import Tabs from "../Tabs";
import TablaAsesores from "../TablaAsesores";
import TablaConteo from "../TablaConteo";
import TablaDetalleAsesor from "../TablaDetalleAsesor";
import TablaFacturacion from "../TablaFacturacion";
import AvanceEquipo from "./AvanceEquipo";
import ResumenVisual from "./ResumenVisual";
import SeccionTitulo from "./SeccionTitulo";
import TablaDiaProductos from "./TablaDiaProductos";

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

/** "Resumen": todo el reporte en una sola vista, como el HTML que se descarga
 * (src/reporte_html.py): avance y podio, día a día con los productos, y
 * facturación por gasera y por producto. Sin tablas por asesor. */
function Resumen({ data }) {
  return (
    <div className="space-y-4">
      <ResumenVisual data={data} />
      <div className="grid xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-3 items-start">
        <div>
          <SeccionTitulo>Desempeño diario por producto</SeccionTitulo>
          <TablaDiaProductos filas={data.dia_producto_estado} />
        </div>
        <div>
          <SeccionTitulo>Facturación por gasera</SeccionTitulo>
          <TablaFacturacion filas={data.tabla_gasera} colEtiqueta="entidad_facturacion" etiqueta="Gasera" campoCantidad="cantidad" />
          <SeccionTitulo className="mt-3">Facturación por producto</SeccionTitulo>
          <TablaFacturacion filas={data.tabla_producto} colEtiqueta="producto" etiqueta="Producto" campoCantidad="cantidad" />
        </div>
      </div>
    </div>
  );
}

/** "Vanti": los mismos datos que Resumen, solo conteos (sin facturación ni
 * pesos), para compartir con Vanti. */
function Vanti({ data }) {
  return (
    <div className="space-y-4">
      <ResumenVisual data={data} conFacturacion={false} />
      <div className="grid xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-3 items-start">
        <div>
          <SeccionTitulo>Desempeño diario por producto</SeccionTitulo>
          <TablaDiaProductos filas={data.dia_producto_estado} conFacturacion={false} />
        </div>
        <div>
          <SeccionTitulo>Ventas por gasera</SeccionTitulo>
          <TablaConteo filas={data.tabla_gasera} colEtiqueta="entidad_facturacion" etiqueta="Gasera" />
          <SeccionTitulo className="mt-3">Ventas por producto</SeccionTitulo>
          <TablaConteo filas={data.tabla_producto} colEtiqueta="producto" etiqueta="Producto" />
        </div>
      </div>
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
export default function VistaEquipo({ data }) {
  return (
    <>
      <Avisos avisos={data.avisos} />
      <Tabs
        tabs={[
          { id: "resumen", label: "Resumen", content: <Resumen data={data} /> },
          { id: "vanti", label: "Vanti", content: <Vanti data={data} /> },
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
