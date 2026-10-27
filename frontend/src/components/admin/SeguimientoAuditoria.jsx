import { useEffect, useState } from "react";
import { guardarSeguimiento, listarSeguimiento } from "../../services/comoVamos";
import { INPUT, ROL_NOMBRE, Seccion, fmtMomento } from "./AuditoriaComun";

/** Hilo de seguimiento compartido por asesor y periodo: coordinación comercial y
 * auditoría interna dejan aquí lo que van acordando. Lo ven ambos. */
export default function SeguimientoAuditoria({ asesor, periodo, roles }) {
  const [lista, setLista] = useState(null);
  const [error, setError] = useState("");
  const [texto, setTexto] = useState("");
  const [rol, setRol] = useState(roles[0]);
  const [enviando, setEnviando] = useState(false);

  function cargar() {
    return listarSeguimiento(periodo, asesor)
      .then((r) => {
        setLista(r.seguimiento);
        setError("");
      })
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    setLista(null);
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asesor, periodo]);

  async function enviar() {
    if (!texto.trim()) return;
    setEnviando(true);
    try {
      await guardarSeguimiento({ periodo, asesor, rol, texto });
      setTexto("");
      await cargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <aside className="glass rounded-2xl p-4 space-y-3" aria-label="Seguimiento compartido">
      <Seccion titulo={`Seguimiento compartido${lista ? ` (${lista.length})` : ""}`}>
        {error && <p className="text-xs text-red-300">{error}</p>}
        {lista && lista.length === 0 && <p className="text-xs text-white/65">Aún no hay comentarios de seguimiento de este asesor.</p>}
        <ul className="space-y-2 max-h-64 overflow-auto">
          {(lista || []).map((m) => (
            <li key={m.id} className="rounded-lg bg-white/5 px-2.5 py-2 text-xs">
              <div className="flex items-center justify-between gap-2 text-[11px] text-white/65">
                <span>
                  <span className={`font-bold ${m.rol === "interna" ? "text-sky-300" : "text-xuma-green-dark"}`}>{ROL_NOMBRE[m.rol]}</span>
                  {m.autor_nombre ? ` · ${m.autor_nombre}` : ""}
                </span>
                <span>{fmtMomento(m.creado_en)}</span>
              </div>
              <p className="text-white/90 mt-0.5 whitespace-pre-wrap">{m.texto}</p>
            </li>
          ))}
        </ul>
      </Seccion>
      <div className="space-y-2">
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={2} maxLength={2000} placeholder="Agregar seguimiento…" className={INPUT} />
        <div className="flex items-center gap-2">
          {roles.length > 1 && (
            <select value={rol} onChange={(e) => setRol(e.target.value)} className={`${INPUT} !w-auto`} aria-label="Comentar como">
              {roles.map((r) => <option key={r} value={r}>{ROL_NOMBRE[r]}</option>)}
            </select>
          )}
          <button type="button" onClick={enviar} disabled={!texto.trim() || enviando} className="rounded-lg px-3 py-1.5 text-xs font-bold bg-xuma-green-dark text-xuma-bg-dark disabled:opacity-40">
            {enviando ? "Enviando…" : "Agregar"}
          </button>
        </div>
      </div>
    </aside>
  );
}
