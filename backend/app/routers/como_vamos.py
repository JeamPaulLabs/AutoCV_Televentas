"""Endpoints de solo lectura del motor 'Como Vamos Televentas'.

No duplica lógica de negocio: reutiliza exactamente el mismo pipeline de
cálculo que usa el generador HTML estático (src/), solo que aquí se devuelve
como JSON en vez de un archivo HTML. Fuente de datos: ilio.v_cuota_protegida +
ilio.v_billetera_protegida + ilio.v_rueda_segura (mes en curso, en vivo; las
tres cuentan en el acumulado del asesor) o como_vamos_televentas.cierre_mensual
(mes cerrado).
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
    ESTADOS_POSITIVOS,
    es_billetera,
    es_rueda_seguro,
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
    resumen_dia_producto_estado,
    resumen_bp_por_asesor,
    resumen_bp_por_dia,
    resumen_por_dia,
    resumen_por_estado,
    resumen_por_gasera,
    resumen_por_producto,
    resumen_rs_por_asesor,
    resumen_rs_por_dia,
)
from src.ruedas_seguro_repo import combinar_con_ilio, leer_rs
from src.tarifas_repo import con_facturacion_servi, leer_tarifas, planes_sin_tarifa

from ..auth_dep import es_supervisor_televentas, get_current_user, puede_ver_vista_equipo
from ..utils import df_records

router = APIRouter()

# El tablero abre desde agosto 2026 (primer mes con datos validados) hasta el
# mes en curso -- la pestaña del mes nuevo aparece sola al cambiar de mes.
PRIMER_PERIODO = (2026, 8)


def periodos_disponibles(hoy: dt.date | None = None) -> list[str]:
    hoy = hoy or dt.date.today()
    anio, mes = PRIMER_PERIODO
    periodos = []
    while (anio, mes) <= (hoy.year, hoy.month):
        periodos.append(f"{anio}-{mes:02d}")
        anio, mes = (anio + 1, 1) if mes == 12 else (anio, mes + 1)
    return periodos


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
    disponibles = periodos_disponibles()
    if periodo not in disponibles:
        raise HTTPException(400, f"periodo no disponible, usa uno de: {', '.join(disponibles)}")
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


@router.get("/periodos")
def periodos(current: dict = Depends(get_current_user)):
    return {"periodos": periodos_disponibles()}


@router.get("/dashboard")
def dashboard(
    periodo: str = Query(..., description="Periodo del mes, formato YYYY-MM (ej. 2026-08)"),
    fecha_corte: str | None = Query(None, description="Corte, formato YYYY-MM-DD; default hoy"),
    modo: str = Query("auto", description="Vista a mostrar: auto, personal o equipo"),
    asesor: str | None = Query(None, description="Solo supervisión: ver el Como vamos de este asesor (auditoría)"),
    current: dict = Depends(get_current_user),
):
    auditando = bool(asesor and asesor.strip())
    if auditando and not es_supervisor_televentas(current):
        raise HTTPException(403, "Solo la supervisión de televentas puede ver a otro asesor.")
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

    # Billetera Protegida ya viene dentro de df_ventas (cuenta en el acumulado
    # del asesor, en las tablas del equipo y en las altas del otrosí) -- aquí
    # se separa solo para su propio resumen por día y por asesor.
    df_bp = df_ventas[es_billetera(df_ventas)]
    tabla_bp_dias = resumen_bp_por_dia(df_bp).assign(
        fecha_venta=lambda d: d["fecha_venta"].astype(str)
    )
    tabla_bp_asesor = resumen_bp_por_asesor(df_bp)

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
        # df_ventas ya trae Rueda Seguro (cuenta en el acumulado), así que se le
        # quitan esas filas para no contarlas dos veces: el otrosí las recibe
        # aparte, como siempre (ver comisiones.estado_otrosi).
        "otrosi": estado_otrosi(periodo_d, df_ventas[~es_rueda_seguro(df_ventas)], df_rs_ilio),
        "calendario": {
            "dias_colectivo": cal.dias_colectivo,
            "dias_laborados": cal.dias_laborados,
            "dias_por_laborar": cal.dias_por_laborar,
        },
    }

    # Decide si se muestra la vista "equipo" (administrativa, con facturación).
    # Supervisores/superadmins la ven por defecto (modo auto); los usuarios
    # habilitados en auth_dep.USUARIOS_VISTA_ADMINISTRATIVA pueden solicitarla
    # con modo=equipo (switch del frontend).
    autorizado_equipo = puede_ver_vista_equipo(current)
    mostrar_equipo = not auditando and (
        (modo == "equipo" and autorizado_equipo)
        or (modo == "auto" and es_supervisor_televentas(current))
    )
    # Quien puede ver el equipo pero no está vinculado a un asesor (ej. un
    # superadmin) no tiene "Mi operación": se le muestra la vista de equipo en
    # vez de un 403 que además le oculta el botón para cambiar de vista.
    if (
        not mostrar_equipo
        and not auditando
        and modo != "equipo"
        and autorizado_equipo
        and not _mi_alias_norm(int(current["sub"]))
    ):
        mostrar_equipo = True

    if mostrar_equipo:
        return {
            **base,
            "vista": "equipo",
            "puede_ver_equipo": autorizado_equipo,
            "puede_auditar": es_supervisor_televentas(current),
            "kpis": kpis,
            "podio": df_records(top3[["asesor", "acumulado", "pct_cumpl_acumulado"]]),
            "resumen_equipo": {
                "meta_total": float(df_proyeccion["meta_mes"].sum()),
                "acumulado_total": float(df_proyeccion["acumulado"].sum()),
                "forecast_total": float(df_proyeccion["forecast"].sum()),
            },
            "tabla_dias": df_records(df_por_dia),
            "dia_producto_estado": df_records(resumen_dia_producto_estado(df_ventas)),
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
            "billetera": {
                "tabla_dias": df_records(tabla_bp_dias),
                "tabla_asesor": df_records(tabla_bp_asesor),
            },
        }

    # Vista personal: nada de facturación, tarifas ni datos de otros
    # asesores -- solo la operación de ventas (conteos) de quien consultó.
    mi_alias_norm = _norm_nombre(asesor) if auditando else _mi_alias_norm(int(current["sub"]))
    if not mi_alias_norm:
        raise HTTPException(403, f"Tu usuario no está vinculado a un asesor de televentas (id_usuario={current.get('sub')})")

    # Rueda Seguro propia: mismo formato que las ventas de Cuota Protegida
    # (contrato, producto, estado). Ya no se arma la vista aparte: RS vive dentro
    # de df_ventas y detalle_dia_dia la trae. Se conserva este armado solo para
    # el caso de un asesor sin fila en la proyección (ver más abajo).
    mi_rs = []
    if not df_rs.empty:
        rs_mias = df_rs[df_rs["asesor"].map(_norm_nombre) == mi_alias_norm].sort_values(
            "fecha_venta", ascending=False
        )
        mi_rs = [
            {
                "fecha_venta": str(r.fecha_venta),
                "contrato": str(r.id_poliza),
                "producto": r.producto if isinstance(r.producto, str) else "Rueda Seguro",
                "estado": r.nombre_estado if isinstance(r.nombre_estado, str) else None,
            }
            for r in rs_mias.itertuples(index=False)
        ]

    mask_mio = df_proyeccion["asesor"].map(_norm_nombre) == mi_alias_norm
    mi_fila = df_proyeccion[mask_mio]
    autorizado_equipo = puede_ver_vista_equipo(current)

    # Si el asesor no tuvo ventas pero SÍ tiene meta cargada, se le muestra la
    # meta igualmente (antes quedaba sin bloque de meta). La meta viene de
    # como_vamos_televentas.metas por nombre, independiente de ilio.
    mi_meta_row = None
    if not df_metas.empty and mi_alias_norm in set(df_metas["asesor_norm"]):
        mi_meta_row = df_metas[df_metas["asesor_norm"] == mi_alias_norm].iloc[0]

    if mi_fila.empty:
        # Sin fila en la proyección: no vendió nada este mes, o vendió pero no
        # entró al acumulado (asesor excluido del tablero). Si tiene pólizas RS
        # en el Excel de auditoría que no llegaron a Ilio, se las muestran igual.
        # Si tiene meta cargada, se muestra el bloque de meta con acumulado 0.
        resumen_sin_ventas = None
        if mi_meta_row is not None:
            resumen_sin_ventas = {
                "asesor": mi_meta_row["asesor"],
                "categoria": mi_meta_row["categoria"],
                "meta_mes": int(mi_meta_row["meta_escala_1"]),
                "acumulado": 0,
                "pct_cumpl_acumulado": 0.0,
                "meta_diaria": 0.0,
                "faltan_para_meta": int(mi_meta_row["meta_escala_1"]),
                "venta_necesaria_dia": 0.0,
                "meta_ideal_a_la_fecha": 0.0,
                "pct_cump_ideal": 0.0,
                "prom_por_dia": 0.0,
                "forecast": 0.0,
                "pct_forecast": 0.0,
                "escala_alcanzada": 0,
                "observaciones": (mi_meta_row.get("observaciones")
                                 if isinstance(mi_meta_row.get("observaciones"), str) else ""),
            }
        if not mi_rs and resumen_sin_ventas is None:
            return {**base, "vista": "personal", "disponible": False, "puede_ver_equipo": autorizado_equipo}
        return {
            **base,
            "vista": "personal",
            "disponible": True,
            "puede_ver_equipo": autorizado_equipo,
            "resumen": resumen_sin_ventas,
            "detalle_estado": None,
            "detalle_dia_dia": mi_rs,
            "billetera": None,
            "canceladas_revision": [],
        }

    mask_pivote = df_pivote["asesor"].map(_norm_nombre) == mi_alias_norm
    mi_detalle = df_pivote[mask_pivote]

    # base_pago_proyectada es un valor en pesos (el bono) -- fuera de la
    # vista personal junto con cualquier otro dato de plata/facturación.
    resumen = df_records(mi_fila)[0]
    resumen.pop("base_pago_proyectada", None)

    # Día a día: cada venta propia con su contrato, producto y estado -- lo que
    # el asesor pidió para poder revisar puntualmente cada cuenta, no solo el
    # acumulado. Cuenta Protegida, Billetera Protegida y Rueda Seguro juntas
    # (las tres son ventas del asesor). Sin tarifa/facturación (ver arriba).
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

    # Billetera Protegida propia: ya está dentro de detalle_dia_dia y
    # detalle_estado (cuenta en su acumulado y en su % de cumplimiento); se
    # manda aparte solo para la tarjeta destacada de la pantalla personal.
    mis_bp = mis_ventas[es_billetera(mis_ventas)]
    mi_billetera = None
    if not mis_bp.empty:
        mi_billetera = {
            "total": int(len(mis_bp)),
            "altas": int(mis_bp["nombre_estado"].isin(ESTADOS_POSITIVOS).sum()),
        }

    # Canceladas con revisión (subsanación / re-auditoría) del asesor. Solo se
    # muestran las que SIGUEN canceladas: si la venta ya maduró a AUDITADA WEB
    # o ALTA TRANSACCIONAL (venta efectiva), ya no debe aparecer como cancelada.
    estado_por_contrato: dict[str, str | None] = {}
    for r in mis_ventas.itertuples(index=False):
        c = getattr(r, "numero_contrato", None)
        c = "" if c is None else str(c).strip()
        if c.endswith(".0"):
            c = c[:-2]
        estado_por_contrato[c.replace(" ", "")] = getattr(r, "nombre_estado", None)

    mi_canceladas = []
    try:
        with get_conexion() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT numero_contrato, asesor, producto, fecha_venta, "
                "causal_gestion, gestion_supervisor_tmk, observacion, "
                "resultado_re_auditoria, observacion_re_auditoria, "
                "estado_subsanacion, solicitud, reauditoria, "
                "observaciones_reauditoria, fecha_gestion, gestor "
                "FROM como_vamos_televentas.canceladas_revision "
                "WHERE periodo = %s",
                (periodo_d,),
            )
            cols = [d[0] for d in cur.description]
            for row in cur.fetchall():
                rec = dict(zip(cols, row))
                if _norm_nombre(rec.get("asesor") or "") != mi_alias_norm:
                    continue
                contrato = str(rec.get("numero_contrato") or "").strip()
                if contrato.endswith(".0"):
                    contrato = contrato[:-2]
                contrato = contrato.replace(" ", "")
                # Ocultar las que ya son venta efectiva (auditada web / alta).
                if estado_por_contrato.get(contrato) in ESTADOS_POSITIVOS:
                    continue
                rec["numero_contrato"] = contrato
                if rec.get("fecha_venta") is not None and hasattr(rec["fecha_venta"], "isoformat"):
                    rec["fecha_venta"] = rec["fecha_venta"].isoformat()
                if rec.get("fecha_gestion") is not None and hasattr(rec["fecha_gestion"], "isoformat"):
                    rec["fecha_gestion"] = rec["fecha_gestion"].isoformat()
                mi_canceladas.append(rec)
    except Exception:
        mi_canceladas = []

    equipo_ref = None
    if auditando:
        con_meta = df_proyeccion[df_proyeccion["categoria"] != "SIN META"]
        if not con_meta.empty:
            equipo_ref = {
                "asesores": int(len(con_meta)),
                "pct_promedio": float(con_meta["pct_cumpl_acumulado"].mean()),
                "prom_por_dia": float(con_meta["prom_por_dia"].mean()),
            }

    return {
        **base,
        "vista": "personal",
        "disponible": True,
        "puede_ver_equipo": autorizado_equipo,
        "equipo_ref": equipo_ref,
        "resumen": resumen,
        "detalle_estado": df_records(mi_detalle)[0] if not mi_detalle.empty else None,
        "detalle_dia_dia": detalle_dia_dia,
        "billetera": mi_billetera,
        "canceladas_revision": mi_canceladas,
    }


@router.get("/health")
def health():
    return {"status": "ok"}
