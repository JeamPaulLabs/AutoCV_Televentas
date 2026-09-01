from contextlib import contextmanager

import psycopg2
import psycopg2.extras

from config import settings


@contextmanager
def get_conexion():
    """Conexión de solo lectura/escritura puntual a DataCenter_Vanti."""
    cfg = settings.load()
    conn = psycopg2.connect(
        host=cfg.pg_host,
        port=cfg.pg_port,
        dbname=cfg.pg_database,
        user=cfg.pg_user,
        password=cfg.pg_password,
    )
    try:
        yield conn
    finally:
        conn.close()


def fetch_df(query: str, params: dict | None = None):
    """Ejecuta un SELECT y devuelve un pandas.DataFrame."""
    import pandas as pd

    with get_conexion() as conn:
        return pd.read_sql(query, conn, params=params)
