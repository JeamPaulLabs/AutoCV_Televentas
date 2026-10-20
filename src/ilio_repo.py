"""Lectura de la réplica ilio (DataCenter_Vanti) para la estrategia Televentas.

Este módulo es solo lector de ilio.v_cuota_protegida, ilio.v_billetera_protegida
y ilio.v_rueda_segura — no descarga nada del portal, no escribe en el esquema
ilio. La única escritura que hace este proyecto es el snapshot de cierre de mes
en como_vamos_televentas.cierre_mensual, y solo cuando auditoría lo declara
explícitamente (ver cerrar_mes()).
"""
from __future__ import annotations

import datetime as dt

import pandas as pd
import psycopg2.extras

from src.db import get_conexion

MESES_ES = {
    1: "ENERO", 2: "FEBRERO", 3: "MARZO", 4: "ABRIL", 5: "MAYO", 6: "JUNIO",
    7: "JULIO", 8: "AGOSTO", 9: "SEPTIEMBRE", 10: "OCTUBRE", 11: "NOVIEMBRE", 12: "DICIEMBRE",
}

ESTADOS_POSITIVOS = ("AUDITADA WEB", "ALTA TRANSACCIONAL")

# Producto de la vista ilio.v_billetera_protegida. Billetera Protegida (BP)
# cuenta en el acumulado del asesor -- decisión de negocio 2026-10-20: "billetera
# se analiza con la meta" (mismo trato que Cuota Protegida, a diferencia de
# Rueda Seguro, que se reporta aparte y nunca se suma). La identificación es por
# producto porque es la señal que también sobrevive al snapshot de cierre_mensual.
PRODUCTO_BILLETERA = "BILLETERA PROTEGIDA"


def es_billetera(df: pd.DataFrame) -> pd.Series:
    """Máscara booleana de las filas de Billetera Protegida dentro de un df de
    ventas (columna 'producto')."""
    prod = (
        df["producto"].fillna("").astype(str).str.upper()
        .str.replace(r"\s+", " ", regex=True).str.strip()
    )
    return prod == PRODUCTO_BILLETERA


# id_poliza duplicados confirmados en Ilio: mismo asesor, mismo producto, mismo
# cliente (documento_asegurado), digitados en el mismo minuto o el siguiente --
# Ilio generó dos registros para una sola acción. Se descarta el id que no
# coincide con el reporte manual de referencia (ver validación CP agosto 2026,
# contratos 63085125 y 61112896). Centralizado aquí para que CLI y API
# compartan el mismo ajuste sin duplicar lógica.
DUPLICADOS_ILIO_CONOCIDOS = {3183230, 3184799}


def _ultimo_estado_por_contrato(df: pd.DataFrame) -> pd.DataFrame:
    """Deja una sola fila por contrato + asesor + producto: el registro más
    reciente (fecha_digitacion, y id_poliza como desempate). Un mismo contrato
    puede tener productos o asesores distintos, y eso son ventas distintas.
    Los cambios de estado son válidos durante el mes; al cerrarlo, cerrar_mes
    congela el resultado en cierre_mensual. Cuando una venta avanza de
    estado, Ilio crea un id_poliza nuevo para el mismo contrato y deja el
    original en su estado anterior, así que la misma venta se veía dos veces
    (ver contrato 64509434 de Laura, sept 2026). Contratos nulos se conservan."""
    sin_contrato = df["numero_contrato"].isna()
    ultimos = (
        df[~sin_contrato]
        .sort_values(["fecha_digitacion", "id_poliza"])
        .drop_duplicates(["numero_contrato", "asesor", "producto"], keep="last")
    )
    return pd.concat([ultimos, df[sin_contrato]]).sort_index()


def _colectivo_de(periodo: dt.date) -> str:
    """'2026-08-01' -> 'AGOSTO 2026', para filtrar por la columna colectivo de Ilio."""
    return f"{MESES_ES[periodo.month]} {periodo.year}"


def ultima_actualizacion_ilio() -> dt.datetime | None:
    """Hora del último corrido exitoso del sync de Ilio para el mes en curso
    (ilio.ejecuciones, job_type='mes_corriente') -- para mostrarle al asesor
    qué tan fresca es la data que está viendo."""
    with get_conexion() as conn:
        cur = conn.cursor()
        cur.execute("""
            SELECT MAX(finalizado_en) FROM ilio.ejecuciones
            WHERE job_type = 'mes_corriente' AND estado = 'ok'
        """)
        row = cur.fetchone()
        return row[0] if row else None


def periodo_esta_cerrado(periodo: dt.date) -> dict | None:
    """Devuelve la fila de cierres_mes si el periodo ya fue cerrado por auditoría, si no None."""
    with get_conexion() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            "SELECT id_cierre, periodo, fecha_cierre, cerrado_por, observaciones "
            "FROM como_vamos_televentas.cierres_mes WHERE periodo = %s",
            (periodo,),
        )
        return cur.fetchone()


def _params_periodo(periodo: dt.date, colectivo: str, fecha_inicio: dt.date) -> dict:
    """Parámetros comunes de las consultas a Ilio. Algunos planes nuevos (Vida
    Zurich Plan 1, octubre 2026) llegan con colectivo anual 'COLOMBIA 2026' en
    vez del colectivo mensual; se aceptan acotados al mes por fecha_venta (el
    tope superior evita que cuenten en otros meses del mismo año)."""
    fecha_fin = (fecha_inicio.replace(day=28) + dt.timedelta(days=4)).replace(day=1)
    return {
        "colectivo": colectivo,
        "colectivo_anual": f"COLOMBIA {periodo.year}",
        "supervisor": "SUPERVISOR  TMK 1",
        "fecha_inicio": fecha_inicio,
        "fecha_fin": fecha_fin,
    }


def leer_televentas(periodo: dt.date, fecha_corte: dt.date | None = None) -> pd.DataFrame:
    """
    Trae las pólizas de Televentas de un periodo: Cuota Protegida + Billetera
    Protegida (ambas cuentan en el acumulado del asesor; ver
    leer_billetera_protegida).

    Si el periodo YA fue cerrado por auditoría, lee el snapshot congelado en
    cierre_mensual (que desde el cierre en adelante ya incluye Billetera
    Protegida). Si no, lee ilio.v_cuota_protegida y ilio.v_billetera_protegida
    EN VIVO (estado actual, tal como esté hoy), aunque el mes calendario ya
    haya terminado.
    """
    cierre = periodo_esta_cerrado(periodo)
    if cierre:
        query = """
            SELECT id_poliza, fecha_venta, fecha_digitacion, asesor, supervisor,
                   estrategia, producto, plan, colectivo, entidad_facturacion,
                   tarifa, nombre_estado
            FROM como_vamos_televentas.cierre_mensual
            WHERE id_cierre = %(id_cierre)s
        """
        with get_conexion() as conn:
            return pd.read_sql(query, conn, params={"id_cierre": cierre["id_cierre"]})

    colectivo = _colectivo_de(periodo)
    fecha_inicio = periodo.replace(day=1)  # primer día del mes — filtro de corte inferior
    query = """
        SELECT id_poliza, fecha_venta, fecha_digitacion, asesor, supervisor,
               estrategia, producto, plan, colectivo, entidad_facturacion,
               tarifa, nombre_estado, numero_contrato
        FROM ilio.v_cuota_protegida
        WHERE estrategia = 'Televentas' AND colectivo IN (%(colectivo)s, %(colectivo_anual)s)
          AND supervisor = %(supervisor)s
          AND nombre_estado <> 'RENOVACION'
          AND fecha_venta::date >= %(fecha_inicio)s
          AND fecha_venta::date < %(fecha_fin)s
    """
    # RENOVACION = renovación automática de póliza existente, no una venta
    # cantada por el asesor -- se excluye para conciliar con el reporte
    # manual del área (ver validación de julio 2026 vs archivo de Martha).
    # Rueda Segura vive en ilio.v_rueda_segura, una vista aparte -- se reporta
    # por separado (ver leer_rueda_segura) y no se mezcla con este acumulado
    # de Cuota Protegida (ver validación RS agosto 2026, Breiner y Konny).
    # fecha_inicio evita que pólizas con colectivo del periodo pero fecha_venta
    # en el mes anterior (rezagos de digitación) aparezcan en el dashboard del
    # mes actual (ver ajuste de corte, sept 2026).
    params: dict = _params_periodo(periodo, colectivo, fecha_inicio)
    if fecha_corte is not None:
        query += " AND fecha_venta::date <= %(fecha_corte)s"
        params["fecha_corte"] = fecha_corte

    with get_conexion() as conn:
        df = pd.read_sql(query, conn, params=params)
    df = df[~df["id_poliza"].isin(DUPLICADOS_ILIO_CONOCIDOS)]
    df = _ultimo_estado_por_contrato(df)

    # Billetera Protegida entra al mismo acumulado que Cuota Protegida (decisión
    # 2026-10-20). Se concatena aquí, un solo punto, para que el CLI, la API, el
    # caché de ventas_mes_actual y el snapshot de cierre_mensual la hereden todos
    # sin duplicar lógica. No se filtra por asesor: cada quien ve lo suyo en la
    # vista personal.
    df_bp = leer_billetera_protegida(periodo, fecha_corte)
    if df_bp.empty:
        return df
    return pd.concat([df, df_bp], ignore_index=True)


def leer_billetera_protegida(periodo: dt.date, fecha_corte: dt.date | None = None) -> pd.DataFrame:
    """Trae las pólizas de Billetera Protegida de Televentas de un periodo,
    en vivo desde ilio.v_billetera_protegida (mismas columnas, mismos filtros y
    mismo tratamiento de duplicados que v_cuota_protegida: estrategia, supervisor
    del TMK, colectivo mensual o anual, sin RENOVACION y último estado por
    contrato). Cuenta en el acumulado del asesor y en las altas del otrosí."""
    colectivo = _colectivo_de(periodo)
    fecha_inicio = periodo.replace(day=1)  # primer día del mes — filtro de corte inferior
    query = """
        SELECT id_poliza, fecha_venta, fecha_digitacion, asesor, supervisor,
               estrategia, producto, plan, colectivo, entidad_facturacion,
               tarifa, nombre_estado, numero_contrato
        FROM ilio.v_billetera_protegida
        WHERE estrategia = 'Televentas' AND colectivo IN (%(colectivo)s, %(colectivo_anual)s)
          AND supervisor = %(supervisor)s
          AND nombre_estado <> 'RENOVACION'
          AND fecha_venta::date >= %(fecha_inicio)s
          AND fecha_venta::date < %(fecha_fin)s
    """
    params: dict = _params_periodo(periodo, colectivo, fecha_inicio)
    if fecha_corte is not None:
        query += " AND fecha_venta::date <= %(fecha_corte)s"
        params["fecha_corte"] = fecha_corte

    with get_conexion() as conn:
        df = pd.read_sql(query, conn, params=params)
    return _ultimo_estado_por_contrato(df)


def leer_rueda_segura(periodo: dt.date, fecha_corte: dt.date | None = None) -> pd.DataFrame:
    """Trae las pólizas de Rueda Segura de Televentas de un periodo, en vivo
    desde ilio.v_rueda_segura (misma estructura que v_cuota_protegida, vista
    separada). A diferencia del Excel de auditoría RS (ver ruedas_seguro_repo),
    esta fuente sí refleja el corte completo del mes porque viene de Ilio."""
    colectivo = _colectivo_de(periodo)
    fecha_inicio = periodo.replace(day=1)  # primer día del mes — filtro de corte inferior
    query = """
        SELECT id_poliza, fecha_venta, fecha_digitacion, asesor, supervisor,
               estrategia, producto, plan, colectivo, entidad_facturacion,
               tarifa, nombre_estado, numero_contrato
        FROM ilio.v_rueda_segura
        WHERE estrategia = 'Televentas' AND colectivo IN (%(colectivo)s, %(colectivo_anual)s)
          AND supervisor = %(supervisor)s
          AND nombre_estado <> 'RENOVACION'
          AND fecha_venta::date >= %(fecha_inicio)s
          AND fecha_venta::date < %(fecha_fin)s
    """
    params: dict = _params_periodo(periodo, colectivo, fecha_inicio)
    if fecha_corte is not None:
        query += " AND fecha_venta::date <= %(fecha_corte)s"
        params["fecha_corte"] = fecha_corte

    with get_conexion() as conn:
        return pd.read_sql(query, conn, params=params)


def refrescar_ventas_mes_actual(periodo: dt.date, df_ventas: pd.DataFrame) -> None:
    """
    Reescribe (DELETE + INSERT) el caché de trabajo del mes en curso con las
    ventas ya leídas y con facturacion_servi ya calculada, para poder
    consultarlas directamente en SQL sin releer Ilio. Se llama en cada corrida
    de main.py mientras el periodo siga abierto; si ya está cerrado, no aplica
    (el histórico oficial es cierre_mensual, no esta tabla).
    """
    with get_conexion() as conn:
        cur = conn.cursor()
        cur.execute(
            "DELETE FROM como_vamos_televentas.ventas_mes_actual WHERE periodo = %s",
            (periodo,),
        )
        filas = [
            (
                periodo, r.id_poliza, r.fecha_venta, r.fecha_digitacion,
                r.asesor, r.supervisor, r.estrategia, r.producto, r.plan,
                r.colectivo, r.entidad_facturacion, r.tarifa, r.nombre_estado,
                float(r.facturacion_servi),
            )
            for r in df_ventas.itertuples(index=False)
        ]
        if filas:
            psycopg2.extras.execute_values(
                cur,
                """
                INSERT INTO como_vamos_televentas.ventas_mes_actual
                    (periodo, id_poliza, fecha_venta, fecha_digitacion,
                     asesor, supervisor, estrategia, producto, plan, colectivo,
                     entidad_facturacion, tarifa, nombre_estado, facturacion_servi)
                VALUES %s
                """,
                filas,
            )
        conn.commit()


def cerrar_mes(periodo: dt.date, cerrado_por: str, observaciones: str | None = None) -> int:
    """
    Declara el cierre de un periodo (llamado explícitamente cuando auditoría lo
    confirma, no automáticamente por calendario) y congela un snapshot de
    ilio.v_cuota_protegida hacia cierre_mensual.
    """
    if periodo_esta_cerrado(periodo):
        raise ValueError(f"El periodo {periodo} ya está cerrado.")

    df = leer_televentas(periodo)  # aún abierto -> lee en vivo

    with get_conexion() as conn:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO como_vamos_televentas.cierres_mes (periodo, cerrado_por, observaciones) "
            "VALUES (%s, %s, %s) RETURNING id_cierre",
            (periodo, cerrado_por, observaciones),
        )
        id_cierre = cur.fetchone()[0]

        filas = [
            (
                id_cierre, periodo, r.id_poliza, r.fecha_venta, r.fecha_digitacion,
                r.asesor, r.supervisor, r.estrategia, r.producto, r.plan,
                r.colectivo, r.entidad_facturacion, r.tarifa, r.nombre_estado,
            )
            for r in df.itertuples(index=False)
        ]
        psycopg2.extras.execute_values(
            cur,
            """
            INSERT INTO como_vamos_televentas.cierre_mensual
                (id_cierre, periodo, id_poliza, fecha_venta, fecha_digitacion,
                 asesor, supervisor, estrategia, producto, plan, colectivo,
                 entidad_facturacion, tarifa, nombre_estado)
            VALUES %s
            """,
            filas,
        )
        conn.commit()

    return id_cierre
