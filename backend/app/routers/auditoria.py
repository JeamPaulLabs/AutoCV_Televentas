"""Auditoría de Como Vamos por asesor -- solo para quien tiene alcance de
supervisión de televentas (hoy: Martha; el superadmin del portal también, como
en el resto del tablero). Cada guardado es una auditoría nueva (historial).

La tabla se crea sola la primera vez (sql/ddl_auditoria_asesor.sql) si el
usuario de la BD tiene permiso."""
from __future__ import annotations

import datetime as dt
import json
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from src.db import get_conexion

from ..auth_dep import es_supervisor_televentas, get_current_user
from .como_vamos import _norm_nombre, _parse_fecha, _parse_periodo

router = APIRouter()

# La imagen de producción no trae la carpeta sql/: el DDL va embebido (copia de
# sql/ddl_auditoria_asesor.sql).
_DDL = """
CREATE TABLE IF NOT EXISTS como_vamos_televentas.auditoria_asesor (
    id                   BIGSERIAL PRIMARY KEY,
    periodo              DATE        NOT NULL,              -- primer día del mes
    fecha_corte          DATE        NOT NULL,              -- corte del tablero auditado
    asesor               TEXT        NOT NULL,
    asesor_norm          TEXT        NOT NULL,
    auditor_id           INTEGER     NOT NULL,              -- sub del JWT (quién auditó)
    auditor_nombre       TEXT,
    items                JSONB       NOT NULL DEFAULT '{}'::jsonb,  -- {"meta": true, ...}
    resultado            TEXT        NOT NULL
                         CHECK (resultado IN ('conforme', 'con_observaciones', 'requiere_revision')),
    observaciones        TEXT,
    dias_calendario      INTEGER,                           -- días laborados según calendario
    dias_ajustados       INTEGER,                           -- días laborados ajustados por Martha
    fechas_no_laboradas  JSONB       NOT NULL DEFAULT '[]'::jsonb,
    motivo_dias          TEXT,
    novedades            JSONB       NOT NULL DEFAULT '[]'::jsonb,  -- [{tipo, desde, hasta, nota, afecto_ventas}]
    canceladas_audio     JSONB       NOT NULL DEFAULT '[]'::jsonb,  -- contratos marcados como falla de audio
    sugerencias          JSONB       NOT NULL DEFAULT '[]'::jsonb,  -- lo que mostraba el sistema al guardar
    resumen              JSONB       NOT NULL DEFAULT '{}'::jsonb,  -- meta, acumulado, % al momento de guardar
    creado_en            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_auditoria_asesor_periodo
    ON como_vamos_televentas.auditoria_asesor (periodo, asesor_norm, creado_en DESC);
"""
_tabla_lista = False

COLUMNAS = (
    "id, periodo, fecha_corte, asesor, auditor_nombre, items, resultado, observaciones, "
    "dias_calendario, dias_ajustados, fechas_no_laboradas, motivo_dias, novedades, "
    "canceladas_audio, sugerencias, resumen, creado_en"
)


def auditor_actual(current: dict = Depends(get_current_user)) -> dict:
    if not es_supervisor_televentas(current):
        raise HTTPException(403, "Solo la supervisión de televentas puede auditar.")
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
    sugerencias: list[str] = []
    resumen: dict = {}


def _fila_a_dict(cols: list[str], fila: tuple) -> dict:
    rec = dict(zip(cols, fila))
    for k, v in rec.items():
        if isinstance(v, (dt.date, dt.datetime)):
            rec[k] = v.isoformat()
    return rec


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
                return {"auditorias": [_fila_a_dict(cols, f) for f in cur.fetchall()]}
    except Exception as e:
        raise HTTPException(503, f"No se pudo leer el historial de auditorías: {e}")


@router.post("/auditorias", status_code=201)
def guardar(body: AuditoriaIn, current: dict = Depends(auditor_actual)):
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
                    "(periodo, fecha_corte, asesor, asesor_norm, auditor_id, auditor_nombre, items, "
                    " resultado, observaciones, dias_calendario, dias_ajustados, fechas_no_laboradas, "
                    " motivo_dias, novedades, canceladas_audio, sugerencias, resumen) "
                    "VALUES (%s,%s,%s,%s,%s,%s,%s::jsonb,%s,%s,%s,%s,%s::jsonb,%s,%s::jsonb,%s::jsonb,%s::jsonb,%s::jsonb) "
                    "RETURNING id, creado_en",
                    (
                        periodo_d, corte_d, body.asesor.strip(), _norm_nombre(body.asesor),
                        int(current["sub"]), current.get("nombre") or current.get("name"),
                        json.dumps(body.items), body.resultado, body.observaciones.strip(),
                        body.dias_calendario, body.dias_ajustados,
                        json.dumps([d.isoformat() for d in body.fechas_no_laboradas]),
                        body.motivo_dias.strip(),
                        json.dumps([n.model_dump(mode="json") for n in body.novedades]),
                        json.dumps(body.canceladas_audio), json.dumps(body.sugerencias),
                        json.dumps(body.resumen, default=str),
                    ),
                )
                id_, creado = cur.fetchone()
            conn.commit()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(503, f"No se pudo guardar la auditoría: {e}")
    return {"id": id_, "creado_en": creado.isoformat()}
