import { useState } from "react";
import { useDashboardCache } from "./hooks/useDashboardCache";
import MiResumenAsesor from "./components/MiResumenAsesor";
import OtrosiCard from "./components/OtrosiCard";
import VistaEquipo from "./components/admin/VistaEquipo";

const PERIODO_STORAGE_KEY = "como-vamos-televentas:periodo";

// Desde agosto 2026 hasta el mes en curso -- la pestaña del mes nuevo aparece
// sola. Debe calzar con periodos_disponibles() en
// backend/app/routers/como_vamos.py (el backend rechaza cualquier otro).
function periodosDisponibles() {
  const hoy = new Date();
  const periodos = [];
  let anio = 2026;
  let mes = 8;
  while (anio < hoy.getFullYear() || (anio === hoy.getFullYear() && mes <= hoy.getMonth() + 1)) {
    periodos.push(`${anio}-${String(mes).padStart(2, "0")}`);
    mes += 1;
    if (mes > 12) {
      mes = 1;
      anio += 1;
    }
  }
  return periodos;
}

const PERIODOS = periodosDisponibles();

function periodoInicial() {
  try {
    const guardado = localStorage.getItem(PERIODO_STORAGE_KEY);
    if (guardado && PERIODOS.includes(guardado)) return guardado;
  } catch {
    /* localStorage no disponible */
  }
  return PERIODOS[PERIODOS.length - 1];
}

const MESES_ES = [
  "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
  "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE",
];

function mesNombre(periodoIso) {
  const [anio, mes] = periodoIso.split("-");
  return `${MESES_ES[Number(mes) - 1]} ${anio}`;
}

function fmtActualizado(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  const fecha = d.toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
  const hora = d.toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" });
  return `${fecha}, ${hora}`;
}

export default function App() {
  const [periodo, setPeriodo] = useState(periodoInicial());
  const [modo, setModo] = useState("personal");
  const { loading, error, data, reintentar } = useDashboardCache(periodo, modo);

  function cambiarPeriodo(nuevoPeriodo) {
    setPeriodo(nuevoPeriodo);
    try {
      localStorage.setItem(PERIODO_STORAGE_KEY, nuevoPeriodo);
    } catch {
      /* localStorage no disponible, se pierde la preferencia al recargar */
    }
  }

  return (
    <div className="min-h-screen">
      <header className="header-sticky sticky top-0 z-20 px-4 md:px-6 py-2.5 flex items-center justify-between gap-4 flex-wrap max-w-[1900px] mx-auto">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-lg font-extrabold tracking-wide text-white">COMO VAMOS · TELEVENTAS</h1>
          <p className="text-xs text-white/60">
            {mesNombre(periodo)} · Seguros Vanti — Zurich
          </p>
          {data && (
            <span className="inline-block text-[10px] font-semibold tracking-wide px-2 py-0.5 rounded-md border border-white/30 text-white/80">
              {data.cerrado
                ? "CERRADO POR AUDITORÍA"
                : data.vista === "personal"
                ? "TU OPERACIÓN — en vivo"
                : "EN CURSO — datos en vivo de Ilio"}
            </span>
          )}
          {data?.actualizado_en && (
            <span className="text-[10px] text-white/50">
              Ilio actualizado: {fmtActualizado(data.actualizado_en)}
            </span>
          )}
        </div>
        <div className="glass rounded-full p-1 flex gap-1">
          {PERIODOS.map((p) => (
            <button
              key={p}
              onClick={() => cambiarPeriodo(p)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors duration-200 ${
                periodo === p
                  ? "bg-xuma-green-dark text-xuma-bg-dark"
                  : "text-white/60 hover:text-white/90"
              }`}
            >
              {mesNombre(p)}
            </button>
          ))}
        </div>
        {data?.puede_ver_equipo && (
          <div className="glass rounded-full p-1 flex gap-1">
            <button
              type="button"
              onClick={() => setModo("personal")}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors duration-200 ${
                modo === "personal"
                  ? "bg-xuma-green-dark text-xuma-bg-dark"
                  : "text-white/60 hover:text-white/90"
              }`}
            >
              Mi operación
            </button>
            <button
              type="button"
              onClick={() => setModo("equipo")}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors duration-200 ${
                modo === "equipo"
                  ? "bg-xuma-green-dark text-xuma-bg-dark"
                  : "text-white/60 hover:text-white/90"
              }`}
            >
              Vista equipo
            </button>
          </div>
        )}
      </header>

      <main className="px-4 md:px-6 py-4 max-w-[1900px] mx-auto">
        {loading && <div className="text-white/60 text-sm">Cargando dashboard…</div>}

        {error && (
          <div className="glass rounded-2xl px-4 py-4 text-sm text-white">
            <p className="text-red-300 font-semibold mb-2">No se pudo cargar el dashboard.</p>
            <p className="text-white/70 mb-3">{error}</p>
            <button
              onClick={reintentar}
              className="px-3 py-1.5 rounded-lg bg-xuma-green-dark text-xuma-bg-dark text-xs font-bold"
            >
              Reintentar
            </button>
          </div>
        )}

        {data?.otrosi && <OtrosiCard otrosi={data.otrosi} />}

        {data?.vista === "personal" && (
          <MiResumenAsesor
            resumen={data.resumen}
            detalleDiaDia={data.detalle_dia_dia}
            billetera={data.billetera}
            canceladasRevision={data.canceladas_revision}
          />
        )}

        {data?.vista === "equipo" && <VistaEquipo data={data} />}
      </main>

      <footer className="px-4 md:px-6 py-2.5 text-[10px] text-white/40 border-t border-white/10 max-w-[1900px] mx-auto">
        Fuente: Ilio, estrategia Televentas · incluye Auditada Web, Alta Transaccional, Digitada Web y Cancelada ·
        Cuota Protegida, Billetera Protegida y Rueda Seguro cuentan en el acumulado.
      </footer>
    </div>
  );
}
