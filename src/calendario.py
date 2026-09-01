"""Días colectivo / laborados / por laborar de un periodo.

Regla validada contra el ejemplo real de julio 2026 (COMO VAMOS POR ASESOR.xlsx,
hoja PROYECCIÓN: 'Dias colectivo' = 21): el calendario de Televentas es
lunes a viernes (sin sábados), excluyendo festivos colombianos. Contando así
julio 2026 da exactamente 21, lo que confirma la regla.
"""
from __future__ import annotations

import calendar
import datetime as dt

import holidays

_CO_HOLIDAYS_CACHE: dict[int, holidays.HolidayBase] = {}


def _festivos_colombia(anio: int) -> holidays.HolidayBase:
    if anio not in _CO_HOLIDAYS_CACHE:
        _CO_HOLIDAYS_CACHE[anio] = holidays.Colombia(years=anio)
    return _CO_HOLIDAYS_CACHE[anio]


def es_dia_habil(fecha: dt.date) -> bool:
    """Lunes a viernes, sin festivos colombianos."""
    return fecha.weekday() < 5 and fecha not in _festivos_colombia(fecha.year)


def dias_habiles(inicio: dt.date, fin: dt.date) -> int:
    """Cuenta días hábiles entre inicio y fin, ambos inclusive."""
    if fin < inicio:
        return 0
    total = 0
    dia = inicio
    while dia <= fin:
        if es_dia_habil(dia):
            total += 1
        dia += dt.timedelta(days=1)
    return total


class Calendario:
    """Días colectivo / laborados / por laborar de un periodo (mes) a una fecha de corte."""

    def __init__(self, periodo: dt.date, fecha_corte: dt.date | None = None):
        self.periodo = periodo
        ultimo_dia = calendar.monthrange(periodo.year, periodo.month)[1]
        self.inicio_mes = periodo.replace(day=1)
        self.fin_mes = periodo.replace(day=ultimo_dia)
        self.fecha_corte = fecha_corte or dt.date.today()
        if self.fecha_corte > self.fin_mes:
            self.fecha_corte = self.fin_mes

    @property
    def dias_colectivo(self) -> int:
        return dias_habiles(self.inicio_mes, self.fin_mes)

    @property
    def dias_laborados(self) -> int:
        return dias_habiles(self.inicio_mes, self.fecha_corte)

    @property
    def dias_por_laborar(self) -> int:
        return max(self.dias_colectivo - self.dias_laborados, 0)
