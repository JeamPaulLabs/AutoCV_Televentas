import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Rutas relativas /api/... en el frontend (services/api.js); en dev el proxy
// las manda al backend FastAPI en 8001, igual que el patrón de Cantadas
// (ver .claude/skills/desarrollador-portal) -- así el código no cambia el
// día que esto se sirva same-origin detrás de Nginx en el portal.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // En producción se sirve bajo /comovamos/ en el MISMO origen que el CRM
  // (Nginx en la VM interna) -- la cookie xuma_session solo viaja same-site.
  // En dev queda en "/" (default) para que el proxy de abajo siga sirviendo
  // igual en localhost:5173.
  base: process.env.VITE_BASE_PATH || "/",
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8001",
        changeOrigin: true,
      },
    },
  },
});
