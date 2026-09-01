"""
Reporte de auditoría de ventas 'Rueda Seguro' (hoja RS del formato de
Escucha/Auditoría de Ventas), leído directo del Excel sincronizado por
OneDrive -- sin necesidad de credenciales de SharePoint/Graph, porque el
archivo ya llega a disco vía la sincronización normal de OneDrive.

Uso:
  python scripts/reporte_ruedas_seguro.py
  python scripts/reporte_ruedas_seguro.py --archivo "C:\\ruta\\a\\otro.xlsx"

Para automatizarlo sin intervención manual: programar esta misma llamada en
el Programador de tareas de Windows (ej. cada mañana) -- como OneDrive ya
mantiene el archivo local actualizado solo, no hace falta descargarlo ni
autenticarse contra SharePoint en cada corrida.
"""
from __future__ import annotations

import argparse
import datetime as dt
import glob
import os
from pathlib import Path

import pandas as pd

HOJA = "RS"
NOMBRE_ARCHIVO_PATRON = "*AUDITORIA*VENTAS*.xlsx"
OUT_DIR = Path(__file__).parent.parent / "out" / "ruedas_seguro"


def _localizar_archivo() -> Path:
    home = Path(os.path.expanduser("~"))
    candidatos = glob.glob(
        str(home / "OneDrive*" / "**" / NOMBRE_ARCHIVO_PATRON), recursive=True
    )
    if not candidatos:
        raise FileNotFoundError(
            "No encontré el Excel de auditoría de ventas en ninguna carpeta "
            "OneDrive* de este usuario. Pasa la ruta explícita con --archivo."
        )
    return Path(candidatos[0])


def leer_rs(ruta_archivo: Path) -> pd.DataFrame:
    df = pd.read_excel(ruta_archivo, sheet_name=HOJA, engine="openpyxl")
    df = df.dropna(axis=1, how="all")  # columna vacía final del formato
    df.columns = [str(c).strip() for c in df.columns]
    return df


def main() -> None:
    ap = argparse.ArgumentParser(description="Reporte hoja RS -- Rueda Seguro")
    ap.add_argument("--archivo", default=None, help="Ruta al .xlsx (si no, se busca en OneDrive)")
    args = ap.parse_args()

    ruta = Path(args.archivo) if args.archivo else _localizar_archivo()
    print(f"Leyendo: {ruta}")

    df = leer_rs(ruta)
    print(f"Registros en hoja '{HOJA}': {len(df)}")

    if "ESTADO DE LA VENTA" in df.columns:
        print("\nPor estado de la venta:")
        print(df["ESTADO DE LA VENTA"].value_counts().to_string())

    if "ASESOR" in df.columns:
        print("\nPor asesor:")
        print(df["ASESOR"].value_counts().to_string())

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = dt.datetime.now().strftime("%Y%m%d_%H%M%S")
    salida_xlsx = OUT_DIR / f"RS_rueda_seguro_{timestamp}.xlsx"
    salida_csv = OUT_DIR / f"RS_rueda_seguro_{timestamp}.csv"
    df.to_excel(salida_xlsx, index=False)
    df.to_csv(salida_csv, index=False, encoding="utf-8-sig")

    print(f"\nReporte generado: {salida_xlsx}")
    print(f"Reporte generado: {salida_csv}")


if __name__ == "__main__":
    main()
