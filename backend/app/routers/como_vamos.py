"""Endpoints de solo lectura del motor 'Como Vamos Televentas'.

No duplica lógica de negocio: reutiliza exactamente el mismo pipeline de
cálculo que usa el generador HTML estático (src/), solo que aquí se devuelve
como JSON en vez de un archivo HTML. Fuente de datos: ilio.v_cuota_protegida
(mes en curso, en vivo) o como_vamos_televentas.cierre_mensual (mes cerrado).
"""
from __future__ import annotations

import datetime as dt
import re
import unicodedata

from fastapi import APIRouter, Depends, HTTPException, Query

from src.calculo import calcular_proyeccion
from src.calendario import Calendario
from src.db import get_conexion
from src.exclusiones import cargar_excluidos
from src.ilio_repo import (
    leer_rueda_segura,
    leer_televentas,
    periodo_esta_cerrado,
    ultima_actualizacion_ilio,
)
from src.comisiones import estado_otrosi
from src.metas_repo import asesores_sin_meta, leer_metas
from src.pivote import (
    kpis_facturacion,
    pivote_asesor_estado,
    resumen_por_dia,
    resumen_por_estado,
    resumen_por_gasera,
    resumen_por_producto,
    resumen_rs_por_asesor,
    resumen_rs_por_dia,
)
from src.ruedas_seguro_repo import combinar_con_ilio, leer_rs
from src.tarifas_repo import con_facturacion_servi, leer_tarifas, planes_sin_tarifa

from ..auth_dep import es_supervisor_televentas, get_current_user
from ..utils import df_records

router = APIRouter()

# Por el momento el tablero solo muestra estos dos meses -- ver conversación
# 2026-09-01. Ampliar esta tupla cuando se decida abrir más historia.
PERIODOS_DISPONIBLES = ("2026-08", "2026-09")


def _norm_nombre(txt: str | None) -> str:
    """Espejo en Python de como_vamos_televentas.norm_nombre(text) -- mismo
    criterio de normalización para poder cruzar el alias del asesor (que
    vive en Postgres) contra la columna 'asesor' de los DataFrames de ilio."""
    txt = re.sub(r"\s+", " ", (txt or "").strip())
    sin_tildes = unicodedata.normalize("NFKD", txt).encode("ascii", "ignore").decode("ascii")
    return sin_tildes.upper()


def _mi_alias_norm(id_usuario: int) -> str | None:
    with get_conexion() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT alias_norm FROM como_vamos_televentas.asesor_alias WHERE id_usuario = %s LIMIT 1",
            (id_usuario,),
        )
        row = cur.fetchone()
    return row[0] if row else None


def _parse_periodo(periodo: str) -> dt.date:
    if periodo not in PERIODOS_DISPONIBLES:
        raise HTTPException(400, f"periodo no disponible, usa uno de: {', '.join(PERIODOS_DISPONIBLES)}")
    try:
        return dt.datetime.strptime(periodo, "%Y-%m").date().replace(day=1)
    except ValueError:
        raise HTTPException(400, "periodo inválido, formato esperado YYYY-MM")


def _parse_fecha(fecha: str | None) -> dt.date:
    if fecha is None:
        return dt.date.today()
    try:
        return dt.datetime.strptime(fecha, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(400, "fecha_corte inválida, formato esperado YYYY-MM-DD")


@router.get("/dashboard")
def dashboard(
    periodo: str = Query(..., description="Periodo del mes, formato YYYY-MM (ej. 2026-08)"),
    fecha_corte: str | None = Query(None, description="Corte, formato YYYY-MM-DD; default hoy"),
    current: dict = Depends(get_current_user),
):
    periodo_d = _parse_periodo(periodo)
    fecha_corte_d = _parse_fecha(fecha_corte)

    df_ventas = leer_televentas(periodo_d, fecha_corte_d)
    df_metas = leer_metas(periodo_d)
    df_tarifas = leer_tarifas()
    df_ventas = con_facturacion_servi(df_ventas, df_tarifas)
    cerrado = periodo_esta_cerrado(periodo_d) is not None

    excluidos = set(cargar_excluidos())
    faltantes = asesores_sin_meta(df_ventas, df_metas, excluidos)
    sin_tarifa = planes_sin_tarifa(df_ventas)

    cal = Calendario(periodo_d, fecha_corte_d)
    df_proyeccion = calcular_proyeccion(df_ventas, df_metas, cal, excluidos)

    df_por_dia = resumen_por_dia(df_ventas).assign(
        fecha_venta=lambda d: d["fecha_venta"].astype(str)
    )
    df_por_producto = resumen_por_producto(df_ventas)
    df_por_gasera = resumen_por_gasera(df_ventas)
    df_por_estado = resumen_por_estado(df_ventas)
    kpis = kpis_facturacion(df_ventas, df_por_producto, df_por_gasera)
    df_pivote = pivote_asesor_estado(df_ventas, excluidos).reset_index()

    top3 = (
        df_proyeccion[df_proyeccion["categoria"] != "SIN META"]
        .sort_values("acumulado", ascending=False)
        .head(3)
    )

    df_rs_ilio = leer_rueda_segura(periodo_d, fecha_corte_d)
    try:
        df_rs = combinar_con_ilio(leer_rs(), df_rs_ilio, periodo=periodo_d)
    except FileNotFoundError:
        df_rs = df_rs_ilio
    tabla_rs_dias = resumen_rs_por_dia(df_rs).assign(
        fecha_venta=lambda d: d["fecha_venta"].astype(str)
    ) if not df_rs.empty else df_rs
    tabla_rs_asesor = resumen_rs_por_asesor(df_rs) if not df_rs.empty else df_rs

    corte_ilio = ultima_actualizacion_ilio()
    # ilio.ejecuciones.finalizado_en es timestamp SIN zona horaria pero
    # guardado en UTC (reloj del servidor) -- si se manda tal cual, el
    # navegador lo interpreta como hora LOCAL del que mira la pantalla y
    # muestra una hora que no es (ej. 21:46 UTC se veía como "9:46 p.m."
    # en vez de convertir a 4:46 p.m. Colombia). Se marca explícito como
    # UTC ("Z") para que el navegador sí haga la conversión correcta.
    actualizado_en = (
        corte_ilio.replace(tzinfo=dt.timezone.utc).isoformat() if corte_ilio else None
    )

    base = {
        "periodo": periodo_d.isoformat(),
        "fecha_corte": cal.fecha_corte.isoformat(),
        "cerrado": cerrado,
        "actualizado_en": actualizado_en,
        "otrosi": estado_otrosi(periodo_d, df_ventas, df_rs_ilio),
        "calendario": {
            "dias_colectivo": cal.dias_colectivo,
            "dias_laborados": cal.dias_laborados,
            "dias_por_laborar": cal.dias_por_laborar,
        },
    }

    if es_supervisor_televentas(current):
        return {
            **base,
            "vista": "equipo",
            "kpis": kpis,
            "podio": df_records(top3[["asesor", "acumulado", "pct_cumpl_acumulado"]]),
            "resumen_equipo": {
                "meta_total": float(df_proyeccion["meta_mes"].sum()),
                "acumulado_total": float(df_proyeccion["acumulado"].sum()),
                "forecast_total": float(df_proyeccion["forecast"].sum()),
            },
            "tabla_dias": df_records(df_por_dia),
            "tabla_producto": df_records(df_por_producto),
            "tabla_gasera": df_records(df_por_gasera),
            "tabla_estados": df_records(df_por_estado),
            "asesores": df_records(df_proyeccion),
            "detalle_asesor_estado": df_records(df_pivote),
            "avisos": {"sin_meta": faltantes, "sin_tarifa": sin_tarifa},
            "rueda_segura": {
                "tabla_dias": df_records(tabla_rs_dias),
                "tabla_asesor": df_records(tabla_rs_asesor),
            },
        }

    # Vista personal: nada de facturación, tarifas ni datos de otros
    # asesores -- solo la operación de ventas (conteos) de quien consultó.
    mi_alias_norm = _mi_alias_norm(int(current["sub"]))
    if not mi_alias_norm:
        raise HTTPException(403, "Tu usuario no está vinculado a un asesor de televentas")

    mask_mio = df_proyeccion["asesor"].map(_norm_nombre) == mi_alias_norm
    mi_fila = df_proyeccion[mask_mio]
    if mi_fila.empty:
        return {**base, "vista": "personal", "disponible": False}

    mask_pivote = df_pivote["asesor"].map(_norm_nombre) == mi_alias_norm
    mi_detalle = df_pivote[mask_pivote]

    # base_pago_proyectada es un valor en pesos (el bono) -- fuera de la
    # vista personal junto con cualquier otro dato de plata/facturación.
    resumen = df_records(mi_fila)[0]
    resumen.pop("base_pago_proyectada", None)

    # Día a día: cada venta propia con su contrato y estado -- lo que el
    # asesor pidió para poder revisar puntualmente cada cuenta, no solo el
    # acumulado. Sin tarifa/facturación (ver arriba).
    mask_ventas_mias = df_ventas["asesor"].map(_norm_nombre) == mi_alias_norm
    mis_ventas = df_ventas[mask_ventas_mias].sort_values("fecha_venta", ascending=False)
    detalle_dia_dia = [
        {
            "fecha_venta": r.fecha_venta.isoformat() if hasattr(r.fecha_venta, "isoformat") else str(r.fecha_venta),
            "contrato": getattr(r, "numero_contrato", None),
            "producto": getattr(r, "producto", None),
            "estado": getattr(r, "nombre_estado", None),
        }
        for r in mis_ventas.itertuples(index=False)
    ]

    return {
        **base,
        "vista": "personal",
        "disponible": True,
        "resumen": resumen,
        "detalle_estado": df_records(mi_detalle)[0] if not mi_detalle.empty else None,
        "detalle_dia_dia": detalle_dia_dia,
    }


@router.get("/health")
def health():
    return {"status": "ok"}
