"""Equivalente a la hoja TAB-DIN / FACTURACIÓN: pólizas y $ Facturación SERVI
por asesor x producto/estado, por día, por producto y por gasera."""
from __future__ import annotations

import pandas as pd


def pivote_asesor_producto(df: pd.DataFrame) -> pd.DataFrame:
    tabla = pd.pivot_table(
        df, index="asesor", columns="producto", values="id_poliza",
        aggfunc="count", fill_value=0, margins=True, margins_name="Total general",
    )
    return tabla.sort_values("Total general", ascending=False)


def pivote_asesor_estado(df: pd.DataFrame, excluidos: set[str] | None = None) -> pd.DataFrame:
    """Detalle por vendedor: cuántas pólizas tiene cada asesor en cada estado, con
    fila y columna de total general."""
    if excluidos:
        from src.metas_repo import normalizar_nombre
        df = df[~df["asesor"].map(normalizar_nombre).isin(excluidos)]
    tabla = pd.pivot_table(
        df, index="asesor", columns="nombre_estado", values="id_poliza",
        aggfunc="count", fill_value=0, margins=True, margins_name="Total general",
    )
    filas = tabla.drop(index="Total general")
    total = tabla.loc[["Total general"]]
    return pd.concat([filas.sort_values("Total general", ascending=False), total])


def _con_participacion(df: pd.DataFrame) -> pd.DataFrame:
    total = df["facturacion_servi"].sum()
    df["pct_participacion"] = df["facturacion_servi"] / total if total else 0.0
    return df


def resumen_por_dia(df: pd.DataFrame) -> pd.DataFrame:
    tabla = (
        df.groupby("fecha_venta")
        .agg(polizas=("id_poliza", "count"), facturacion_servi=("facturacion_servi", "sum"))
        .reset_index()
        .sort_values("fecha_venta")
    )
    return _con_participacion(tabla)


def resumen_por_producto(df: pd.DataFrame) -> pd.DataFrame:
    tabla = (
        df.groupby("producto")
        .agg(cantidad=("id_poliza", "count"), facturacion_servi=("facturacion_servi", "sum"))
        .reset_index()
        .sort_values("facturacion_servi", ascending=False)
    )
    return _con_participacion(tabla)


def resumen_por_gasera(df: pd.DataFrame) -> pd.DataFrame:
    tabla = (
        df.groupby("entidad_facturacion")
        .agg(cantidad=("id_poliza", "count"), facturacion_servi=("facturacion_servi", "sum"))
        .reset_index()
        .sort_values("facturacion_servi", ascending=False)
    )
    return _con_participacion(tabla)


def _conteo_por_dia(df: pd.DataFrame) -> pd.DataFrame:
    """Conteo de pólizas por fecha, SIN facturación -- válido para cualquier
    producto que viva en una vista propia de Ilio (Rueda Seguro, Billetera
    Protegida), cuya Facturación SERVI no se calcula."""
    tabla = (
        df.groupby("fecha_venta")
        .agg(cantidad=("id_poliza", "count"))
        .reset_index()
        .sort_values("fecha_venta")
    )
    total = tabla["cantidad"].sum()
    tabla["pct_participacion"] = tabla["cantidad"] / total if total else 0.0
    return tabla


def _conteo_por_asesor(df: pd.DataFrame) -> pd.DataFrame:
    """Conteo de pólizas por asesor, sin facturación (ver _conteo_por_dia)."""
    return (
        df.groupby("asesor")
        .agg(cantidad=("id_poliza", "count"))
        .reset_index()
        .sort_values("cantidad", ascending=False)
    )


def resumen_rs_por_dia(df_rs: pd.DataFrame) -> pd.DataFrame:
    """Ventas de Rueda Segura por día (Ilio v_rueda_segura) -- reemplaza al
    resumen basado en el Excel de auditoría OneDrive, que se queda corto
    (no alcanza a reflejar los últimos días del corte). También cuenta en el
    acumulado del asesor (decisión de negocio 2026-10-20)."""
    return _conteo_por_dia(df_rs)


def resumen_rs_por_asesor(df_rs: pd.DataFrame) -> pd.DataFrame:
    """Ventas de Rueda Segura por asesor (Ilio v_rueda_segura) -- también
    cuenta en el acumulado del asesor (decisión de negocio 2026-10-20)."""
    return _conteo_por_asesor(df_rs)


def resumen_bp_por_dia(df_bp: pd.DataFrame) -> pd.DataFrame:
    """Ventas de Billetera Protegida por día (Ilio v_billetera_protegida).
    A diferencia de RS, estas ventas SÍ están dentro del acumulado del asesor
    (se filtran desde el df de ventas consolidado, ver ilio_repo.es_billetera)."""
    return _conteo_por_dia(df_bp)


def resumen_bp_por_asesor(df_bp: pd.DataFrame) -> pd.DataFrame:
    """Ventas de Billetera Protegida por asesor -- ver resumen_bp_por_dia."""
    return _conteo_por_asesor(df_bp)


def _codigo_producto(producto: pd.Series) -> pd.Series:
    """Código corto del producto (CP / BP / RS / PCV), mismo criterio que
    etiquetaProducto() del frontend (MiResumenAsesor.jsx)."""
    p = producto.fillna("").astype(str).str.upper()
    codigo = pd.Series("CP", index=p.index)
    codigo[p.str.contains("COMBO")] = "PCV"
    codigo[p.str.contains("RUEDA")] = "RS"
    codigo[p.str.contains("BILLETERA")] = "BP"
    return codigo


def resumen_dia_producto_estado(df: pd.DataFrame) -> pd.DataFrame:
    """Día a día de la vista administrativa: una fila por fecha x asesor x
    producto x estado, con cantidad y Facturación SERVI. Formato largo para que
    el frontend filtre por producto/asesor y totalice sin otra llamada."""
    columnas = ["fecha_venta", "asesor", "producto", "nombre_estado", "cantidad", "facturacion_servi"]
    if df.empty:
        return pd.DataFrame({c: [] for c in columnas})
    base = df.assign(producto=_codigo_producto(df["producto"]))
    tabla = (
        base.groupby(["fecha_venta", "asesor", "producto", "nombre_estado"], dropna=False)
        .agg(cantidad=("id_poliza", "count"), facturacion_servi=("facturacion_servi", "sum"))
        .reset_index()
        .sort_values(["fecha_venta", "asesor"])
    )
    tabla["fecha_venta"] = tabla["fecha_venta"].astype(str)
    return tabla


def resumen_por_estado(df: pd.DataFrame) -> pd.DataFrame:
    tabla = (
        df.groupby("nombre_estado")
        .agg(cantidad=("id_poliza", "count"), facturacion_servi=("facturacion_servi", "sum"))
        .reset_index()
        .sort_values("cantidad", ascending=False)
    )
    return _con_participacion(tabla)


def kpis_facturacion(df: pd.DataFrame, df_por_producto: pd.DataFrame, df_por_gasera: pd.DataFrame) -> dict:
    """Total facturación, total ventas, producto líder y gasera líder (nombre + %
    participación), para las tarjetas superiores del dashboard estilo Facturación Canales."""
    producto_lider = (
        df_por_producto.iloc[0] if not df_por_producto.empty
        else pd.Series({"producto": "—", "pct_participacion": 0.0})
    )
    gasera_lider = (
        df_por_gasera.iloc[0] if not df_por_gasera.empty
        else pd.Series({"entidad_facturacion": "—", "pct_participacion": 0.0})
    )
    return {
        "total_facturacion": float(df["facturacion_servi"].sum()),
        "total_ventas": int(len(df)),
        "producto_lider_nombre": str(producto_lider["producto"]),
        "producto_lider_pct": float(producto_lider["pct_participacion"]),
        "gasera_lider_nombre": str(gasera_lider["entidad_facturacion"]),
        "gasera_lider_pct": float(gasera_lider["pct_participacion"]),
    }
