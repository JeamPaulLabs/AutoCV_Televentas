import { toBlob } from "html-to-image";

const ANCHO_CAPTURA = 1280;

const siguienteCuadro = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

/** Genera un PNG del nodo a un ancho fijo (el mismo diseño de PC aunque la
 * pantalla sea pequeña), con las tablas desplegadas completas y fondo sólido.
 * Ver reglas `.capturando` en index.css. */
export async function nodoAPng(nodo, { fondo }) {
  const anchoPrevio = nodo.style.width;
  nodo.classList.add("capturando");
  nodo.style.width = `${ANCHO_CAPTURA}px`;
  try {
    // Dos cuadros para que el layout se acomode al ancho fijo y un respiro para
    // que los gráficos que miden su contenedor (ResizeObserver) se redibujen.
    await siguienteCuadro();
    await new Promise((r) => setTimeout(r, 200));
    await siguienteCuadro();
    const blob = await toBlob(nodo, { pixelRatio: 2, backgroundColor: fondo, cacheBust: true });
    if (!blob) throw new Error("No se pudo generar la imagen");
    return blob;
  } finally {
    nodo.classList.remove("capturando");
    nodo.style.width = anchoPrevio;
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
