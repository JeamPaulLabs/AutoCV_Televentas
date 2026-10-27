/** Título de sección de la vista administrativa (antes la misma cadena de
 * clases se repetía ~10 veces en App.jsx). */
export default function SeccionTitulo({ children, className = "" }) {
  return (
    <h3
      className={`text-xs uppercase tracking-wide text-white/75 font-bold border-b-2 border-xuma-green-dark pb-1 mb-2 ${className}`}
    >
      {children}
    </h3>
  );
}
