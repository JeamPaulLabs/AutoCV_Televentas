"""
CLI del motor 'Como Vamos Televentas'.

Uso:
  python main.py --periodo 2026-08                       # dashboard del mes en curso (lee Ilio en vivo)
  python main.py --periodo 2026-08 --fecha-corte 2026-08-12
  python main.py --periodo 2026-08 --cerrar-mes --cerrado-por "Nombre Auditor"
"""
from __future__ import annotations

import argparse
import datetime as dt
from pathlib import Path

from src.calculo import calcular_proyeccion
from src.calendario import Calendario
from src.exclusiones import cargar_excluidos
from src.ilio_repo import (
    cerrar_mes,
    leer_rueda_segura,
    leer_televentas,
    periodo_esta_cerrado,
    refrescar_ventas_mes_actual,
)
from src.metas_repo import asesores_sin_meta, leer_metas
from src.pivote import pivote_asesor_estado, resumen_por_dia, resumen_por_gasera, resumen_por_producto
from src.reporte_html import generar_dashboard
from src.ruedas_seguro_repo import combinar_con_ilio, leer_rs
from src.tarifas_repo import con_facturacion_servi, leer_tarifas, planes_sin_tarifa

OUT_DIR = Path(__file__).parent / "out"


def _parse_periodo(valor: str) -> dt.date:
    return dt.datetime.strptime(valor, "%Y-%m").date().replace(day=1)


def main() -> None:
    ap = argparse.ArgumentParser(description="Motor Como Vamos Televentas")
    ap.add_argument("--periodo", required=True, help="YYYY-MM, ej. 2026-08")
    ap.add_argument("--fecha-corte", default=None, help="YYYY-MM-DD, default hoy")
    ap.add_argument("--cerrar-mes", action="store_true", help="Declara el cierre del periodo (lo congela)")
    ap.add_argument("--cerrado-por", default=None, help="Nombre de quien declara el cierre (auditoría)")
    args = ap.parse_args()

    periodo = _parse_periodo(args.periodo)
    fecha_corte = (
        dt.datetime.strptime(args.fecha_corte, "%Y-%m-%d").date()
        if args.fecha_corte else dt.date.today()
    )

    if args.cerrar_mes:
        if not args.cerrado_por:
            raise SystemExit("--cerrar-mes requiere --cerrado-por \"Nombre\"")
        id_cierre = cerrar_mes(periodo, args.cerrado_por)
        print(f"Periodo {periodo} cerrado (id_cierre={id_cierre}).")

    df_ventas = leer_televentas(periodo, fecha_corte)
    df_metas = leer_metas(periodo)
    df_tarifas = leer_tarifas()
    df_ventas = con_facturacion_servi(df_ventas, df_tarifas)
    cerrado = periodo_esta_cerrado(periodo) is not None

    if not cerrado:
        refrescar_ventas_mes_actual(periodo, df_ventas)

    excluidos = cargar_excluidos()
    faltantes = asesores_sin_meta(df_ventas, df_metas, set(excluidos))
    if faltantes:
        print("AVISO: asesores con ventas pero sin meta cargada (revisar conciliación de nombres):")
        for nombre in faltantes:
            print(f"  - {nombre}")

    sin_tarifa = planes_sin_tarifa(df_ventas)
    if sin_tarifa:
        print("AVISO: planes vendidos sin tarifa/comisión SERVI registrada (Facturación SERVI queda en $0):")
        for plan in sin_tarifa:
            print(f"  - {plan}")

    cal = Calendario(periodo, fecha_corte)
    df_proyeccion = calcular_proyeccion(df_ventas, df_metas, cal, set(excluidos))

    df_rs_ilio = leer_rueda_segura(periodo, fecha_corte)
    try:
        df_rs = combinar_con_ilio(leer_rs(), df_rs_ilio, periodo=periodo)
    except FileNotFoundError as e:
        print(f"AVISO: no se pudo leer el Excel de auditoría RS, se usa solo Ilio: {e}")
        df_rs = df_rs_ilio

    html_out = generar_dashboard(
        periodo=periodo,
        fecha_corte=cal.fecha_corte,
        cal=cal,
        df_proyeccion=df_proyeccion,
        df_ventas=df_ventas,
        df_por_dia=resumen_por_dia(df_ventas),
        df_por_producto=resumen_por_producto(df_ventas),
        df_por_gasera=resumen_por_gasera(df_ventas),
        df_pivote_asesor_estado=pivote_asesor_estado(df_ventas, set(excluidos)),
        cerrado=cerrado,
        df_rs=df_rs,
    )

    ahora = dt.datetime.now()
    dir_salida = OUT_DIR / f"{ahora:%Y-%m}" / f"{ahora:%d}"
    dir_salida.mkdir(parents=True, exist_ok=True)
    timestamp = ahora.strftime("%Y%m%d_%H%M%S")
    salida = dir_salida / f"como_vamos_televentas_{periodo:%Y-%m}_{timestamp}.html"
    salida.write_text(html_out, encoding="utf-8")
    print(f"Dashboard generado: {salida}")
    print(f"Dias colectivo={cal.dias_colectivo} laborados={cal.dias_laborados} por_laborar={cal.dias_por_laborar}")
    print(f"Total ventas leidas: {len(df_ventas)}")


if __name__ == "__main__":
    main()
