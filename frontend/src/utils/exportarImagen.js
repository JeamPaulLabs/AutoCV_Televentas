import { toBlob } from "html-to-image";

const ANCHO_MAX_PX = 2560;

const siguienteCuadro = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

/** Marca de tiempo local para los nombres de archivo: 20261027_153045. */
export function marcaTiempo(fecha = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${fecha.getFullYear()}${p(fecha.getMonth() + 1)}${p(fecha.getDate())}_${p(fecha.getHours())}${p(fecha.getMinutes())}${p(fecha.getSeconds())}`;
}

/** Genera un PNG del nodo con fondo solido y la cabecera con logo. Se captura una
 * COPIA del nodo, fuera de pantalla y con el mismo ancho, para que el tablero
 * visible no cambie ni parpadee mientras se descarga. La resolucion se ajusta
 * para que la imagen mida ~2560 px de ancho. Ver reglas `.capturando` en index.css. */
export async function nodoAPng(nodo, { fondo }) {
  const ancho = nodo.offsetWidth;
  const contenedor = document.createElement("div");
  contenedor.setAttribute("aria-hidden", "true");
  contenedor.style.cssText = `position:fixed;left:-100000px;top:0;width:${ancho}px;pointer-events:none;`;
  const copia = nodo.cloneNode(true);
  copia.classList.add("capturando");
  contenedor.appendChild(copia);
  document.body.appendChild(contenedor);
  try {
    await siguienteCuadro();
    const pixelRatio = Math.min(3, Math.max(1, ANCHO_MAX_PX / ancho));
    const blob = await toBlob(copia, { pixelRatio, backgroundColor: fondo, cacheBust: true });
    if (!blob) throw new Error("No se pudo generar la imagen");
    return blob;
  } finally {
    contenedor.remove();
  }
}

export function descargarBlob(blob, nombreArchivo) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Intenta mandar la imagen a WhatsApp de la mejor forma disponible.
 * Devuelve cómo terminó, para que la pantalla le diga al usuario qué sigue:
 *  - "compartido":   se abrió el menú de compartir del sistema con la imagen
 *  - "portapapeles": imagen copiada; se abrió WhatsApp, basta pegarla (Ctrl+V)
 *  - "descargada":   imagen descargada; se abrió WhatsApp, hay que adjuntarla
 *  - "cancelado":    el usuario cerró el menú de compartir
 * Compartir archivos y usar el portapapeles exigen HTTPS (o localhost); en la
 * red interna por http solo queda la última opción. */
export async function enviarPorWhatsApp(blob, nombreArchivo, texto) {
  const archivo = new File([blob], nombreArchivo, { type: "image/png" });
  if (navigator.canShare?.({ files: [archivo] })) {
    try {
      await navigator.share({ files: [archivo], text: texto });
      return "compartido";
    } catch (e) {
      if (e?.name === "AbortError") return "cancelado";
    }
  }
  const urlWa = `https://wa.me/?text=${encodeURIComponent(texto)}`;
  if (navigator.clipboard?.write && window.ClipboardItem) {
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      window.open(urlWa, "_blank", "noopener");
      return "portapapeles";
    } catch {
      /* sin permiso de portapapeles: se cae a la descarga */
    }
  }
  descargarBlob(blob, nombreArchivo);
  window.open(urlWa, "_blank", "noopener");
  return "descargada";
}

export const AVISO_WHATSAPP = {
  compartido: "",
  cancelado: "",
  portapapeles: "Imagen copiada. En WhatsApp, pégala en el chat (Ctrl+V).",
  descargada: "Imagen descargada. En WhatsApp, adjúntala al chat (clip 📎 o arrástrala).",
};
