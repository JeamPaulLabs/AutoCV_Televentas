const Bloque = ({ className = "", style }) => (
  <div style={style} className={`rounded-xl bg-white/10 animate-pulse motion-reduce:animate-none ${className}`} />
);

const Tarjeta = ({ className = "", children }) => <div className={`glass rounded-2xl p-4 ${className}`}>{children}</div>;

/** Marco gris de la pantalla mientras llega el Como vamos: mismas zonas que el
 * reporte (tarjetas, tabla, gráfica) para que no salte el diseño al cargar. */
export default function Esqueleto() {
  return (
    <div className="space-y-3" role="status" aria-live="polite" aria-label="Cargando el Como vamos">
      <span className="sr-only">Cargando el Como vamos…</span>
      <div className="glass rounded-full p-1 inline-flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <Bloque key={i} className="h-6 w-24 !rounded-full" />
        ))}
      </div>

      <div className="grid xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-3">
        <div className="grid grid-cols-2 gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Tarjeta key={i} className="space-y-2">
              <Bloque className="h-3 w-1/2" />
              <Bloque className="h-7 w-2/3" />
              <Bloque className="h-3 w-1/3" />
            </Tarjeta>
          ))}
        </div>
        <Tarjeta className="space-y-2">
          <Bloque className="h-3 w-24" />
          {[0, 1, 2].map((i) => (
            <Bloque key={i} className="h-9 w-full" />
          ))}
        </Tarjeta>
      </div>

      <div className="grid xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] gap-3">
        <Tarjeta className="space-y-1.5">
          <Bloque className="h-3 w-40" />
          {Array.from({ length: 10 }, (_, i) => (
            <Bloque key={i} className="h-5 w-full" />
          ))}
        </Tarjeta>
        <div className="space-y-3">
          <Tarjeta className="space-y-2">
            <Bloque className="h-3 w-48" />
            <div className="flex items-end gap-1 h-32">
              {[40, 65, 50, 80, 60, 90, 45, 70, 55, 85, 35, 60].map((h, i) => (
                <Bloque key={i} className="flex-1" style={{ height: `${h}%` }} />
              ))}
            </div>
          </Tarjeta>
          <div className="grid sm:grid-cols-2 gap-3">
            <Tarjeta className="space-y-1.5">
              {[0, 1, 2, 3].map((i) => (
                <Bloque key={i} className="h-5 w-full" />
              ))}
            </Tarjeta>
            <Tarjeta className="space-y-2">
              {[0, 1, 2].map((i) => (
                <Bloque key={i} className="h-4 w-full" />
              ))}
            </Tarjeta>
          </div>
        </div>
      </div>
    </div>
  );
}
