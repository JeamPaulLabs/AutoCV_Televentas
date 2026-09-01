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
