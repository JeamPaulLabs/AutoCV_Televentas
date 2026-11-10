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
from src.exclusiones import excluidos_del_periodo
from src.ilio_repo import leer_televentas

from ..analisis_criterios import (
    ASPECTOS,
    CRITERIOS,
    analizar_asesor,
    cumplimiento_productos,
    producto_corto,
)
from ..auth_dep import get_current_user, roles_auditoria
from .como_vamos import _mi_alias_norm, _norm_nombre, _parse_periodo

router = APIRouter()

_CAMPOS = (
    "asesor, producto, causal_gestion, observacion, observacion_re_auditoria, "
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


def _ventas_por_asesor(periodo_d):
    """Total de ventas del mes por asesor y producto corto (denominador del
    % de cumplimiento: toda venta pasa por auditoría; la que no terminó en
    cancelación cumplió el guion). Devuelve (totales, nombres) con el asesor
    normalizado como llave; excluye a los asesores fuera del colectivo."""
    df = leer_televentas(periodo_d)
    if df.empty:
        return {}, {}
    excluidos = {_norm_nombre(a) for a in excluidos_del_periodo(df)}
    totales: dict[str, dict[str, int]] = {}
    nombres: dict[str, str] = {}
    for r in df.itertuples(index=False):
        nombre = (getattr(r, "asesor", None) or "").strip()
        alias = _norm_nombre(nombre)
        if not alias or alias in excluidos:
            continue
        nombres.setdefault(alias, nombre)
        d = totales.setdefault(alias, {})
        pc = producto_corto(getattr(r, "producto", None))
        d[pc] = d.get(pc, 0) + 1
    return totales, nombres


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

    # Denominador del % de cumplimiento: ventas del mes por asesor y producto.
    # Si ilio no responde, el análisis sale igual pero sin porcentajes.
    try:
        totales, nombres_ilio = _ventas_por_asesor(periodo_d)
    except Exception:
        totales, nombres_ilio = {}, {}

    if es_auditor:
        por_asesor: dict[str, list[dict]] = {}
        for f in filas:
            por_asesor.setdefault((f.get("asesor") or "SIN ASESOR").strip(), []).append(f)
        asesores = [
            {
                "asesor": nombre,
                **analizar_asesor(lista),
                "productos": cumplimiento_productos(lista, totales.get(_norm_nombre(nombre), {})),
            }
            for nombre, lista in por_asesor.items()
        ]
        # Asesores con ventas pero SIN canceladas revisadas: cumplieron los
        # criterios en todas sus ventas auditadas — también deben verse.
        con_revision = {_norm_nombre(a["asesor"]) for a in asesores}
        for alias, tot in totales.items():
            if alias in con_revision:
                continue
            asesores.append({
                "asesor": nombres_ilio.get(alias, alias),
                **analizar_asesor([]),
                "productos": cumplimiento_productos([], tot),
            })
        asesores.sort(key=lambda a: -a["total_revisadas"])
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
        # Cumplimiento del equipo: todas las revisiones contra todas las ventas.
        tot_equipo: dict[str, int] = {}
        for tot in totales.values():
            for pc, n in tot.items():
                tot_equipo[pc] = tot_equipo.get(pc, 0) + n
        return {
            **base,
            "vista": "equipo",
            "equipo": {
                "total_revisadas": len(filas),
                "asesores": len(asesores),
                "fallas_audio": sum(a["fallas_audio"] for a in asesores),
                "productos": cumplimiento_productos(filas, tot_equipo),
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
    productos = cumplimiento_productos(mias, totales.get(alias, {}))
    if not mias:
        return {
            **base, "vista": "personal", "disponible": True,
            "sin_revisiones": True, "productos": productos,
        }
    analisis = analizar_asesor(mias)
    analisis["productos"] = productos
    return {**base, "vista": "personal", "sin_revisiones": False, "analisis": analisis}
