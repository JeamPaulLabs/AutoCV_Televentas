"""API 'Como Vamos Televentas'.

Valida la sesión reutilizando la cookie xuma_session del portal Xuma
(auth_dep.py, copiado de CRMXuma, ver .claude/skills/desarrollador-portal).
Se despliega en la red interna, mismo origen que el CRM (Nginx en la VM,
server_name "_", mismo patrón que /cantadas) para que la cookie de sesión
del login por token viaje sola -- sin eso no hay SSO.

Dev: python -m uvicorn backend.app.main:app --reload --port 8001
"""
from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .routers import como_vamos

app = FastAPI(title="Como Vamos Televentas API")

# allow_credentials=True (se necesita para que el navegador mande la cookie
# xuma_session) exige listar orígenes explícitos -- "*" no es válido con
# credenciales. En producción same-origin (Nginx) esto ni se usa, es solo
# para dev con el frontend en Vite (:5173).
origins = [o.strip() for o in os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173",
).split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["*"],
)



@app.middleware("http")
async def sin_cache_obsoleto(request: Request, call_next):
    """El navegador no debe quedarse con una versión vieja del tablero: la API
    nunca se cachea y el index.html se revalida en cada visita (así, tras un
    deploy, cada PC baja los assets nuevos -- esos llevan hash en el nombre y
    sí se pueden cachear sin riesgo)."""
    response = await call_next(request)
    path = request.url.path
    if path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
    elif path.startswith("/comovamos") and not path.startswith("/comovamos/assets/"):
        response.headers["Cache-Control"] = "no-cache"
    return response


app.include_router(como_vamos.router, prefix="/api/como-vamos", tags=["como-vamos"])


@app.get("/api/health")
def health():
    return {"status": "ok"}


# En producción (imagen Docker/Coolify) el build de Vite se copia a
# backend/static y este mismo proceso FastAPI sirve la SPA y la API, en el
# mismo origen que el portal (la cookie de sesión solo viaja same-site). El
# build usa base='/comovamos/' (vite.config.js / Dockerfile ARG
# VITE_BASE_PATH), así que el HTML referencia sus assets como
# /comovamos/assets/... — el mount debe vivir en ese mismo prefijo. En
# desarrollo esta carpeta no existe y el frontend corre aparte en Vite.
_static = Path(__file__).resolve().parents[1] / "static"
if _static.is_dir():
    app.mount("/comovamos", StaticFiles(directory=_static, html=True), name="spa")
