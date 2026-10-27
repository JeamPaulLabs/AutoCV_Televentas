import { useState } from "react";

export default function Tabs({ tabs }) {
  const [activa, setActiva] = useState(tabs[0].id);

  return (
    <div>
      <div className="flex items-end justify-between gap-3 flex-wrap border-b border-white/15 mb-3">
      <div className="flex gap-1" role="tablist" aria-label="Secciones del dashboard">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={activa === t.id}
            onClick={() => setActiva(t.id)}
            className={`px-3 py-1.5 text-sm font-semibold border-b-2 -mb-px transition-colors duration-200 ${
              activa === t.id
                ? "text-xuma-green-light border-xuma-green-light"
                : "text-white/60 border-transparent hover:text-white/85"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {/* Las vistas pueden pintar aquí sus acciones (ver ReporteResumen) */}
      <div id="acciones-tab" className="pb-1" />
      </div>
      {tabs.map((t) => (
        <div key={t.id} role="tabpanel" hidden={activa !== t.id}>
          {activa === t.id && t.content}
        </div>
      ))}
    </div>
  );
}
