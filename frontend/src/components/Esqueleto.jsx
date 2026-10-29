import { useState } from "react";
import MiResumenAsesor from "./MiResumenAsesor";
import VistaEquipo from "./admin/VistaEquipo";

const CLAVE_PISTA = "como-vamos-televentas:pista";

/** Qué pantalla se vio la última vez (solo la forma: vista, si audita y si hay
 * otrosí; ningún dato de ventas ni de personas). Sirve para dibujar el esqueleto
 * con el mismo diseño que va a tener la pantalla real. */
export function guardarPista(data) {
  if (!data?.vista) return;
  try {
    localStorage.setItem(
      CLAVE_PISTA,
      JSON.stringify({ vista: data.vista, puedeAuditar: Boolean(data.puede_auditar), otrosi: Boolean(data.otrosi) })
    );
  } catch {
    /* sin localStorage: el esqueleto usa la vista del asesor */
  }
}

function leerPista() {
  try {
    return { vista: "personal", puedeAuditar: false, otrosi: false, ...JSON.parse(localStorage.getItem(CLAVE_PISTA) || "{}") };
  } catch {
    return { vista: "personal", puedeAuditar: false, otrosi: false };
  }
}

const iso = (anio, mes, dia) => `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;

/** Datos de relleno con el tamaño típico del mes (días con ventas, filas por
 * tabla). Nunca se leen: el CSS .esqueleto vuelve transparente todo el texto. */
function datosEquipo(periodo, pista) {
  const [anio, mes] = periodo.split("-").map(Number);
  const dias = 22;
  const filas = [];
  for (let d = 1; d <= dias; d += 1) {
    const fecha = iso(anio, mes, d);
    for (const [producto, cantidad] of [["CUOTA PROTEGIDA V", 20 + (d % 7)], ["PLAN COMBO VIDA", 8 + (d % 4)], ["RUEDA SEGURO SBS", 2 + (d % 3)], ["BILLETERA PROTEGIDA", 1 + (d % 2)]]) {
      for (const nombre_estado of ["ALTA TRANSACCIONAL", "DIGITADA WEB"]) {
        filas.push({ fecha_venta: fecha, producto: producto.startsWith("CUOTA") ? "CP" : producto.startsWith("PLAN") ? "PCV" : producto.startsWith("RUEDA") ? "RS" : "BP", nombre_estado, cantidad: Math.ceil(cantidad / 2), facturacion_servi: 25000 * cantidad });
      }
    }
  }
  const fila = (clave, nombre) => ({ [clave]: nombre, cantidad: 100, facturacion_servi: 3000000, pct_participacion: 0.25 });
  return {
    periodo: iso(anio, mes, 1),
    fecha_corte: iso(anio, mes, dias),
    vista: "equipo",
    puede_auditar: pista.puedeAuditar,
    calendario: { dias_colectivo: 26, dias_laborados: dias, dias_por_laborar: 4 },
    kpis: { total_facturacion: 56000000 },
    podio: [0, 1, 2].map((i) => ({ asesor: `ASESOR UNO ${i}`, acumulado: 100, pct_cumpl_acumulado: 0.9 })),
    dia_producto_estado: filas,
    tabla_gasera_cp_pcv: ["A", "B", "C", "D"].map((n) => fila("entidad_facturacion", `GASERA ${n}`)),
    tabla_producto: ["A", "B", "C", "D"].map((n) => fila("producto", `PRODUCTO ${n}`)),
    avisos: { sin_meta: [], sin_tarifa: [] },
    asesores: [],
    detalle_asesor_estado: [],
    tabla_estados: [],
  };
}

function datosPersonal(periodo, pista) {
  const [anio, mes] = periodo.split("-").map(Number);
  const detalle = [];
  for (let d = 1; d <= 14; d += 1) {
    for (let i = 0; i < 2 + (d % 3); i += 1) {
      detalle.push({ fecha_venta: iso(anio, mes, d), contrato: `${d}${i}`, producto: i === 0 ? "CUOTA PROTEGIDA V" : "PLAN COMBO VIDA", estado: i === 1 ? "DIGITADA WEB" : "ALTA TRANSACCIONAL" });
    }
  }
  return {
    resumen: { categoria: "ALFA", meta_mes: 100, acumulado: 70, forecast: 95, pct_forecast: 0.95, pct_cumpl_acumulado: 0.7, pct_cump_ideal: 0.7, faltan_para_meta: 30, observaciones: null },
    detalle,
    otrosi: pista.otrosi ? { pct_minimo_comision: 0.7 } : null,
  };
}

/** Esqueleto de carga: dibuja la pantalla REAL (los mismos componentes) con
 * datos de relleno y, por CSS, los textos se vuelven bloques grises que pulsan.
 * Así la pantalla no cambia de forma cuando llegan los datos. */
export default function Esqueleto({ periodo, tema }) {
  const [pista] = useState(leerPista);
  return (
    <div className="esqueleto" role="status" aria-live="polite" aria-label="Cargando el Como vamos">
      <span className="sr-only">Cargando el Como vamos…</span>
      <div aria-hidden="true">
        {pista.vista === "equipo" ? (
          <VistaEquipo data={datosEquipo(periodo, pista)} tema={tema} />
        ) : (
          (() => {
            const p = datosPersonal(periodo, pista);
            return <MiResumenAsesor resumen={p.resumen} detalleDiaDia={p.detalle} billetera={null} canceladasRevision={[]} otrosi={p.otrosi} />;
          })()
        )}
      </div>
    </div>
  );
}
