"""Traducción a Python de las fórmulas de COMO VAMOS POR ASESOR.xlsx (hoja PROYECCIÓN).

Meta del mes = meta_escala_1 (la meta base del acta de comisiones; escala 2/3
son metas de sobre-ejecución, ver escala_alcanzada). El acumulado de "Como
vamos por asesor" cuenta TODOS los estados (incluidas canceladas), no solo
venta positiva/efectiva -- es el conteo bruto digitado a la fecha.
"""
from __future__ import annotations

import pandas as pd

from src.calendario import Calendario
from src.metas_repo import normalizar_nombre


def _dividir(a: float, b: float) -> float:
    return a / b if b else 0.0


def _escala_alcanzada(acumulado: int, metas: pd.Series) -> tuple[int, float]:
    """Devuelve (escala alcanzada 0-3, base a pagar) según el acta: hay que
    cumplir el 100% de una escala para activarla; si se supera una escala pero
    no se alcanza la siguiente, se liquida por la escala alcanzada."""
    escala, base = 0, 0.0
    for n in (1, 2, 3):
        meta_n = metas.get(f"meta_escala_{n}")
        base_n = metas.get(f"base_pago_escala_{n}")
        if pd.notna(meta_n) and acumulado >= meta_n:
            escala, base = n, float(base_n) if pd.notna(base_n) else 0.0
    return escala, base


def calcular_proyeccion(
    df_ventas: pd.DataFrame, df_metas: pd.DataFrame, cal: Calendario, excluidos: set[str] | None = None,
    factor_meta: float = 1.0,
) -> pd.DataFrame:
    """
    Una fila por asesor con la cadena completa de la hoja PROYECCIÓN:
    meta_mes, acumulado, %cumpl_acumulado, meta_diaria, faltan_para_meta,
    venta_necesaria_dia, meta_ideal_a_la_fecha, %cump_ideal, prom_por_dia,
    forecast, forecast_%, escala_alcanzada, base_pago_proyectada.

    factor_meta: con un otrosí vigente la comisión se habilita desde ese % de la
    meta individual (ej. 0.70). meta_mes sigue siendo la meta del acta (100%);
    meta_ajustada = meta_mes * factor_meta, y sobre ella se calculan el %
    de cumplimiento, lo que falta, la venta necesaria, el ideal y el forecast. La
    escala 1 se activa al llegar a la meta ajustada; las escalas 2 y 3 conservan
    sus metas del acta.
    """
    df = df_ventas.copy()
    df["asesor_norm"] = df["asesor"].map(normalizar_nombre)

    conteos = df.groupby("asesor_norm").agg(
        asesor=("asesor", "first"),
        acumulado=("id_poliza", "count"),
    ).reset_index()

    metas = df_metas.set_index("asesor_norm")
    filas = []
    excluidos = excluidos or set()
    todos = (set(conteos["asesor_norm"]) | set(metas.index)) - excluidos

    for asesor_norm in sorted(todos):
        fila_conteo = conteos[conteos["asesor_norm"] == asesor_norm]
        acumulado = int(fila_conteo["acumulado"].iloc[0]) if not fila_conteo.empty else 0
        nombre_mostrar = (
            fila_conteo["asesor"].iloc[0] if not fila_conteo.empty
            else metas.loc[asesor_norm, "asesor"] if asesor_norm in metas.index else asesor_norm
        )

        if asesor_norm in metas.index:
            m = metas.loc[asesor_norm]
            categoria = m["categoria"]
            meta_mes = int(m["meta_escala_1"])
            m_ef = m.copy()
            m_ef["meta_escala_1"] = m["meta_escala_1"] * factor_meta
            escala, base_pago = _escala_alcanzada(acumulado, m_ef)
            obs = m.get("observaciones")
            observaciones = obs if isinstance(obs, str) else ""
        else:
            categoria, meta_mes, escala, base_pago = "SIN META", 0, 0, 0.0
            observaciones = ""

        meta_ajustada = meta_mes * factor_meta
        meta_diaria = _dividir(meta_ajustada, cal.dias_colectivo)
        faltan_para_meta = meta_ajustada - acumulado
        venta_necesaria_dia = _dividir(faltan_para_meta, cal.dias_por_laborar)
        meta_ideal_a_la_fecha = meta_diaria * cal.dias_laborados
        prom_por_dia = _dividir(acumulado, cal.dias_laborados)
        forecast = prom_por_dia * cal.dias_colectivo

        filas.append({
            "asesor": nombre_mostrar,
            "categoria": categoria,
            "meta_mes": meta_mes,
            "meta_ajustada": meta_ajustada,
            "acumulado": acumulado,
            "pct_cumpl_acumulado": _dividir(acumulado, meta_ajustada),
            "meta_diaria": meta_diaria,
            "faltan_para_meta": faltan_para_meta,
            "venta_necesaria_dia": venta_necesaria_dia,
            "meta_ideal_a_la_fecha": meta_ideal_a_la_fecha,
            "pct_cump_ideal": _dividir(meta_ideal_a_la_fecha, meta_ajustada),
            "prom_por_dia": prom_por_dia,
            "forecast": forecast,
            "pct_forecast": _dividir(forecast, meta_ajustada),
            "escala_alcanzada": escala,
            "base_pago_proyectada": base_pago,
            "observaciones": observaciones,
        })

    return pd.DataFrame(filas)
