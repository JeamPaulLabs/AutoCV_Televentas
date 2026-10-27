"""Lectura de metas por asesor (como_vamos_televentas.metas)."""
from __future__ import annotations

import datetime as dt
import re
import unicodedata

import pandas as pd

from src.db import get_conexion


def normalizar_nombre(nombre: str) -> str:
    """Mayúsculas, espacios colapsados y SIN tildes (para comparar en Python
    contra asesor_norm, que en la BD solo colapsa espacios/mayúsculas -- ver
    quitar_tildes_sql más abajo para el mismo criterio en SQL)."""
    if not isinstance(nombre, str):
        return ""
    limpio = re.sub(r"\s+", " ", nombre).strip().upper()
    sin_tildes = unicodedata.normalize("NFKD", limpio).encode("ascii", "ignore").decode("ascii")
    return sin_tildes


ALIAS_NOMBRE_META = {"JESUS CAMPO": "JESUS ADRIAN CAMPO ALVAREZ"}


def leer_metas(periodo: dt.date) -> pd.DataFrame:
    """
    asesor_norm se recalcula en Python (sin tildes) en vez de usar la columna
    generada de la BD (que solo colapsa espacios/mayúsculas, sin quitar
    tildes) -- necesario porque el acta escaneada y el nombre en Ilio no
    siempre coinciden en acentuación (ej. 'GUZMAN' vs 'GUZMÁN').
    """
    query = """
        SELECT asesor, categoria,
               meta_escala_1, base_pago_escala_1,
               meta_escala_2, base_pago_escala_2,
               meta_escala_3, base_pago_escala_3, observaciones
        FROM como_vamos_televentas.metas
        WHERE periodo = %(periodo)s
    """
    with get_conexion() as conn:
        df = pd.read_sql(query, conn, params={"periodo": periodo})
    # El acta de octubre trae al asesor como "JESUS CAMPO"; en Ilio es
    # "JESUS ADRIAN CAMPO ALVAREZ". Se unifica aquí para que su meta concilie.
    df["asesor"] = df["asesor"].replace(ALIAS_NOMBRE_META)
    df["asesor_norm"] = df["asesor"].map(normalizar_nombre)
    return df


def asesores_sin_meta(df_ilio: pd.DataFrame, df_metas: pd.DataFrame, excluidos: set[str] | None = None) -> list[str]:
    """Asesores que vendieron en el periodo pero no tienen fila en metas (nombre no
    concilia) y que tampoco están en config/asesores_excluidos.yml."""
    vendieron = set(df_ilio["asesor"].dropna().map(normalizar_nombre))
    con_meta = set(df_metas["asesor_norm"])
    excluidos = excluidos or set()
    return sorted(vendieron - con_meta - excluidos)
