import Tabs from "../Tabs";
import StatTile from "../StatTile";
import TablaAsesores from "../TablaAsesores";
import TablaConteo from "../TablaConteo";
import TablaDetalleAsesor from "../TablaDetalleAsesor";
import TablaFacturacion from "../TablaFacturacion";
import { fmtNumero } from "../../utils/formato";
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

/** "Resumen": todo el reporte en una sola vista, igual que el HTML que se
 * descarga (src/reporte_html.py): desempeño diario, gasera, producto, Rueda
 * Seguro y Billetera Protegida; más el día a día por producto. */
function Resumen({ data }) {
  const rs = data.rueda_segura.tabla_dias.length > 0;
  const bp = (data.billetera?.tabla_dias?.length || 0) > 0;

  return (
    <div className="space-y-5">
      <div className="grid lg:grid-cols-3 gap-3">
        <div>
          <SeccionTitulo>Desempeño diario</SeccionTitulo>
          <TablaFacturacion filas={data.tabla_dias} colEtiqueta="fecha_venta" etiqueta="Fecha" campoCantidad="polizas" />
        </div>
        <div>
          <SeccionTitulo>Facturación por gasera</SeccionTitulo>
          <TablaFacturacion filas={data.tabla_gasera} colEtiqueta="entidad_facturacion" etiqueta="Gasera" campoCantidad="cantidad" />
          <SeccionTitulo className="mt-3">Facturación por producto</SeccionTitulo>
          <TablaFacturacion filas={data.tabla_producto} colEtiqueta="producto" etiqueta="Producto" campoCantidad="cantidad" />
        </div>
        {(rs || bp) && (
          <div>
            {rs && (
              <>
                <SeccionTitulo>Rueda Seguro — Auditoría (RS)</SeccionTitulo>
                <TablaConteo filas={data.rueda_segura.tabla_dias} colEtiqueta="fecha_venta" etiqueta="Fecha (RS)" />
                <SeccionTitulo className="mt-3">Asesor (RS)</SeccionTitulo>
                <TablaConteo filas={data.rueda_segura.tabla_asesor} colEtiqueta="asesor" etiqueta="Asesor (RS)" />
              </>
            )}
            {bp && (
              <>
                <SeccionTitulo className={rs ? "mt-4" : ""}>Billetera Protegida — cuenta en el acumulado</SeccionTitulo>
                <TablaConteo filas={data.billetera.tabla_dias} colEtiqueta="fecha_venta" etiqueta="Fecha (BP)" />
                <SeccionTitulo className="mt-3">Asesor (BP)</SeccionTitulo>
                <TablaConteo filas={data.billetera.tabla_asesor} colEtiqueta="asesor" etiqueta="Asesor (BP)" />
              </>
            )}
          </div>
        )}
      </div>

      <div>
        <SeccionTitulo>Día a día por producto — Cuota Protegida, Billetera Protegida y Rueda Seguro</SeccionTitulo>
        <TablaDiaProductos filas={data.dia_producto_estado} />
      </div>
    </div>
  );
}

function Detalle({ data }) {
  const r = data.resumen_equipo;
  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_2fr] gap-3">
      <div>
        <SeccionTitulo>Resumen del equipo</SeccionTitulo>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <StatTile label="Meta del mes" value={fmtNumero(r.meta_total)} />
          <StatTile label="Acumulado a la fecha" value={fmtNumero(r.acumulado_total)} />
          <StatTile label="Forecast de cierre" value={fmtNumero(r.forecast_total)} />
          <StatTile
            label="Días laborados"
            value={`${data.calendario.dias_laborados} / ${data.calendario.dias_colectivo}`}
            sub={`${data.calendario.dias_por_laborar} días por laborar`}
          />
        </div>
        <SeccionTitulo>Ventas por estado</SeccionTitulo>
        <TablaFacturacion filas={data.tabla_estados} colEtiqueta="nombre_estado" etiqueta="Estado" campoCantidad="cantidad" />
      </div>
      <div>
        <SeccionTitulo>Detalle por vendedor — pólizas por estado</SeccionTitulo>
        <TablaDetalleAsesor filas={data.detalle_asesor_estado} />
      </div>
    </div>
  );
}

/** Vista administrativa (equipo): Martha, Orlando, Kevin, Isaac. Pensada para
 * PC en la red interna. La vista del asesor vive aparte (MiResumenAsesor). */
export default function VistaEquipo({ data }) {
  return (
    <>
      <Avisos avisos={data.avisos} />
      <HeroEquipo data={data} />
      <Tabs
        tabs={[
          { id: "resumen", label: "Resumen", content: <Resumen data={data} /> },
          {
            id: "asesor",
            label: "Como vamos por asesor",
            content: (
              <>
                <SeccionTitulo>Como vamos por asesor</SeccionTitulo>
                <TablaAsesores filas={data.asesores} />
              </>
            ),
          },
          { id: "detalle", label: "Detalle por vendedor", content: <Detalle data={data} /> },
        ]}
      />
    </>
  );
}
