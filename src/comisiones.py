"""Esquema de comisiones / otrosí por periodo.

Fuente principal: tabla como_vamos_televentas.esquema_comisiones (ver
sql/ddl_esquema_comisiones.sql). Si la tabla aún no existe o no tiene el
periodo, se usa config/esquema_comisiones.yml como respaldo.
"""
from __future__ import annotations

import datetime as dt
from pathlib import Path

import pandas as pd
import yaml

from src.db import get_conexion
from src.ilio_repo import ESTADOS_POSITIVOS

_YML_PATH = Path(__file__).parent.parent / "config" / "esquema_comisiones.yml"


def _desde_bd(periodo: dt.date) -> dict | None:
    query = """
        SELECT otrosi_activo, documento, fecha_documento,
               meta_equipo_altas_positivas, pct_minimo_comision, reglas
        FROM como_vamos_televentas.esquema_comisiones
        WHERE periodo = %s
    """
    try:
        with get_conexion() as conn:
            cur = conn.cursor()
            cur.execute(query, (periodo.replace(day=1),))
            fila = cur.fetchone()
    except Exception:  # tabla inexistente o BD no disponible -> respaldo YAML
        return None
    if fila is None:
        return None
    activo, documento, fecha_doc, meta, pct, reglas = fila
    return {
        "otrosi_activo": activo,
        "documento": documento,
        "fecha_documento": fecha_doc.isoformat() if fecha_doc else None,
        "meta_equipo_altas_positivas": meta,
        "pct_minimo_comision": float(pct),
        "reglas": reglas or [],
    }


def _desde_yaml(periodo: dt.date) -> dict | None:
    if not _YML_PATH.exists():
        return None
    data = yaml.safe_load(_YML_PATH.read_text(encoding="utf-8")) or {}
    esquema = (data.get("periodos") or {}).get(f"{periodo:%Y-%m}")
    return {"reglas": [], **esquema} if esquema else None


def cargar_esquema(periodo: dt.date) -> dict | None:
    """Parámetros del otrosí del periodo, o None si no hay otrosí activo."""
    esquema = _desde_bd(periodo) or _desde_yaml(periodo)
    return esquema if esquema and esquema.get("otrosi_activo") else None


def estado_otrosi(periodo: dt.date, *dfs_ventas: pd.DataFrame) -> dict | None:
    """Reglas del otrosí y avance del equipo hacia la condición general:
    altas positivas (Cuota Protegida + Billetera Protegida + Rueda Segura)
    contra la meta de equipo. Billetera Protegida ya viene dentro del df de
    ventas consolidado (ver ilio_repo.leer_televentas), así que cuenta sola."""
    esquema = cargar_esquema(periodo)
    if esquema is None:
        return None
    altas = sum(
        int(df["nombre_estado"].isin(ESTADOS_POSITIVOS).sum())
        for df in dfs_ventas if not df.empty and "nombre_estado" in df.columns
    )
    meta = esquema["meta_equipo_altas_positivas"]
    return {
        "documento": esquema.get("documento", ""),
        "fecha_documento": esquema.get("fecha_documento"),
        "reglas": esquema.get("reglas", []),
        "meta_equipo_altas_positivas": meta,
        "altas_positivas": altas,
        "pct_avance": altas / meta if meta else 0.0,
        "pct_minimo_comision": esquema["pct_minimo_comision"],
        "condicion_equipo_cumplida": altas >= meta,
    }
