import { useCallback, useEffect, useRef, useState } from "react";
import { obtenerDashboard } from "../services/comoVamos";

/** Como solo hay 2 periodos fijos (agosto/septiembre), cachea la respuesta
 * de cada uno en memoria: cambiar de mes ya visitado es instantáneo (sin
 * spinner ni golpe al backend), y sigue refrescando en segundo plano para
 * no quedarse con datos viejos si el usuario se queda un rato en la
 * pestaña. Antes cada cambio de mes repetía todo el pipeline pesado del
 * backend desde cero (leer_televentas + metas + tarifas + proyección). */
export function useDashboardCache(periodo) {
  const cache = useRef(new Map());
  const [data, setData] = useState(() => cache.current.get(periodo) ?? null);
  const [loading, setLoading] = useState(!cache.current.has(periodo));
  const [error, setError] = useState(null);
  const [intento, setIntento] = useState(0);

  const cargar = useCallback(
    (mostrarSpinner) => {
      let vivo = true;
      if (mostrarSpinner) setLoading(true);
      setError(null);

      obtenerDashboard(periodo)
        .then((res) => {
          if (!vivo) return;
          cache.current.set(periodo, res);
          setData(res);
          setLoading(false);
        })
        .catch((err) => {
          if (!vivo) return;
          setError(err.message);
          setLoading(false);
        });

      return () => {
        vivo = false;
      };
    },
    [periodo]
  );

  useEffect(() => {
    const enCache = cache.current.get(periodo);
    if (enCache) {
      // Cambio a un mes ya visitado: se ve de inmediato con lo cacheado,
      // y se refresca calladito por si cambió algo desde la última vez.
      setData(enCache);
      setLoading(false);
      return cargar(false);
    }
    return cargar(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo, intento, cargar]);

  return { data, loading, error, reintentar: () => setIntento((n) => n + 1) };
}
