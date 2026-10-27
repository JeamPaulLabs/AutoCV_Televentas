import { useCallback, useEffect, useState } from "react";

const TEMA_KEY = "como-vamos-televentas:tema";

function temaInicial() {
  try {
    const guardado = localStorage.getItem(TEMA_KEY);
    if (guardado === "claro" || guardado === "oscuro") return guardado;
  } catch {
    /* localStorage no disponible */
  }
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "claro" : "oscuro";
}

/** Tema claro/oscuro: se guarda la elección y se aplica la clase en <html>. */
export function useTema() {
  const [tema, setTema] = useState(temaInicial);

  useEffect(() => {
    document.documentElement.classList.toggle("tema-claro", tema === "claro");
    try {
      localStorage.setItem(TEMA_KEY, tema);
    } catch {
      /* se pierde la preferencia al recargar */
    }
  }, [tema]);

  const alternar = useCallback(() => setTema((t) => (t === "claro" ? "oscuro" : "claro")), []);
  return { tema, alternar };
}
