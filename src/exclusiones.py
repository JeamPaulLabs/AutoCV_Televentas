"""Asesores excluidos del cálculo de metas (config/asesores_excluidos.yml)."""
from __future__ import annotations

from pathlib import Path

import yaml

from src.metas_repo import normalizar_nombre

_YML_PATH = Path(__file__).parent.parent / "config" / "asesores_excluidos.yml"


def cargar_excluidos() -> dict[str, str]:
    """{nombre_normalizado: motivo}"""
    if not _YML_PATH.exists():
        return {}
    data = yaml.safe_load(_YML_PATH.read_text(encoding="utf-8")) or {}
    return {
        normalizar_nombre(item["nombre"]): item.get("motivo", "")
        for item in data.get("excluidos", [])
    }


def inactivos_sin_ventas(df_ventas) -> set[str]:
    """Asesores inactivos en el directorio (directorio.personas.activo = false,
    enlazados por como_vamos_televentas.asesor_alias) que no tienen ventas en el
    periodo: no se listan aunque conserven una meta cargada. Si vendieron algo
    en el periodo (se fueron a mitad de mes) siguen apareciendo."""
    from src.db import get_conexion

    with get_conexion() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT a.alias_norm FROM como_vamos_televentas.asesor_alias a "
            "JOIN directorio.personas p ON p.id_persona = a.id_usuario WHERE p.activo = false"
        )
        inactivos = {r[0] for r in cur.fetchall()}
    con_ventas = set(df_ventas["asesor"].map(normalizar_nombre)) if len(df_ventas) else set()
    return inactivos - con_ventas


def excluidos_del_periodo(df_ventas) -> dict[str, str]:
    """Excluidos del YAML más los inactivos del directorio sin ventas."""
    out = cargar_excluidos()
    for nombre in inactivos_sin_ventas(df_ventas):
        out.setdefault(nombre, "Inactivo en el directorio")
    return out
