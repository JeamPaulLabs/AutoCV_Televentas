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
    """Ve el tablero completo del equipo (con facturación incluida) quien
    tiene admin_alcance='televentas' (hoy: Martha) o es superadmin del
    portal (acceso total, igual que en el resto del CRM -- ver
    _apps_permitidas en CRMXuma/backend/app/routers/auth.py)."""
    return current.get("admin_alcance") == "televentas" or current.get("rol") == "superadmin"


# Usuarios del área de televentas que pueden alternar a la vista administrativa
# (equipo, con facturación) además de su vista personal. Lista por id_persona
# del directorio (el `sub` del JWT). Martha y Jeam Paul ya entran por ser
# supervisor/superadmin; Kevin, Isaac y Orlando se habilitan aquí a pedido del
# dueño del proyecto (2026-10-21).
USUARIOS_VISTA_ADMINISTRATIVA = {30, 27, 3, 28, 31, 29}  # Martha, Jeam Paul (x2), Kevin, Isaac, Orlando


def puede_ver_vista_equipo(current: dict) -> bool:
    """True si el usuario puede solicitar la vista 'equipo' (administrativa)
    del tablero, ya sea por ser supervisor/superadmin o por estar en la lista
    de usuarios habilitados."""
    if es_supervisor_televentas(current):
        return True
    try:
        return int(current.get("sub")) in USUARIOS_VISTA_ADMINISTRATIVA
    except (TypeError, ValueError):
        return False


# Auditoría por asesor (pestaña "Auditoría"): dos miradas independientes.
#  - comercial: coordinadora comercial (Martha, id_persona 30) -- y quien tenga
#    alcance de supervisión de televentas / superadmin.
#  - interna: auditor de calidad (Kevin, id_persona 28) -- y el superadmin.
# Ambos pueden VER las auditorías de los dos tipos; solo guardan la propia.
AUDITORES_COMERCIALES = {30}
AUDITORES_INTERNOS = {28}


def roles_auditoria(current: dict) -> set[str]:
    roles: set[str] = set()
    try:
        sub = int(current.get("sub"))
    except (TypeError, ValueError):
        sub = None
    if sub in AUDITORES_COMERCIALES or es_supervisor_televentas(current):
        roles.add("comercial")
    if sub in AUDITORES_INTERNOS or current.get("rol") == "superadmin":
        roles.add("interna")
    return roles
