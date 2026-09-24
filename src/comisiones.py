"""Esquema de comisiones por periodo (config/esquema_comisiones.yml)."""
from __future__ import annotations

import datetime as dt
from pathlib import Path

import pandas as pd
import yaml

from src.ilio_repo import ESTADOS_POSITIVOS

_YML_PATH = Path(__file__).parent.parent / "config" / "esquema_comisiones.yml"


def cargar_esquema(periodo: dt.date) -> dict | None:
    """Parámetros del otrosí del periodo, o None si no hay otrosí activo."""
    if not _YML_PATH.exists():
        return None
    data = yaml.safe_load(_YML_PATH.read_text(encoding="utf-8")) or {}
    esquema = (data.get("periodos") or {}).get(f"{periodo:%Y-%m}")
    return esquema if esquema and esquema.get("otrosi_activo") else None


def estado_otrosi(periodo: dt.date, *dfs_ventas: pd.DataFrame) -> dict | None:
    """Avance del equipo hacia la condición general del otrosí: altas positivas
    (Cuota Protegida + Rueda Segura) contra la meta de equipo."""
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
        "meta_equipo_altas_positivas": meta,
        "altas_positivas": altas,
        "pct_avance": altas / meta if meta else 0.0,
        "pct_minimo_comision": esquema["pct_minimo_comision"],
        "condicion_equipo_cumplida": altas >= meta,
    }
