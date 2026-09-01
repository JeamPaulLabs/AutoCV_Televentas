from dataclasses import dataclass
from dotenv import load_dotenv
from pathlib import Path
import os

# El .env vive en config/ junto a este módulo — nunca en la raíz del proyecto
_ENV_PATH = Path(__file__).parent / ".env"

REQUIRED = ["PG_HOST", "PG_DATABASE", "PG_USER", "PG_PASSWORD"]


@dataclass
class Settings:
    pg_host: str
    pg_port: int
    pg_database: str
    pg_user: str
    pg_password: str


def load() -> Settings:
    """
    Carga config/.env y valida que las variables de conexión a Postgres estén presentes.
    Este proyecto es solo lector de la réplica ilio en DataCenter_Vanti — no hay
    credenciales de portal ni configuración de navegador que cargar.
    """
    load_dotenv(_ENV_PATH)

    missing = [k for k in REQUIRED if not os.getenv(k)]
    if missing:
        raise ValueError(
            f"Variables de entorno faltantes: {missing}\n"
            f"Copiar config/.env.example a config/.env y completar los valores."
        )

    return Settings(
        pg_host=os.environ["PG_HOST"],
        pg_port=int(os.getenv("PG_PORT", 5432)),
        pg_database=os.environ["PG_DATABASE"],
        pg_user=os.environ["PG_USER"],
        pg_password=os.environ["PG_PASSWORD"],
    )
