import { useEffect, useRef, useState } from "react";
import { AVISO_WHATSAPP, descargarBlob, enviarPorWhatsApp, nodoAPng } from "../../utils/exportarImagen";

const FONDO = { claro: "#f3f5fb", oscuro: "#0d1024" };

const BTN =
  "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold glass text-white/90 hover:text-white transition-colors disabled:opacity-50";

/** Desplegable flotante "Lo que va bien": no ocupa espacio en el tablero. */
function LoQueVaBien({ insights }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);

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

  if (insights.length === 0) return null;
  return (
    <div className="relative" ref={ref}>
      <button type="button" className={BTN} aria-expanded={abierto} onClick={() => setAbierto((a) => !a)}>
        <span className="text-xuma-green-dark" aria-hidden="true">▲</span>
        Lo que va bien
        <span className="tabular-nums text-white/60">({insights.length})</span>
      </button>
      {abierto && (
        <div className="absolute right-0 top-full mt-2 z-30 modal-solid rounded-2xl p-4 w-[min(420px,90vw)]">
          <div className="text-[11px] uppercase tracking-wide text-white/70 mb-2">Lo que va bien este mes</div>
          <ul className="space-y-1.5 text-sm text-white/90">
            {insights.map((t) => (
              <li key={t} className="flex gap-2">
                <span className="text-xuma-green-dark" aria-hidden="true">▲</span>
                {t}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Barra de herramientas del reporte: insights, descargar imagen y WhatsApp.
 * Vive fuera del nodo que se captura. */
export default function BarraExportar({ objetivoRef, nombreArchivo, textoWhatsApp, tema, insights }) {
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState("");

  async function generar() {
    return nodoAPng(objetivoRef.current, { fondo: FONDO[tema] });
  }

  async function descargar() {
    setOcupado(true);
    setAviso("");
    try {
      descargarBlob(await generar(), nombreArchivo);
    } catch (e) {
      setAviso(`No se pudo generar la imagen: ${e.message}`);
    } finally {
      setOcupado(false);
    }
  }

  async function whatsapp() {
    setOcupado(true);
    setAviso("");
    try {
      const resultado = await enviarPorWhatsApp(await generar(), nombreArchivo, textoWhatsApp);
      setAviso(AVISO_WHATSAPP[resultado]);
    } catch (e) {
      setAviso(`No se pudo generar la imagen: ${e.message}`);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="flex items-center justify-end gap-2 flex-wrap mb-3">
      {aviso && (
        <span role="status" className="mr-auto text-xs text-white/80">
          {aviso}
        </span>
      )}
      <LoQueVaBien insights={insights} />
      <button type="button" className={BTN} onClick={descargar} disabled={ocupado}>
        <span aria-hidden="true">⬇</span> {ocupado ? "Generando…" : "Descargar imagen"}
      </button>
      <button type="button" className={BTN} onClick={whatsapp} disabled={ocupado}>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="#25d366" aria-hidden="true">
          <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2z" />
        </svg>
        Enviar por WhatsApp
      </button>
    </div>
  );
}
