"""Dashboard HTML de 'Como Vamos Televentas', marca Xuma.

Paleta: cromo de marca Xuma (índigo + verde) para encabezado/UI; para datos
(semáforo de cumplimiento) se usa la paleta de estado validada de la skill
dataviz (good/warning/critical) — nunca se inventa un color para eso.
"""
from __future__ import annotations

import datetime as dt
import html

import pandas as pd

from src.calendario import Calendario
from src.ilio_repo import MESES_ES
from src.pivote import kpis_facturacion, resumen_por_estado, resumen_rs_por_asesor, resumen_rs_por_dia

# -- Paleta de estado (dataviz, fija, no se retematiza) -----------------------
GOOD = "#0ca30c"
WARNING = "#fab219"
CRITICAL = "#d03b3b"

# -- Marca Xuma -----------------------------------------------------------
XUMA_INDIGO = "#1B0F6E"
XUMA_INDIGO_DARK = "#120A4A"
XUMA_GREEN = "#3ECF7E"


def _semaforo(pct_cumpl: float, pct_cump_ideal: float) -> str:
    if pct_cump_ideal <= 0:
        return GOOD
    razon = pct_cumpl / pct_cump_ideal
    if razon >= 1.0:
        return GOOD
    if razon >= 0.8:
        return WARNING
    return CRITICAL


def _fmt_pct(x: float) -> str:
    return f"{x * 100:.1f}%"


def _fmt_money(x: float) -> str:
    return f"$ {x:,.0f}".replace(",", ".")


def _nombre_corto(nombre: str) -> str:
    """Primer nombre + primer apellido (asume 'Nombre1 [Nombre2] Apellido1 [Apellido2]'),
    para que quepa en una tarjeta angosta. El nombre completo se sigue mostrando
    en las tablas de detalle."""
    tokens = nombre.split()
    if len(tokens) <= 2:
        return nombre
    mitad = (len(tokens) + 1) // 2
    return f"{tokens[0]} {tokens[mitad]}"


def _tabla_facturacion(df: pd.DataFrame, col_etiqueta: str, etiqueta: str) -> str:
    """Tabla estilo plantilla: <etiqueta> | Cant./Pólizas | Facturación SERVI | % Participación.
    Espera columnas [col_etiqueta, 'cantidad'|'polizas', 'facturacion_servi', 'pct_participacion']."""
    col_cant = "polizas" if "polizas" in df.columns else "cantidad"
    etiqueta_cant = "Pólizas" if col_cant == "polizas" else "Cant."

    filas = []
    for _, row in df.iterrows():
        filas.append(
            f"<tr><td>{html.escape(str(row[col_etiqueta]))}</td>"
            f"<td class='num'>{row[col_cant]:,.0f}</td>"
            f"<td class='num'>{_fmt_money(row['facturacion_servi'])}</td>"
            f"<td class='num'>{_fmt_pct(row['pct_participacion'])}</td></tr>"
        )
    total_cant = df[col_cant].sum()
    total_fact = df["facturacion_servi"].sum()
    return f"""
    <table class="tabla">
      <thead><tr><th>{html.escape(etiqueta)}</th><th>{etiqueta_cant}</th><th>Facturación SERVI</th><th>% Part.</th></tr></thead>
      <tbody>{''.join(filas)}</tbody>
      <tfoot><tr><td>Total general</td><td class="num">{total_cant:,.0f}</td><td class="num">{_fmt_money(total_fact)}</td><td class="num">100,0%</td></tr></tfoot>
    </table>
    """


def _tabla_conteo(df: pd.DataFrame, col_etiqueta: str, etiqueta: str) -> str:
    """Igual a _tabla_facturacion pero sin la columna de dinero -- para el
    resumen 'Vanti' (sin ningún valor de Facturación SERVI). % participación
    se recalcula sobre la cantidad, no sobre la facturación."""
    col_cant = "polizas" if "polizas" in df.columns else "cantidad"
    etiqueta_cant = "Pólizas" if col_cant == "polizas" else "Cant."
    total_cant = df[col_cant].sum()

    filas = []
    for _, row in df.iterrows():
        pct = row[col_cant] / total_cant if total_cant else 0.0
        filas.append(
            f"<tr><td>{html.escape(str(row[col_etiqueta]))}</td>"
            f"<td class='num'>{row[col_cant]:,.0f}</td>"
            f"<td class='num'>{_fmt_pct(pct)}</td></tr>"
        )
    return f"""
    <table class="tabla">
      <thead><tr><th>{html.escape(etiqueta)}</th><th>{etiqueta_cant}</th><th>% Part.</th></tr></thead>
      <tbody>{''.join(filas)}</tbody>
      <tfoot><tr><td>Total general</td><td class="num">{total_cant:,.0f}</td><td class="num">100,0%</td></tr></tfoot>
    </table>
    """


def _tabla_dias_sin_fact(df: pd.DataFrame) -> str:
    """Desempeño diario sin facturación: fecha | ventas | % participación."""
    total_ventas = df["polizas"].sum()
    filas = []
    for _, row in df.iterrows():
        pct = row["polizas"] / total_ventas if total_ventas else 0.0
        filas.append(
            f"<tr><td>{html.escape(str(row['fecha_venta']))}</td>"
            f"<td class='num'>{row['polizas']:,.0f}</td>"
            f"<td class='num'>{_fmt_pct(pct)}</td></tr>"
        )
    return f"""
    <table class="tabla">
      <thead><tr><th>Fecha</th><th>Ventas</th><th>% Part.</th></tr></thead>
      <tbody>{''.join(filas)}</tbody>
      <tfoot><tr><td>Total general</td><td class="num">{total_ventas:,.0f}</td><td class="num">100,0%</td></tr></tfoot>
    </table>
    """


def _tabla_dias(df: pd.DataFrame) -> str:
    """Desempeño diario: fecha | ventas | facturación | % participación (sin barra)."""
    filas = []
    for _, row in df.iterrows():
        filas.append(
            f"<tr><td>{html.escape(str(row['fecha_venta']))}</td>"
            f"<td class='num'>{row['polizas']:,.0f}</td>"
            f"<td class='num'>{_fmt_money(row['facturacion_servi'])}</td>"
            f"<td class='num'>{_fmt_pct(row['pct_participacion'])}</td></tr>"
        )
    total_ventas = df["polizas"].sum()
    total_fact = df["facturacion_servi"].sum()
    return f"""
    <table class="tabla">
      <thead><tr><th>Fecha</th><th>Ventas</th><th>Facturación</th><th>% Part.</th></tr></thead>
      <tbody>{''.join(filas)}</tbody>
      <tfoot><tr><td>Total general</td><td class="num">{total_ventas:,.0f}</td><td class="num">{_fmt_money(total_fact)}</td><td class="num">100,0%</td></tr></tfoot>
    </table>
    """


def _podio(df: pd.DataFrame) -> str:
    """Top 3 del mes, en orden 1-2-3, con el número de puesto en una placa
    rectangular al lado de la tarjeta -- borde superior oro/plata/bronce por
    puesto, mismo lenguaje visual que el acento verde del resto del dashboard."""
    top3 = df[df["categoria"] != "SIN META"].sort_values("acumulado", ascending=False).head(3)
    if top3.empty:
        return "<div class='barras-vacio'>Sin datos</div>"

    columnas = []
    for i, (_, row) in enumerate(top3.iterrows(), start=1):
        columnas.append(f"""
        <div class="podio-col">
          <div class="podio-info podio-info-{i}">
            <div class="podio-rango podio-rango-{i}">{i}</div>
            <div class="podio-texto">
              <div class="podio-nombre">{html.escape(_nombre_corto(str(row['asesor'])))}</div>
              <div class="podio-valor">{row['acumulado']:,.0f}</div>
              <div class="podio-sub">{_fmt_pct(row['pct_cumpl_acumulado'])} de la meta</div>
            </div>
          </div>
        </div>
        """)
    return "".join(columnas)


def _tabla_pivote(tabla: pd.DataFrame, col_indice: str) -> str:
    """Renderiza una tabla pivote de pandas (index=asesor, columns=estado,
    última fila 'Total general') como HTML, con scroll horizontal si hay
    muchas columnas."""
    columnas = list(tabla.columns)
    encabezado = "".join(f"<th>{html.escape(str(c))}</th>" for c in columnas)
    filas = []
    for idx, row in tabla.iterrows():
        celdas = "".join(f"<td class='num'>{int(v):,}</td>" for v in row)
        es_total = str(idx) == "Total general"
        fila_html = f"<tr{' class=\"fila-total\"' if es_total else ''}><td>{html.escape(str(idx))}</td>{celdas}</tr>"
        filas.append(fila_html)
    return f"""
    <div class="tabla-scroll">
      <table class="tabla tabla-pivote">
        <thead><tr><th>{html.escape(col_indice)}</th>{encabezado}</tr></thead>
        <tbody>{''.join(filas)}</tbody>
      </table>
    </div>
    """


def _fila_asesor(fila: pd.Series) -> str:
    color = _semaforo(fila["pct_cumpl_acumulado"], fila["pct_cump_ideal"])
    ancho = min(fila["pct_cumpl_acumulado"] * 100, 100)
    escala_txt = f"Escala {int(fila['escala_alcanzada'])}" if fila["escala_alcanzada"] else "—"
    obs = fila.get("observaciones", "")
    nota_obs = (
        f'<div style="font-size:11px;line-height:1.2;color:#b8860b;margin-top:2px">ⓘ {html.escape(obs)}</div>'
        if isinstance(obs, str) and obs else ""
    )
    return f"""
    <tr>
      <td>{html.escape(str(fila['asesor']))}{nota_obs}</td>
      <td>{html.escape(str(fila['categoria']))}</td>
      <td class="num">{fila['meta_mes']:,.0f}</td>
      <td class="num">{fila['acumulado']:,.0f}</td>
      <td>
        <div class="meter">
          <div class="meter-track">
            <div class="meter-fill" style="width:{ancho:.1f}%; background:{color};"></div>
          </div>
          <span class="meter-label">{_fmt_pct(fila['pct_cumpl_acumulado'])}</span>
        </div>
      </td>
      <td class="num">{_fmt_pct(fila['pct_cump_ideal'])}</td>
      <td class="num">{fila['venta_necesaria_dia']:.1f}</td>
      <td class="num">{fila['forecast']:.0f}</td>
      <td class="num">{_fmt_pct(fila['pct_forecast'])}</td>
      <td>{escala_txt}</td>
      <td class="num">{_fmt_money(fila['base_pago_proyectada'])}</td>
    </tr>
    """


def _stat_tile(label: str, value: str, sub: str = "") -> str:
    sub_html = f'<div class="stat-sub">{html.escape(sub)}</div>' if sub else ""
    return f"""
    <div class="stat-tile">
      <div class="stat-label">{html.escape(label)}</div>
      <div class="stat-value">{html.escape(value)}</div>
      {sub_html}
    </div>
    """


def generar_dashboard(
    periodo: dt.date,
    fecha_corte: dt.date,
    cal: Calendario,
    df_proyeccion: pd.DataFrame,
    df_ventas: pd.DataFrame,
    df_por_dia: pd.DataFrame,
    df_por_producto: pd.DataFrame,
    df_por_gasera: pd.DataFrame,
    df_pivote_asesor_estado: pd.DataFrame,
    cerrado: bool,
    df_rs: pd.DataFrame | None = None,
) -> str:
    # df_rs: pólizas de Rueda Segura (ilio.v_rueda_segura, mismo esquema que
    # df_ventas) -- reporte separado de Cuota Protegida, nunca se suma al
    # acumulado de "Como vamos por asesor" (ver validación RS agosto 2026).
    meta_total = df_proyeccion["meta_mes"].sum()
    acumulado_total = df_proyeccion["acumulado"].sum()
    forecast_total = df_proyeccion["forecast"].sum()
    pct_cumpl_total = acumulado_total / meta_total if meta_total else 0
    pct_forecast_total = forecast_total / meta_total if meta_total else 0

    df_asesores = df_proyeccion.sort_values("pct_cumpl_acumulado", ascending=False)
    filas_asesores = "".join(_fila_asesor(f) for _, f in df_asesores.iterrows())

    kpis = kpis_facturacion(df_ventas, df_por_producto, df_por_gasera)

    df_por_dia_str = df_por_dia.assign(fecha_venta=df_por_dia["fecha_venta"].astype(str))
    tabla_dias = _tabla_dias(df_por_dia_str)
    tabla_producto = _tabla_facturacion(df_por_producto, "producto", "Producto")
    tabla_gasera = _tabla_facturacion(df_por_gasera, "entidad_facturacion", "Gasera")
    tabla_estados = _tabla_facturacion(resumen_por_estado(df_ventas), "nombre_estado", "Estado")
    tabla_detalle_asesor = _tabla_pivote(df_pivote_asesor_estado, "Asesor")
    podio = _podio(df_proyeccion)

    tabla_dias_vanti = _tabla_dias_sin_fact(df_por_dia_str)
    tabla_producto_vanti = _tabla_conteo(df_por_producto, "producto", "Producto")
    tabla_gasera_vanti = _tabla_conteo(df_por_gasera, "entidad_facturacion", "Gasera")

    tabla_rs = (
        _tabla_conteo(
            resumen_rs_por_dia(df_rs).assign(fecha_venta=lambda d: d["fecha_venta"].astype(str)),
            "fecha_venta", "Fecha (RS)",
        )
        if df_rs is not None and not df_rs.empty
        else None
    )
    tabla_rs_asesor = (
        _tabla_conteo(resumen_rs_por_asesor(df_rs), "asesor", "Asesor (RS)")
        if df_rs is not None and not df_rs.empty
        else None
    )

    estado_corte = "CERRADO POR AUDITORÍA" if cerrado else "EN CURSO — datos en vivo de Ilio"
    mes_nombre = f"{MESES_ES[periodo.month]} {periodo.year}"

    return f"""<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Como Vamos Televentas — {html.escape(mes_nombre)}</title>
<style>
  :root {{
    --indigo: {XUMA_INDIGO};
    --indigo-dark: {XUMA_INDIGO_DARK};
    --green: {XUMA_GREEN};
    --surface: #fcfcfb;
    --surface-2: #f2f1ee;
    --text-primary: #0b0b0b;
    --text-secondary: #52514e;
    --text-muted: #898781;
    --border: rgba(11,11,11,0.10);
  }}
  * {{ box-sizing: border-box; }}
  body {{
    margin: 0; background: var(--surface-2); color: var(--text-primary);
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  }}
  header {{
    background: var(--indigo); color: #fff; padding: 20px 32px; border-bottom: 4px solid var(--green);
  }}
  header h1 {{ margin: 0 0 2px; font-size: 22px; letter-spacing: 0.3px; font-weight: 700; }}
  header .sub {{ opacity: 0.85; font-size: 13px; }}
  .badge {{
    display: inline-block; margin-top: 8px; padding: 3px 8px; font-size: 11px; font-weight: 600;
    letter-spacing: 0.3px; border: 1px solid rgba(255,255,255,0.4);
  }}
  main {{ padding: 24px 32px; max-width: 1400px; margin: 0 auto; }}
  h2 {{ font-size: 14px; color: var(--text-primary); text-transform: uppercase; letter-spacing: 0.4px;
        margin: 24px 0 8px; font-weight: 700; border-bottom: 2px solid var(--indigo); padding-bottom: 4px; }}
  .stat-row {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; }}
  .stat-tile {{
    background: var(--surface); border: 1px solid var(--border); padding: 12px 14px;
  }}
  .stat-label {{ font-size: 11px; color: var(--text-secondary); margin-bottom: 4px; }}
  .stat-value {{ font-size: 22px; font-weight: 700; }}
  .stat-sub {{ font-size: 11px; color: var(--text-muted); margin-top: 2px; }}
  .grid-2 {{ display: grid; grid-template-columns: 1fr 1fr; gap: 16px; align-items: start; }}
  .grid-3 {{ display: grid; grid-template-columns: 1.2fr 1.2fr 1fr; gap: 16px; align-items: start; }}
  .tabla {{
    width: 100%; border-collapse: collapse; background: var(--surface); font-size: 13px;
    border: 1px solid var(--border);
  }}
  .tabla th {{
    background: var(--indigo); color: #fff; text-align: left; padding: 7px 10px; font-weight: 600;
  }}
  .tabla td {{ padding: 6px 10px; border-bottom: 1px solid var(--border); }}
  .tabla tfoot td {{ font-weight: 700; background: var(--surface-2); }}
  table.asesores {{ width: 100%; border-collapse: collapse; font-size: 13px; background: var(--surface); border: 1px solid var(--border); }}
  table.asesores th {{
    background: var(--indigo); color: #fff; text-align: left; padding: 8px 10px; position: sticky; top: 0;
  }}
  table.asesores td {{ padding: 7px 10px; border-bottom: 1px solid var(--border); }}
  table.asesores td.num {{ text-align: right; font-variant-numeric: tabular-nums; }}
  .meter {{ display: flex; align-items: center; gap: 8px; min-width: 140px; }}
  .meter-track {{ flex: 1; height: 7px; background: var(--surface-2); overflow: hidden; }}
  .meter-fill {{ height: 100%; }}
  .meter-label {{ font-size: 12px; font-variant-numeric: tabular-nums; color: var(--text-secondary); min-width: 44px; }}
  .kpi-row {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; align-items: start; }}
  .kpi-row-5 {{ grid-template-columns: repeat(5, 1fr); }}
  .kpi-row-4 {{ grid-template-columns: repeat(4, 1fr); }}
  .kpi-row-titulos {{ display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; }}
  .kpi-row-titulo {{ margin: 24px 0 8px !important; }}
  .kpi-tile {{
    background: var(--surface); border: 1px solid var(--border); padding: 14px 16px;
  }}
  .kpi-label {{ font-size: 11px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 4px; }}
  .kpi-value {{ font-size: 20px; font-weight: 700; color: var(--indigo-dark); }}
  .kpi-sub {{ font-size: 11px; color: var(--text-muted); margin-top: 2px; }}
  .podio-col {{ display: flex; flex-direction: column; align-items: stretch; }}
  .podio-info {{
    background: var(--surface); border: 1px solid var(--border); padding: 14px 16px 12px;
    display: flex; align-items: flex-start; gap: 10px;
  }}
  .podio-info-1 {{ border-top: 3px solid #C9A227; }}
  .podio-info-2 {{ border-top: 3px solid #A7A9AC; }}
  .podio-info-3 {{ border-top: 3px solid #B0703A; }}
  .podio-rango {{
    flex: none; width: 28px; height: 26px; border-radius: 3px; color: #fff;
    font-size: 13px; font-weight: 800; display: flex; align-items: center; justify-content: center;
  }}
  .podio-rango-1 {{ background: #C9A227; }}
  .podio-rango-2 {{ background: #A7A9AC; }}
  .podio-rango-3 {{ background: #B0703A; }}
  .podio-texto {{ flex: 1; text-align: left; }}
  .podio-nombre {{ font-size: 13px; font-weight: 700; line-height: 1.3; }}
  .podio-valor {{ font-size: 20px; font-weight: 800; color: var(--indigo-dark); margin-top: 2px; }}
  .podio-sub {{ font-size: 11px; color: var(--text-muted); margin-top: 2px; }}
  .tabla-scroll {{ overflow-x: auto; background: var(--surface); }}
  .tabla-pivote th, .tabla-pivote td {{ white-space: nowrap; }}
  .tabla-pivote tr.fila-total td {{ font-weight: 700; background: var(--surface-2); }}
  .tabs {{ display: flex; gap: 2px; margin: 20px 0 0; border-bottom: 2px solid var(--border); }}
  .tab-btn {{
    appearance: none; border: none; background: none; cursor: pointer; padding: 8px 16px;
    font-size: 13px; font-weight: 600; color: var(--text-secondary); border-bottom: 2px solid transparent;
    margin-bottom: -2px; font-family: inherit;
  }}
  .tab-btn.active {{ color: var(--indigo); border-bottom-color: var(--indigo); }}
  .tab-panel {{ display: none; }}
  .tab-panel.active {{ display: block; }}
  footer {{ padding: 16px 32px; color: var(--text-muted); font-size: 11px; border-top: 1px solid var(--border); }}
</style>
</head>
<body>
<header>
  <h1>COMO VAMOS · TELEVENTAS</h1>
  <div class="sub">{html.escape(mes_nombre)} · Corte al {fecha_corte.strftime('%d/%m/%Y')} · Seguros Vanti — Zurich</div>
  <div class="badge">{html.escape(estado_corte)}</div>
</header>
<main>
  <div class="tabs">
    <button class="tab-btn active" onclick="mostrarTab(event, 'resumen')">Resumen</button>
    <button class="tab-btn" onclick="mostrarTab(event, 'asesor')">Como vamos por asesor</button>
    <button class="tab-btn" onclick="mostrarTab(event, 'detalle')">Detalle por vendedor</button>
    <button class="tab-btn" onclick="mostrarTab(event, 'vanti')">Vanti</button>
  </div>

  <div id="tab-resumen" class="tab-panel active">
  <div class="kpi-row-titulos">
    <h2 class="kpi-row-titulo" style="grid-column: span 2;">Facturación canales — {html.escape(mes_nombre)}</h2>
    <h2 class="kpi-row-titulo" style="grid-column: span 3;">Podio del mes</h2>
  </div>
  <div class="kpi-row kpi-row-5">
    <div class="kpi-tile">
      <div class="kpi-label">Total facturación</div>
      <div class="kpi-value">{_fmt_money(kpis['total_facturacion'])}</div>
      <div class="kpi-sub">Corte al {fecha_corte.strftime('%d/%m/%Y')}</div>
    </div>
    <div class="kpi-tile">
      <div class="kpi-label">Total ventas</div>
      <div class="kpi-value">{kpis['total_ventas']:,}</div>
      <div class="kpi-sub">Corte al {fecha_corte.strftime('%d/%m/%Y')}</div>
    </div>
    {podio}
  </div>

  <div class="grid-2">
    <div>
      <h2>Desempeño diario</h2>
      {tabla_dias}
    </div>
    <div>
      <h2>Facturación por gasera</h2>
      {tabla_gasera}
      <h2>Facturación por producto</h2>
      {tabla_producto}
    </div>
  </div>

  {f'''
  <h2>Rueda Seguro — Auditoría de ventas (RS)</h2>
  <div class="grid-2">
    <div>{tabla_rs}</div>
    <div>{tabla_rs_asesor}</div>
  </div>
  ''' if tabla_rs else ''}

  </div>

  <div id="tab-asesor" class="tab-panel">
  <h2>Como vamos por asesor</h2>
  <div class="tabla-scroll">
  <table class="asesores">
    <thead>
      <tr>
        <th>Asesor</th><th>Categoría</th><th>Meta</th><th>Acumulado</th><th>% Cumpl.</th>
        <th>% Cumpl. ideal</th><th>Venta necesaria/día</th><th>Forecast</th><th>% Forecast</th>
        <th>Escala</th><th>Base a pagar (proy.)</th>
      </tr>
    </thead>
    <tbody>
      {filas_asesores}
    </tbody>
  </table>
  </div>
  </div>

  <div id="tab-detalle" class="tab-panel">
    <h2>Resumen del equipo</h2>
    <div class="stat-row">
      {_stat_tile("Meta del mes", f"{meta_total:,.0f}")}
      {_stat_tile("Acumulado a la fecha (todos los estados)", f"{acumulado_total:,.0f}", f"{_fmt_pct(pct_cumpl_total)} de la meta")}
      {_stat_tile("Forecast de cierre", f"{forecast_total:,.0f}", f"{_fmt_pct(pct_forecast_total)} de la meta")}
      {_stat_tile("Días laborados", f"{cal.dias_laborados} / {cal.dias_colectivo}", f"{cal.dias_por_laborar} días por laborar")}
    </div>

    <h2>Ventas por estado</h2>
    {tabla_estados}

    <h2>Detalle por vendedor — pólizas por estado</h2>
    {tabla_detalle_asesor}
  </div>

  <div id="tab-vanti" class="tab-panel">
  <h2>Ventas Televentas — {html.escape(mes_nombre)}</h2>
  <div class="kpi-row kpi-row-4">
    <div class="kpi-tile">
      <div class="kpi-label">Total ventas</div>
      <div class="kpi-value">{kpis['total_ventas']:,}</div>
      <div class="kpi-sub">Corte al {fecha_corte.strftime('%d/%m/%Y')}</div>
    </div>
    {podio}
  </div>

  <div class="grid-2">
    <div>
      <h2>Desempeño diario</h2>
      {tabla_dias_vanti}
    </div>
    <div>
      <h2>Ventas por gasera</h2>
      {tabla_gasera_vanti}
      <h2>Ventas por producto</h2>
      {tabla_producto_vanti}
    </div>
  </div>

  {f'''
  <h2>Rueda Seguro — Auditoría de ventas (RS)</h2>
  <div class="grid-2">
    <div>{tabla_rs}</div>
    <div>{tabla_rs_asesor}</div>
  </div>
  ''' if tabla_rs else ''}

  </div>
</main>
<footer>
  Generado automáticamente por 31_AutoCV_Televentas — fuente: ilio.v_cuota_protegida (DataCenter_Vanti), estrategia Televentas.
  El acumulado de "Como vamos por asesor" incluye todos los estados (AUDITADA WEB, ALTA TRANSACCIONAL, DIGITADA WEB, CANCELADA).
</footer>
<script>
function mostrarTab(ev, id) {{
  document.querySelectorAll('.tab-panel').forEach(function(el) {{ el.classList.remove('active'); }});
  document.querySelectorAll('.tab-btn').forEach(function(el) {{ el.classList.remove('active'); }});
  document.getElementById('tab-' + id).classList.add('active');
  ev.currentTarget.classList.add('active');
}}
</script>
</body>
</html>
"""
