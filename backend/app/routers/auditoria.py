"""Auditoría de Como Vamos por asesor, en dos miradas:

  - comercial: coordinación comercial (Martha) -- desempeño, meta, días, novedades.
  - interna:   auditoría de calidad (Kevin) -- cancelaciones, causales, subsanación.

Los dos roles pueden VER las auditorías de ambos tipos y el hilo de seguimiento;
cada uno solo GUARDA la suya (ver auth_dep.roles_auditoria). Cada guardado es una
fila nueva (historial), nunca se sobrescribe.

La tabla se crea sola la primera vez (el DDL va embebido: la imagen de
producción no trae la carpeta sql/; copia en sql/ddl_auditoria_asesor.sql).
"""
from __future__ import annotations

import datetime as dt
import json
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from src.db import get_conexion

from ..auth_dep import get_current_user, roles_auditoria
from .como_vamos import _norm_nombre, _parse_fecha, _parse_periodo

router = APIRouter()

_DDL = """
CREATE TABLE IF NOT EXISTS como_vamos_televentas.auditoria_asesor (
    id                   BIGSERIAL PRIMARY KEY,
    tipo                 TEXT        NOT NULL DEFAULT 'comercial'
                         CHECK (tipo IN ('comercial', 'interna')),
    periodo              DATE        NOT NULL,
    fecha_corte          DATE        NOT NULL,
    asesor               TEXT        NOT NULL,
    asesor_norm          TEXT        NOT NULL,
    auditor_id           INTEGER     NOT NULL,
    auditor_nombre       TEXT,
    items                JSONB       NOT NULL DEFAULT '{}'::jsonb,
    resultado            TEXT        NOT NULL
                         CHECK (resultado IN ('conforme', 'con_observaciones', 'requiere_revision')),
    observaciones        TEXT,
    dias_calendario      INTEGER,
    dias_ajustados       INTEGER,
    fechas_no_laboradas  JSONB       NOT NULL DEFAULT '[]'::jsonb,
    motivo_dias          TEXT,
    novedades            JSONB       NOT NULL DEFAULT '[]'::jsonb,
    canceladas_audio     JSONB       NOT NULL DEFAULT '[]'::jsonb,
    eventualidades       JSONB       NOT NULL DEFAULT '{}'::jsonb,
    sugerencias          JSONB       NOT NULL DEFAULT '[]'::jsonb,
    resumen              JSONB       NOT NULL DEFAULT '{}'::jsonb,
    creado_en            TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE como_vamos_televentas.auditoria_asesor
    ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'comercial',
    ADD COLUMN IF NOT EXISTS eventualidades JSONB NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS ix_auditoria_asesor_periodo
    ON como_vamos_televentas.auditoria_asesor (periodo, asesor_norm, tipo, creado_en DESC);

CREATE TABLE IF NOT EXISTS como_vamos_televentas.auditoria_seguimiento (
    id            BIGSERIAL PRIMARY KEY,
    periodo       DATE        NOT NULL,
    asesor        TEXT        NOT NULL,
    asesor_norm   TEXT        NOT NULL,
    autor_id      INTEGER     NOT NULL,
    autor_nombre  TEXT,
    rol           TEXT        NOT NULL CHECK (rol IN ('comercial', 'interna')),
    texto         TEXT        NOT NULL,
    creado_en     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_auditoria_seguimiento_asesor
    ON como_vamos_televentas.auditoria_seguimiento (periodo, asesor_norm, creado_en);
"""
_tabla_lista = False

COLUMNAS = (
    "id, tipo, periodo, fecha_corte, asesor, auditor_nombre, items, resultado, observaciones, "
    "dias_calendario, dias_ajustados, fechas_no_laboradas, motivo_dias, novedades, "
    "canceladas_audio, eventualidades, sugerencias, resumen, creado_en"
)


def auditor_actual(current: dict = Depends(get_current_user)) -> dict:
    if not roles_auditoria(current):
        raise HTTPException(403, "Solo coordinación comercial o auditoría interna pueden usar la auditoría.")
    return current


def _asegurar_tabla(conn) -> None:
    global _tabla_lista
    if _tabla_lista:
        return
    with conn.cursor() as cur:
        cur.execute(_DDL)
    conn.commit()
    _tabla_lista = True


class Novedad(BaseModel):
    tipo: str = Field(max_length=60)
    desde: dt.date | None = None
    hasta: dt.date | None = None
    nota: str = Field("", max_length=1000)
    afecto_ventas: bool = False


class AuditoriaIn(BaseModel):
    tipo: Literal["comercial", "interna"]
    periodo: str
    fecha_corte: str
    asesor: str = Field(min_length=1, max_length=200)
    items: dict[str, bool] = {}
    resultado: Literal["conforme", "con_observaciones", "requiere_revision"]
    observaciones: str = Field("", max_length=4000)
    dias_calendario: int | None = Field(None, ge=0, le=31)
    dias_ajustados: int | None = Field(None, ge=0, le=31)
    fechas_no_laboradas: list[dt.date] = []
    motivo_dias: str = Field("", max_length=200)
    novedades: list[Novedad] = []
    canceladas_audio: list[str] = []
    eventualidades: dict[str, str] = {}
    sugerencias: list[str] = []
    resumen: dict = {}


class SeguimientoIn(BaseModel):
    periodo: str
    asesor: str = Field(min_length=1, max_length=200)
    rol: Literal["comercial", "interna"]
    texto: str = Field(min_length=1, max_length=2000)


def _fila_a_dict(cols: list[str], fila: tuple) -> dict:
    rec = dict(zip(cols, fila))
    for k, v in rec.items():
        if isinstance(v, (dt.date, dt.datetime)):
            rec[k] = v.isoformat()
    return rec


def _nombre(current: dict) -> str | None:
    return current.get("nombre") or current.get("name")


@router.get("/auditorias")
def listar(
    periodo: str = Query(..., description="YYYY-MM"),
    asesor: str = Query(..., min_length=1),
    current: dict = Depends(auditor_actual),
):
    periodo_d = _parse_periodo(periodo)
    try:
        with get_conexion() as conn:
            _asegurar_tabla(conn)
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT {COLUMNAS} FROM como_vamos_televentas.auditoria_asesor "
                    "WHERE periodo = %s AND asesor_norm = %s ORDER BY creado_en DESC",
                    (periodo_d, _norm_nombre(asesor)),
                )
                cols = [d[0] for d in cur.description]
                return {
                    "roles": sorted(roles_auditoria(current)),
                    "auditorias": [_fila_a_dict(cols, f) for f in cur.fetchall()],
                }
    except Exception as e:
        raise HTTPException(503, f"No se pudo leer el historial de auditorías: {e}")


@router.post("/auditorias", status_code=201)
def guardar(body: AuditoriaIn, current: dict = Depends(auditor_actual)):
    if body.tipo not in roles_auditoria(current):
        raise HTTPException(403, f"No tienes el rol para guardar una auditoría {body.tipo}.")
    periodo_d = _parse_periodo(body.periodo)
    corte_d = _parse_fecha(body.fecha_corte)
    if body.dias_ajustados is not None and body.dias_calendario is not None:
        if body.dias_ajustados > body.dias_calendario:
            raise HTTPException(400, "Los días ajustados no pueden superar los días del calendario.")
    try:
        with get_conexion() as conn:
            _asegurar_tabla(conn)
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO como_vamos_televentas.auditoria_asesor "
                    "(tipo, periodo, fecha_corte, asesor, asesor_norm, auditor_id, auditor_nombre, items, "
                    " resultado, observaciones, dias_calendario, dias_ajustados, fechas_no_laboradas, "
                    " motivo_dias, novedades, canceladas_audio, eventualidades, sugerencias, resumen) "
                    "VALUES (%s,%s,%s,%s,%s,%s,%s,%s::jsonb,%s,%s,%s,%s,%s::jsonb,%s,%s::jsonb,%s::jsonb,%s::jsonb,%s::jsonb,%s::jsonb) "
                    "RETURNING id, creado_en",
                    (
                        body.tipo, periodo_d, corte_d, body.asesor.strip(), _norm_nombre(body.asesor),
                        int(current["sub"]), _nombre(current),
                        json.dumps(body.items), body.resultado, body.observaciones.strip(),
                        body.dias_calendario, body.dias_ajustados,
                        json.dumps([d.isoformat() for d in body.fechas_no_laboradas]),
                        body.motivo_dias.strip(),
                        json.dumps([n.model_dump(mode="json") for n in body.novedades]),
                        json.dumps(body.canceladas_audio), json.dumps(body.eventualidades),
                        json.dumps(body.sugerencias), json.dumps(body.resumen, default=str),
                    ),
                )
                id_, creado = cur.fetchone()
            conn.commit()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(503, f"No se pudo guardar la auditoría: {e}")
    return {"id": id_, "creado_en": creado.isoformat()}


@router.get("/auditorias/seguimiento")
def listar_seguimiento(
    periodo: str = Query(..., description="YYYY-MM"),
    asesor: str = Query(..., min_length=1),
    current: dict = Depends(auditor_actual),
):
    periodo_d = _parse_periodo(periodo)
    try:
        with get_conexion() as conn:
            _asegurar_tabla(conn)
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id, rol, autor_nombre, texto, creado_en "
                    "FROM como_vamos_televentas.auditoria_seguimiento "
                    "WHERE periodo = %s AND asesor_norm = %s ORDER BY creado_en",
                    (periodo_d, _norm_nombre(asesor)),
                )
                cols = [d[0] for d in cur.description]
                return {"seguimiento": [_fila_a_dict(cols, f) for f in cur.fetchall()]}
    except Exception as e:
        raise HTTPException(503, f"No se pudo leer el seguimiento: {e}")


@router.post("/auditorias/seguimiento", status_code=201)
def guardar_seguimiento(body: SeguimientoIn, current: dict = Depends(auditor_actual)):
    if body.rol not in roles_auditoria(current):
        raise HTTPException(403, f"No tienes el rol {body.rol}.")
    periodo_d = _parse_periodo(body.periodo)
    try:
        with get_conexion() as conn:
            _asegurar_tabla(conn)
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO como_vamos_televentas.auditoria_seguimiento "
                    "(periodo, asesor, asesor_norm, autor_id, autor_nombre, rol, texto) "
                    "VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING id, creado_en",
                    (periodo_d, body.asesor.strip(), _norm_nombre(body.asesor),
                     int(current["sub"]), _nombre(current), body.rol, body.texto.strip()),
                )
                id_, creado = cur.fetchone()
            conn.commit()
    except Exception as e:
        raise HTTPException(503, f"No se pudo guardar el seguimiento: {e}")
    return {"id": id_, "creado_en": creado.isoformat()}
