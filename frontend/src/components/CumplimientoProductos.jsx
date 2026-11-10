import { fmtPct } from "../utils/formato";

/** Cumplimiento del guion por producto (% por criterio de auditoría).
 *
 * Premisa del proceso: TODA venta pasa por auditoría; la que quedó en alta o
 * auditada sin cancelación cumplió todos los criterios. El denominador es el
 * total de ventas del producto en el mes; las fallas salen de las canceladas
 * revisadas. Las fallas técnicas de audio NO restan (no son del asesor).
 * BP y RS aparecen "pendiente" hasta que se cargue su guion.
 */

const fmt = (n) => Number(n || 0).toLocaleString("es-CO");

function colorPct(pct) {
  if (pct >= 0.95) return "text-xuma-green-dark";
  if (pct >= 0.85) return "text-amber-300";
  return "text-red-300";
}

function FilaCriterio({ c }) {
  const limpio = c.fallas === 0;
  return (
    <li>
      <div className="flex items-baseline justify-between gap-2 text-xs mb-0.5">
        <span className="truncate pr-2 text-white/85">{c.nombre}</span>
        <span className="flex-none tabular-nums">
          <span className={`font-semibold ${limpio ? "text-xuma-green-dark" : colorPct(c.pct)}`}>
            {limpio ? "✓ 100%" : fmtPct(c.pct)}
          </span>
          {c.fallas > 0 && (
            <span className="text-white/50"> · {fmt(c.fallas)} hallazgo{c.fallas === 1 ? "" : "s"}</span>
          )}
          {c.fallas === 0 && c.fallas_audio > 0 && (
            <span className="text-sky-200/80"> · solo audio ({fmt(c.fallas_audio)})</span>
          )}
        </span>
      </div>
      <div className="h-1 rounded-full bg-white/10 overflow-hidden" aria-hidden="true">
        <div
          className={`h-full rounded-full ${c.pct >= 0.95 ? "bg-xuma-green-dark" : c.pct >= 0.85 ? "bg-amber-300" : "bg-red-300"}`}
          style={{ width: `${Math.max(c.pct * 100, 2)}%` }}
        />
      </div>
    </li>
  );
}

export function TarjetaProducto({ p }) {
  if (p.pendiente) {
    return (
      <div className="rounded-xl border border-dashed border-white/20 px-3.5 py-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-white/80">{p.nombre}</div>
          <div className="text-[11px] text-white/55">
            {fmt(p.total_audios)} venta{p.total_audios === 1 ? "" : "s"} del mes
            {p.canceladas_revisadas > 0 && ` · ${fmt(p.canceladas_revisadas)} con revisión`}
          </div>
        </div>
        <span className="flex-none rounded-full px-2.5 py-1 text-[11px] bg-white/10 text-white/70">
          Guion pendiente de cargar
        </span>
      </div>
    );
  }
  return (
    <div className="rounded-xl bg-white/5 px-3.5 py-3 space-y-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-white">{p.nombre}</div>
          <div className="text-[11px] text-white/55">
            {fmt(p.total_audios)} venta{p.total_audios === 1 ? "" : "s"} auditada{p.total_audios === 1 ? "" : "s"} ·{" "}
            {fmt(p.canceladas_revisadas)} con cancelación revisada
          </div>
        </div>
        <div className={`flex-none text-xl font-extrabold tabular-nums ${colorPct(p.pct_global)}`}>
          {fmtPct(p.pct_global)}
        </div>
      </div>
      <ul className="space-y-1.5">
        {p.criterios.map((c) => <FilaCriterio key={c.id} c={c} />)}
      </ul>
    </div>
  );
}

export default function CumplimientoProductos({ productos, titulo = "Cumplimiento del guion por producto" }) {
  if (!productos || productos.length === 0) return null;
  const conGuion = productos.filter((p) => !p.pendiente);
  const pendientes = productos.filter((p) => p.pendiente);
  return (
    <section className="glass rounded-2xl p-4 space-y-3">
      <h2 className="text-sm font-extrabold text-white uppercase tracking-wide">{titulo}</h2>
      <div className={`grid gap-3 ${conGuion.length > 1 ? "md:grid-cols-2" : ""}`}>
        {conGuion.map((p) => <TarjetaProducto key={p.producto} p={p} />)}
      </div>
      {pendientes.length > 0 && (
        <div className="grid gap-2 md:grid-cols-2">
          {pendientes.map((p) => <TarjetaProducto key={p.producto} p={p} />)}
        </div>
      )}
      <p className="text-[11px] text-white/50">
        Toda venta del mes pasa por auditoría: una venta que quedó en alta o auditada sin cancelación
        cumplió todos los criterios del guion. Las fallas técnicas de audio no restan en el porcentaje.
      </p>
    </section>
  );
}
