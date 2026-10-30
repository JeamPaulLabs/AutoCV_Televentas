import { useEffect, useState } from "react";
import { useDashboardCache } from "./hooks/useDashboardCache";
import { solicitarActualizacionIlio, estadoActualizacionIlio } from "./services/comoVamos";
import { useTema } from "./hooks/useTema";
import logoClaro from "./assets/logo-claro.png";
import logoOscuro from "./assets/logo-oscuro.png";
import Esqueleto, { guardarPista } from "./components/Esqueleto";
import MiResumenAsesor from "./components/MiResumenAsesor";
import OtrosiAyuda from "./components/OtrosiAyuda";
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
  const [actualizandoIlio, setActualizandoIlio] = useState(false);
  const [mensajeIlio, setMensajeIlio] = useState(null);
  const { tema, alternar: alternarTema } = useTema();
  const { loading, error, data, reintentar } = useDashboardCache(periodo, modo);
  // Lo que el backend realmente devolvió manda sobre lo solicitado (un admin
  // sin asesor vinculado pide "personal" y recibe "equipo").
  const vistaActual = data?.vista ?? modo;
  useEffect(() => guardarPista(data), [data]);

  // La vista del asesor ocupa el alto de la ventana menos el encabezado, que
  // cambia de alto si se parte en dos líneas: se mide en vez de fijar un valor.
  useEffect(() => {
    const cab = document.querySelector(".header-sticky");
    if (!cab) return undefined;
    const medir = () =>
      document.documentElement.style.setProperty("--alto-cabecera", `${cab.offsetHeight + 48}px`);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(cab);
    return () => ro.disconnect();
  }, []);

  function cambiarPeriodo(nuevoPeriodo) {
    setPeriodo(nuevoPeriodo);
    try {
      localStorage.setItem(PERIODO_STORAGE_KEY, nuevoPeriodo);
    } catch {
      /* localStorage no disponible, se pierde la preferencia al recargar */
    }
  }

  async function activarActualizacionIlio() {
    if (actualizandoIlio) return;
    setActualizandoIlio(true);
    setMensajeIlio("Enviando solicitud...");
    try {
      const res = await solicitarActualizacionIlio();
      let intentos = 0;
      const maxIntentos = 24; // ~2 minutos
      const poll = async () => {
        try {
          const st = await estadoActualizacionIlio();
          const sol = st?.solicitud;
          if (sol && (sol.estado === "pendiente" || sol.estado === "en_curso")) {
            setMensajeIlio(
              sol.estado === "en_curso"
                ? "Actualizando Ilio..."
                : "Solicitud encolada, esperando al proceso..."
            );
            intentos += 1;
            if (intentos < maxIntentos) {
              setTimeout(poll, 5000);
            } else {
              setActualizandoIlio(false);
              setMensajeIlio("Solicitud encolada. Se ejecutara cuando el proceso del host la atienda.");
            }
            return;
          }
          setActualizandoIlio(false);
          if (sol?.estado === "ok") {
            setMensajeIlio("Ilio actualizado correctamente.");
            reintentar();
          } else if (sol?.estado === "error") {
            setMensajeIlio(sol.mensaje || "Error en la actualizacion de Ilio.");
          } else {
            setMensajeIlio(null);
          }
        } catch {
          setActualizandoIlio(false);
          setMensajeIlio("No se pudo consultar el estado.");
        }
      };
      setTimeout(poll, 3000);
    } catch (e) {
      setActualizandoIlio(false);
      setMensajeIlio(e?.message || "No se pudo solicitar la actualizacion.");
    }
  }

  return (
    <div className="min-h-screen">
      <header className="header-sticky sticky top-0 z-20 px-4 md:px-6 py-2.5 flex items-center justify-between gap-4 flex-wrap max-w-[1900px] mx-auto">
        <div className="flex items-center gap-3 flex-wrap">
          <img src={tema === "claro" ? logoClaro : logoOscuro} alt="Xuma" className="h-[45px] w-[150px] object-contain" />
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
          {data?.puede_ver_equipo && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={activarActualizacionIlio}
                disabled={actualizandoIlio}
                className="px-3 py-1 rounded-full text-xs font-semibold transition-colors duration-200 bg-xuma-green-dark text-xuma-bg-dark disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
                title="Dispara la actualizacion de Ilio (descarga del portal y carga a BD)"
              >
                {actualizandoIlio ? "Actualizando..." : "Actualizar Ilio"}
              </button>
              {mensajeIlio && (
                <span className="text-[10px] text-white/70 max-w-[220px] truncate" title={mensajeIlio}>
                  {mensajeIlio}
                </span>
              )}
            </div>
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
                vistaActual === "personal"
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
                vistaActual === "equipo"
                  ? "bg-xuma-green-dark text-xuma-bg-dark"
                  : "text-white/60 hover:text-white/90"
              }`}
            >
              Vista equipo
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={alternarTema}
          className="glass rounded-full w-8 h-8 text-sm text-white/90 hover:text-white transition-colors"
          aria-label={tema === "claro" ? "Cambiar a tema oscuro" : "Cambiar a tema claro"}
          title={tema === "claro" ? "Tema oscuro" : "Tema claro"}
        >
          {tema === "claro" ? "☾" : "☀"}
        </button>
      </header>

      <main className="px-4 md:px-6 py-4 max-w-[1900px] mx-auto">
        {loading && <Esqueleto periodo={periodo} tema={tema} />}

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

        {!loading && data?.vista === "personal" && (
          <MiResumenAsesor
            resumen={data.resumen}
            detalleDiaDia={data.detalle_dia_dia}
            billetera={data.billetera}
            canceladasRevision={data.canceladas_revision}
            otrosi={data.otrosi}
          />
        )}

        {!loading && data?.vista === "equipo" && <VistaEquipo data={data} tema={tema} />}
      </main>

      {data?.otrosi && (
        <OtrosiAyuda otrosi={data.otrosi} miResumen={data.vista === "personal" ? data.resumen : null} />
      )}

      <footer className="px-4 md:px-6 py-2.5 text-[10px] text-white/40 border-t border-white/10 max-w-[1900px] mx-auto">
        Fuente: Ilio, estrategia Televentas · incluye Auditada Web, Alta Transaccional, Digitada Web y Cancelada ·
        Cuota Protegida, Billetera Protegida y Rueda Seguro cuentan en el acumulado.
      </footer>
    </div>
  );
}
