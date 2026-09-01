# ============================================================================
# Como Vamos Televentas — imagen única para Coolify (mismo patrón que
# 02_CRM/03_Cantadas/Dockerfile, ya probado en producción). Etapa 1 compila
# la SPA (Vite). Etapa 2: FastAPI sirve API + SPA en :8001.
#
# Variables de entorno requeridas en el despliegue (Coolify → Environment):
#   PG_HOST, PG_PORT, PG_DATABASE, PG_USER, PG_PASSWORD
#   JWT_SECRET   (el MISMO de CRMXuma/ActiXuma/Cantadas -- sin esto no hay SSO)
#
# Requisito no negociable: debe quedar en el MISMO origen (mismo host) que
# el portal CRMXuma para que la cookie xuma_session (HttpOnly, SameSite=Lax)
# viaje -- en la VM interna eso ya lo resuelve Nginx (server_name "_" en
# /etc/nginx/sites-enabled/operatividad, mismo patrón que /cantadas).
# ============================================================================

FROM node:22-alpine AS frontend
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/index.html frontend/vite.config.js ./
COPY frontend/src ./src
# Ruta base bajo la que se sirve la SPA (debe coincidir con url_base en
# directorio.apps y con el location de Nginx). Por defecto /comovamos/.
ARG VITE_BASE_PATH=/comovamos/
ENV VITE_BASE_PATH=$VITE_BASE_PATH
RUN npm run build

FROM python:3.12-slim
WORKDIR /app

COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend/app ./backend/app
COPY src ./src
COPY config/__init__.py config/settings.py config/asesores_excluidos.yml config/Secuencia.yml ./config/
COPY --from=frontend /build/dist ./backend/static

EXPOSE 8001
# --proxy-headers: detrás del proxy de Nginx conserva IP y esquema reales.
CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8001", "--proxy-headers", "--forwarded-allow-ips", "*"]
