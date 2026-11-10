"""Análisis de auditoría del mes por asesor (pestaña "Mi auditoría").

Toma TODAS las canceladas revisadas del periodo (como_vamos_televentas.
canceladas_revision — incluye las que luego se subsanaron o maduraron a alta:
lo que se analiza es el audio auditado, no el estado actual de la venta),
las clasifica contra los criterios del guion (backend/app/analisis_criterios.py)
y devuelve un resumen orientado a la mejora.

  - Asesor: solo su propio análisis (retroalimentación, no caso a caso).
  - Martha / Kevin (roles de auditoría): el equipo completo, por criterio.

La pestaña del mes queda "disponible" solo si el periodo tiene canceladas
revisadas cargadas (octubre sí; noviembre aparecerá cuando se cargue).
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query

from src.db import get_conexion

from ..analisis_criterios import ASPECTOS, CRITERIOS, analizar_asesor
from ..auth_dep import get_current_user, roles_auditoria
from .como_vamos import _mi_alias_norm, _norm_nombre, _parse_periodo

router = APIRouter()

_CAMPOS = (
    "asesor, causal_gestion, observacion, observacion_re_auditoria, "
    "observaciones_reauditoria"
)


def _filas_periodo(periodo_d) -> list[dict]:
    with get_conexion() as conn, conn.cursor() as cur:
        cur.execute(
            f"SELECT {_CAMPOS} FROM como_vamos_televentas.canceladas_revision "
            "WHERE periodo = %s",
            (periodo_d,),
        )
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, f)) for f in cur.fetchall()]


@router.get("/analisis-canceladas")
def analisis(
    periodo: str = Query(..., description="YYYY-MM"),
    current: dict = Depends(get_current_user),
):
    periodo_d = _parse_periodo(periodo)
    try:
        filas = _filas_periodo(periodo_d)
    except Exception as e:
        raise HTTPException(503, f"No se pudo leer la revisión de canceladas: {e}")

    base = {"periodo": periodo_d.isoformat(), "disponible": bool(filas)}
    es_auditor = bool(roles_auditoria(current))

    if not filas:
        return {**base, "vista": "equipo" if es_auditor else "personal"}

    if es_auditor:
        por_asesor: dict[str, list[dict]] = {}
        for f in filas:
            por_asesor.setdefault((f.get("asesor") or "SIN ASESOR").strip(), []).append(f)
        asesores = sorted(
            (
                {"asesor": nombre, **analizar_asesor(lista)}
                for nombre, lista in por_asesor.items()
            ),
            key=lambda a: -a["total_revisadas"],
        )
        # Totales del equipo por criterio y por aspecto (para la vista general).
        tot_crit: dict[str, int] = {}
        tot_asp: dict[str, int] = {}
        for a in asesores:
            for c in a["criterios"]:
                tot_crit[c["id"]] = tot_crit.get(c["id"], 0) + c["total"]
            for s in a["aspectos"]:
                tot_asp[s["id"]] = tot_asp.get(s["id"], 0) + s["total"]
        nombres_c = {c["id"]: c["nombre"] for c in CRITERIOS}
        nombres_a = {a["id"]: a["nombre"] for a in ASPECTOS}
        return {
            **base,
            "vista": "equipo",
            "equipo": {
                "total_revisadas": len(filas),
                "asesores": len(asesores),
                "fallas_audio": sum(a["fallas_audio"] for a in asesores),
                "criterios": sorted(
                    ({"id": k, "nombre": nombres_c[k], "total": v} for k, v in tot_crit.items()),
                    key=lambda x: -x["total"],
                ),
                "aspectos": sorted(
                    ({"id": k, "nombre": nombres_a[k], "total": v} for k, v in tot_asp.items()),
                    key=lambda x: -x["total"],
                ),
            },
            "detalle_asesores": asesores,
        }

    # Asesor: solo lo suyo.
    alias = _mi_alias_norm(int(current["sub"]))
    if not alias:
        raise HTTPException(403, "Tu usuario no está vinculado a un asesor de televentas.")
    mias = [f for f in filas if _norm_nombre(f.get("asesor") or "") == alias]
    if not mias:
        return {**base, "vista": "personal", "disponible": True, "sin_revisiones": True}
    return {**base, "vista": "personal", "sin_revisiones": False, "analisis": analizar_asesor(mias)}
