import { useEffect, useState } from "react";

/** loading/error/data + reintento; cancela el efecto si el componente se
 * desmonta antes de que resuelva (ver .claude/skills/desarrollador-portal). */
export function useFetch(fn, deps) {
  const [estado, setEstado] = useState({ loading: true, error: null, data: null });
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let vivo = true;
    setEstado((s) => ({ ...s, loading: true, error: null }));

    fn()
      .then((data) => {
        if (vivo) setEstado({ loading: false, error: null, data });
      })
      .catch((err) => {
        if (vivo) setEstado({ loading: false, error: err.message, data: null });
      });

    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, intento]);

  return { ...estado, reintentar: () => setIntento((n) => n + 1) };
}
