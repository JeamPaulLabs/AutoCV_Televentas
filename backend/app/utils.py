"""Utilidades de serialización para las respuestas JSON del API."""
from __future__ import annotations

import json

import pandas as pd


def df_records(df: pd.DataFrame) -> list[dict]:
    """Convierte un DataFrame a list[dict] serializable a JSON, delegando en
    pandas.to_json (maneja numpy/NaN/fechas correctamente) y reparseando a
    tipos nativos de Python."""
    if df.empty:
        return []
    return json.loads(df.to_json(orient="records", date_format="iso"))
