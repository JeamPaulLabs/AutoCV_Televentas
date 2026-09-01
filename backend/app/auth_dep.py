"""Valida la cookie de sesión del portal Xuma (mismo JWT que CRMXuma /
ActiXuma). Copiado de backend/app/auth_dep.py de CRMXuma, versión ligera
(sin chequeo de revocación: este proyecto es de solo lectura interna, no
login público) -- ver 17_CRMXuma/.claude/skills/desarrollador-portal.
"""
import os
from pathlib import Path
from typing import Optional

import jwt
from dotenv import load_dotenv
from fastapi import Cookie, HTTPException

# config/settings.py solo carga el .env de forma perezosa (al primer acceso
# a Postgres) -- este módulo se importa al arrancar FastAPI, antes de
# cualquier request, así que hay que cargarlo aquí explícitamente o
# JWT_SECRET queda vacío.
load_dotenv(Path(__file__).resolve().parents[2] / "config" / ".env")

JWT_SECRET = os.getenv("JWT_SECRET", "")
JWT_ALGORITHM = "HS256"
COOKIE_NAME = "xuma_session"


def get_current_user(session_token: Optional[str] = Cookie(default=None, alias=COOKIE_NAME)) -> dict:
    if not JWT_SECRET:
        raise HTTPException(500, "JWT_SECRET no está configurado en este servicio")
    if not session_token:
        raise HTTPException(401, "No hay sesión activa -- inicia sesión en el portal Xuma")

    try:
        payload = jwt.decode(session_token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "La sesión expiró, inicia sesión de nuevo")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Sesión inválida")

    return payload


def es_supervisor_televentas(current: dict) -> bool:
    """Solo quien tiene admin_alcance='televentas' (hoy: Martha) ve el
    tablero completo del equipo, con facturación incluida."""
    return current.get("admin_alcance") == "televentas"
