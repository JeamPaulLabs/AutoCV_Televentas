import Tabs from "../Tabs";
import TablaAsesores from "../TablaAsesores";
import TablaConteo from "../TablaConteo";
import TablaDetalleAsesor from "../TablaDetalleAsesor";
import TablaFacturacion from "../TablaFacturacion";
import HeroEquipo from "./HeroEquipo";
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

/** Vista administrativa (equipo): Martha, Orlando, Kevin, Isaac. Pensada para
 * PC en la red interna. La vista del asesor vive aparte (MiResumenAsesor). */
export default function VistaEquipo({ data }) {
  const rs = data.rueda_segura.tabla_dias.length > 0;
  const bp = (data.billetera?.tabla_dias?.length || 0) > 0;

  const tabs = [
    {
      id: "asesores",
      label: "Asesores",
      content: (
        <>
          <SeccionTitulo>Como vamos por asesor</SeccionTitulo>
          <TablaAsesores filas={data.asesores} />
        </>
      ),
    },
    {
      id: "dia",
      label: "Día a día por producto",
      content: (
        <>
          <SeccionTitulo>Día a día — Cuota Protegida, Billetera Protegida y Rueda Seguro</SeccionTitulo>
          <TablaDiaProductos filas={data.dia_producto_estado} />
        </>
      ),
    },
    {
      id: "facturacion",
      label: "Facturación",
      content: (
        <div className="grid lg:grid-cols-3 gap-3">
          <div>
            <SeccionTitulo>Por gasera</SeccionTitulo>
            <TablaFacturacion filas={data.tabla_gasera} colEtiqueta="entidad_facturacion" etiqueta="Gasera" campoCantidad="cantidad" />
          </div>
          <div>
            <SeccionTitulo>Por producto</SeccionTitulo>
            <TablaFacturacion filas={data.tabla_producto} colEtiqueta="producto" etiqueta="Producto" campoCantidad="cantidad" />
          </div>
          <div>
            <SeccionTitulo>Por estado</SeccionTitulo>
            <TablaFacturacion filas={data.tabla_estados} colEtiqueta="nombre_estado" etiqueta="Estado" campoCantidad="cantidad" />
          </div>
        </div>
      ),
    },
    {
      id: "detalle",
      label: "Detalle por vendedor",
      content: (
        <>
          <SeccionTitulo>Pólizas por estado de cada vendedor</SeccionTitulo>
          <TablaDetalleAsesor filas={data.detalle_asesor_estado} />
        </>
      ),
    },
  ];

  if (rs || bp) {
    tabs.splice(3, 0, {
      id: "rs-bp",
      label: "RS y BP por asesor",
      content: (
        <div className="grid lg:grid-cols-2 gap-3">
          {rs && (
            <div>
              <SeccionTitulo>Rueda Seguro — Auditoría (RS)</SeccionTitulo>
              <TablaConteo filas={data.rueda_segura.tabla_dias} colEtiqueta="fecha_venta" etiqueta="Fecha (RS)" />
              <SeccionTitulo className="mt-3">Asesor (RS)</SeccionTitulo>
              <TablaConteo filas={data.rueda_segura.tabla_asesor} colEtiqueta="asesor" etiqueta="Asesor (RS)" />
            </div>
          )}
          {bp && (
            <div>
              <SeccionTitulo>Billetera Protegida (BP)</SeccionTitulo>
              <TablaConteo filas={data.billetera.tabla_dias} colEtiqueta="fecha_venta" etiqueta="Fecha (BP)" />
              <SeccionTitulo className="mt-3">Asesor (BP)</SeccionTitulo>
              <TablaConteo filas={data.billetera.tabla_asesor} colEtiqueta="asesor" etiqueta="Asesor (BP)" />
            </div>
          )}
        </div>
      ),
    });
  }

  return (
    <>
      <Avisos avisos={data.avisos} />
      <HeroEquipo data={data} />
      <Tabs tabs={tabs} />
    </>
  );
}
