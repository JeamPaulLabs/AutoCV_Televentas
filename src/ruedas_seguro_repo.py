"""Lectura de la hoja 'RS' (Rueda Seguro) del formato de Auditoría de Ventas
(Proceso Escucha), sincronizado por OneDrive desde SharePoint -- no requiere
credenciales de Graph/SharePoint porque el archivo ya llega a disco vía la
sincronización normal de OneDrive del usuario."""
from __future__ import annotations

import datetime as dt
import glob
import os
from pathlib import Path

import pandas as pd

from src.metas_repo import normalizar_nombre

HOJA = "RS"
NOMBRE_ARCHIVO_PATRON = "*AUDITORIA*VENTAS*.xlsx"


def localizar_archivo() -> Path:
    home = Path(os.path.expanduser("~"))
    candidatos = glob.glob(str(home / "OneDrive*" / "**" / NOMBRE_ARCHIVO_PATRON), recursive=True)
    if not candidatos:
        raise FileNotFoundError(
            "No encontré el Excel de auditoría de ventas en ninguna carpeta OneDrive* de este usuario."
        )
    return Path(candidatos[0])


def leer_rs() -> pd.DataFrame:
    ruta = localizar_archivo()
    df = pd.read_excel(ruta, sheet_name=HOJA, engine="openpyxl")
    df = df.dropna(axis=1, how="all")
    df.columns = [str(c).strip() for c in df.columns]
    return df


def combinar_con_ilio(
    df_excel: pd.DataFrame,
    df_ilio: pd.DataFrame,
    periodo: dt.date | None = None,
) -> pd.DataFrame:
    """Une el Excel de auditoría RS (todo intento registrado, aprobado o por
    subsanar) con ilio.v_rueda_segura (solo lo que ya llegó a Ilio como
    póliza), por número de contrato -- ninguna de las dos fuentes sola trae
    el total real: el Excel se queda corto en fecha (no llega al corte) y en
    asesor (aún no se resolvió su Subsanar), Ilio se queda corto en lo que
    todavía no se ha digitado. Devuelve una fila por contrato único con
    columnas id_poliza/asesor/fecha_venta, listas para los resumenes RS
    (ver validación RS agosto 2026 -- unión dio 64 contra 36 solo-Ilio).

    Si se pasa `periodo` (primer día del mes), se descartan los contratos
    cuya fecha_venta caiga fuera de ese mes -- evita que el Excel de auditoría
    (que acumula meses anteriores) lleve registros viejos al dashboard del mes
    en curso (ver ajuste de corte sept 2026)."""
    excel = df_excel.copy()
    excel["CONTRATO"] = excel["CONTRATO"].astype(str)
    excel = excel[excel["CONTRATO"] != "0"]

    ilio = df_ilio.copy()
    ilio["numero_contrato"] = ilio["numero_contrato"].astype(str)

    # nombre canónico por contrato, tomado de Ilio -- ahí el asesor viene del
    # sistema (correcto), no tecleado a mano en el Excel de auditoría.
    canon_por_apellido: dict[str, str] = {}
    for asesor in ilio["asesor"].dropna().unique():
        norm = normalizar_nombre(asesor)
        for token in norm.split():
            canon_por_apellido.setdefault(token, asesor)

    def _nombre_canonico(nombre_excel: str) -> str:
        norm = normalizar_nombre(nombre_excel)
        for token in norm.split():
            if token in canon_por_apellido:
                return canon_por_apellido[token]
        return nombre_excel.strip().upper()

    excel_por_contrato = excel.drop_duplicates("CONTRATO").set_index("CONTRATO")
    ilio_por_contrato = ilio.drop_duplicates("numero_contrato").set_index("numero_contrato")

    contratos = set(excel_por_contrato.index) | set(ilio_por_contrato.index)
    filas = []
    for contrato in contratos:
        en_ilio = contrato in ilio_por_contrato.index
        if en_ilio:
            r = ilio_por_contrato.loc[contrato]
            asesor, fecha_venta = r["asesor"], r["fecha_venta"]
        else:
            r = excel_por_contrato.loc[contrato]
            asesor = _nombre_canonico(str(r["ASESOR"]))
            fecha_venta = pd.to_datetime(r["FECHA DE VENTA"]).date()
        filas.append({"id_poliza": contrato, "asesor": asesor, "fecha_venta": fecha_venta})

    df = pd.DataFrame(filas)
    df["fecha_venta"] = pd.to_datetime(df["fecha_venta"]).dt.date

    # Filtro de mes: descartar contratos fuera del periodo solicitado.
    # El Excel de auditoría acumula meses anteriores; sin este filtro, los
    # registros de agosto aparecen en el dashboard de septiembre.
    if periodo is not None:
        fecha_inicio = periodo.replace(day=1)
        # Último día del mes: primero del mes siguiente menos un día
        if fecha_inicio.month == 12:
            fecha_fin = fecha_inicio.replace(year=fecha_inicio.year + 1, month=1, day=1)
        else:
            fecha_fin = fecha_inicio.replace(month=fecha_inicio.month + 1, day=1)
        df = df[(df["fecha_venta"] >= fecha_inicio) & (df["fecha_venta"] < fecha_fin)]

    return df


def resumen_por_estado(df: pd.DataFrame) -> pd.DataFrame:
    tabla = df.groupby("ESTADO DE LA VENTA").size().reset_index(name="cantidad")
    total = tabla["cantidad"].sum()
    tabla["pct_participacion"] = tabla["cantidad"] / total if total else 0.0
    return tabla.sort_values("cantidad", ascending=False)


def resumen_por_dia(df: pd.DataFrame) -> pd.DataFrame:
    tabla = df.copy()
    tabla["FECHA DE VENTA"] = pd.to_datetime(tabla["FECHA DE VENTA"]).dt.date
    resumen = tabla.groupby("FECHA DE VENTA").size().reset_index(name="cantidad")
    total = resumen["cantidad"].sum()
    resumen["pct_participacion"] = resumen["cantidad"] / total if total else 0.0
    return resumen.sort_values("FECHA DE VENTA")
