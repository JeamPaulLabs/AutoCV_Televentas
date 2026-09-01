"""Comisión SERVI por plan (como_vamos_televentas.tarifas_planes) -- usada para
calcular la columna 'Facturación SERVI' del dashboard."""
from __future__ import annotations

import pandas as pd

from src.db import get_conexion
from src.metas_repo import normalizar_nombre


def leer_tarifas() -> pd.DataFrame:
    query = "SELECT plan, tarifa, comision_servi FROM como_vamos_televentas.tarifas_planes"
    with get_conexion() as conn:
        df = pd.read_sql(query, conn)
    df["plan_norm"] = df["plan"].map(normalizar_nombre)
    return df


def con_facturacion_servi(df_ventas: pd.DataFrame, df_tarifas: pd.DataFrame) -> pd.DataFrame:
    """Agrega la columna facturacion_servi = comision_servi del plan vendido.
    Planes sin tarifa registrada quedan en 0 (se listan aparte para revisión)."""
    df = df_ventas.copy()
    df["plan_norm"] = df["plan"].map(normalizar_nombre)
    df = df.merge(df_tarifas[["plan_norm", "comision_servi"]], on="plan_norm", how="left")
    df["facturacion_servi"] = df["comision_servi"].fillna(0)
    return df.drop(columns=["plan_norm", "comision_servi"])


def planes_sin_tarifa(df_con_facturacion: pd.DataFrame) -> list[str]:
    sin = df_con_facturacion[df_con_facturacion["facturacion_servi"] == 0]
    return sorted(sin["plan"].dropna().unique().tolist())
