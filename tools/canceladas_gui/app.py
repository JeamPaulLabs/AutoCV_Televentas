# -*- coding: utf-8 -*-
"""Interfaz gráfica para actualizar la información de auditoría (canceladas).

Uso:
    python app.py
    (o doble clic en run.bat en Windows)

Comprueba las dependencias, permite configurar la ubicación del Excel (ruta o URL)
y la conexión a la base de datos, y ejecuta la carga con un botón.
"""
from __future__ import annotations

import datetime as dt
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unicodedata
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
SETTINGS_FILE = HERE / "settings.json"
REQUIREMENTS = ["openpyxl", "pandas", "psycopg2-binary", "python-dotenv"]

DDL = """
CREATE TABLE IF NOT EXISTS como_vamos_televentas.canceladas_revision (
    periodo date NOT NULL,
    numero_contrato text NOT NULL,
    asesor text,
    producto text,
    fecha_venta date,
    causal_gestion text,
    gestion_supervisor_tmk text,
    observacion text,
    resultado_re_auditoria text,
    observacion_re_auditoria text,
    estado_subsanacion text,
    solicitud text,
    reauditoria text,
    observaciones_reauditoria text,
    fecha_gestion date,
    gestor text,
    tiempo_subs_1 text,
    tiempo_subs_2 text,
    actualizado_en timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (periodo, numero_contrato)
);
"""

MESES_ES = {
    1: "ENERO", 2: "FEBRERO", 3: "MARZO", 4: "ABRIL", 5: "MAYO", 6: "JUNIO",
    7: "JULIO", 8: "AGOSTO", 9: "SEPTIEMBRE", 10: "OCTUBRE", 11: "NOVIEMBRE",
    12: "DICIEMBRE",
}


def normalizar_nombre_hoja(s):
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"\s+", " ", s).strip().upper()


def normalizar_contrato(v):
    if v is None:
        return None
    if isinstance(v, float):
        if v != v:
            return None
        if v == int(v):
            v = int(v)
    s = str(v).strip()
    if s == "" or s.lower() in ("nan", "none", "nat"):
        return None
    s = s.replace(" ", "")
    if s.endswith(".0"):
        s = s[:-2]
    return s or None


def normalizar_texto(v):
    if v is None:
        return None
    if isinstance(v, float) and v != v:
        return None
    s = str(v).strip()
    if s == "" or s.lower() in ("nan", "none", "nat"):
        return None
    return s


def parse_fecha(v):
    import pandas as pd
    if v is None:
        return None
    try:
        if pd.isna(v):
            return None
    except (TypeError, ValueError):
        pass
    if isinstance(v, (pd.Timestamp,)):
        return None if pd.isna(v) else v.date()
    if isinstance(v, dt.datetime):
        return v.date()
    if isinstance(v, dt.date):
        return v
    if isinstance(v, (int, float)):
        try:
            return (pd.to_datetime(v, unit="D", origin="1899-12-30")).date()
        except Exception:
            return None
    s = str(v).strip()
    if s == "" or s.lower() in ("nan", "none", "nat"):
        return None
    try:
        ts = pd.to_datetime(s, dayfirst=True, errors="coerce")
        if pd.isna(ts):
            return None
        return ts.date()
    except Exception:
        return None


def norm_header(h):
    return re.sub(r"\s+", " ", unicodedata.normalize("NFKD", str(h)).encode("ascii", "ignore").decode("ascii")).strip().upper()


def encontrar_columna(df, *candidatos):
    norm_map = {norm_header(c): c for c in df.columns}
    for cand in candidatos:
        cn = norm_header(cand)
        if cn in norm_map:
            return norm_map[cn]
    return None


def detectar_hoja(wb, periodo, tipo):
    mes = MESES_ES[periodo.month]
    anio = str(periodo.year)[-2:]
    candidatos = []
    for name in wb.sheetnames:
        n = normalizar_nombre_hoja(name)
        if mes not in n or anio not in n:
            continue
        if tipo == "canceladas":
            if "TMK" in n and "SUB" not in n:
                candidatos.append(name)
        else:
            if "SUB" in n and "TMK" in n:
                candidatos.append(name)
    return candidatos[0] if candidatos else None


def leer_canceladas(archivo, periodo, hoja=None):
    import openpyxl
    import pandas as pd
    wb = openpyxl.load_workbook(archivo, read_only=True, data_only=True)
    if hoja is None:
        hoja = detectar_hoja(wb, periodo, "canceladas")
    wb.close()
    if hoja is None:
        return pd.DataFrame(), None
    df = pd.read_excel(archivo, sheet_name=hoja)
    col_contrato = encontrar_columna(df, "NUMERO CONTRATO", "NUMEROCONTRATO", "CONTRATO")
    col_asesor = encontrar_columna(df, "ASESOR")
    col_producto = encontrar_columna(df, "PRODUCTO")
    col_fecha_venta = encontrar_columna(df, "FECHA VENTA", "FECHAVENTA")
    col_causal = encontrar_columna(df, "CAUSAL DE GESTION")
    col_gestion = encontrar_columna(df, "GESTION SUPERVISOR TMK", "GESTION  SUPERVISOR TMK")
    col_obs = encontrar_columna(df, "OBSERVACION")
    col_resultado = encontrar_columna(df, "RESULTADO DE RE AUDITORIA Y SUBSANACION")
    col_obs_reaud = encontrar_columna(df, "OBSERVACION RE AUDITORIA Y SUBSANACION")

    if col_contrato is None:
        raise ValueError("No se encontró la columna 'numeroContrato' en la hoja de canceladas.")

    filas = []
    for _, r in df.iterrows():
        contrato = normalizar_contrato(r.get(col_contrato))
        if not contrato:
            continue
        filas.append({
            "periodo": periodo,
            "numero_contrato": contrato,
            "asesor": normalizar_texto(r.get(col_asesor)) if col_asesor else None,
            "producto": normalizar_texto(r.get(col_producto)) if col_producto else None,
            "fecha_venta": parse_fecha(r.get(col_fecha_venta)) if col_fecha_venta else None,
            "causal_gestion": normalizar_texto(r.get(col_causal)) if col_causal else None,
            "gestion_supervisor_tmk": normalizar_texto(r.get(col_gestion)) if col_gestion else None,
            "observacion": normalizar_texto(r.get(col_obs)) if col_obs else None,
            "resultado_re_auditoria": normalizar_texto(r.get(col_resultado)) if col_resultado else None,
            "observacion_re_auditoria": normalizar_texto(r.get(col_obs_reaud)) if col_obs_reaud else None,
        })
    out = pd.DataFrame(filas)
    if not out.empty:
        out = out.drop_duplicates("numero_contrato", keep="last")
    return out, hoja


def leer_subsanacion(archivo, periodo, hoja=None):
    import openpyxl
    import pandas as pd
    wb = openpyxl.load_workbook(archivo, read_only=True, data_only=True)
    if hoja is None:
        hoja = detectar_hoja(wb, periodo, "subsanacion")
    wb.close()
    if hoja is None:
        return pd.DataFrame(), None
    df = pd.read_excel(archivo, sheet_name=hoja)
    col_contrato = encontrar_columna(df, "NUMERO CONTRATO", "NUMEROCONTRATO", "CONTRATO")
    col_estado = encontrar_columna(df, "ESTADO DE SUBSANACION")
    col_solicitud = encontrar_columna(df, "SOLICITUD")
    col_reaud = encontrar_columna(df, "REAUDITORIA Y SUBSANACION")
    col_obs = encontrar_columna(df, "OBSERVACIONES")
    col_fecha = encontrar_columna(df, "FECHA GESTION")
    col_gestor = encontrar_columna(df, "GESTOR")
    col_t1 = encontrar_columna(df, "TIEMPO SUBS 1")
    col_t2 = encontrar_columna(df, "TIEMPO SUBS 2")

    if col_contrato is None:
        return pd.DataFrame(), hoja

    filas = []
    for _, r in df.iterrows():
        contrato = normalizar_contrato(r.get(col_contrato))
        if not contrato:
            continue
        filas.append({
            "numero_contrato": contrato,
            "estado_subsanacion": normalizar_texto(r.get(col_estado)) if col_estado else None,
            "solicitud": normalizar_texto(r.get(col_solicitud)) if col_solicitud else None,
            "reauditoria": normalizar_texto(r.get(col_reaud)) if col_reaud else None,
            "observaciones_reauditoria": normalizar_texto(r.get(col_obs)) if col_obs else None,
            "fecha_gestion": parse_fecha(r.get(col_fecha)) if col_fecha else None,
            "gestor": normalizar_texto(r.get(col_gestor)) if col_gestor else None,
            "tiempo_subs_1": normalizar_texto(r.get(col_t1)) if col_t1 else None,
            "tiempo_subs_2": normalizar_texto(r.get(col_t2)) if col_t2 else None,
        })
    out = pd.DataFrame(filas)
    if not out.empty:
        out = out.drop_duplicates("numero_contrato", keep="last")
    return out, hoja


def obtener_archivo(ruta_o_url):
    s = (ruta_o_url or "").strip()
    if s.startswith("http://") or s.startswith("https://"):
        tmp = Path(tempfile.gettempdir()) / "canceladas_gui_archivo.xlsx"
        urllib.request.urlretrieve(s, tmp)
        return tmp
    p = Path(s)
    if not p.exists():
        raise FileNotFoundError(f"No existe el archivo: {p}")
    # copiar para evitar bloqueo de Excel
    tmp = Path(tempfile.gettempdir()) / "canceladas_gui_archivo.xlsx"
    shutil.copy2(p, tmp)
    return tmp


def _alcanzable(host, port, timeout=4):
    import socket
    try:
        with socket.create_connection((host, int(port)), timeout=timeout):
            return True
    except (OSError, TypeError, ValueError):
        return False


def _resolver_perfil():
    """Devuelve ('oficina', host, port) o ('casa', host, port) o (None, None, None)."""
    if _alcanzable("20.7.15.40", 5432):
        return "oficina", "20.7.15.40", 5432
    if _alcanzable("127.0.0.1", 15432):
        return "casa", "127.0.0.1", 15432
    return None, None, None


def conectar_db(cfg):
    import psycopg2
    host = cfg["host"]
    port = cfg["port"]
    # Auto-detectar perfil si no se especificó host
    if not host:
        perfil, h, p = _resolver_perfil()
        if h is None:
            raise RuntimeError("No se alcanza ni la oficina (20.7.15.40:5432) ni el túnel (127.0.0.1:15432). "
                               "Si estás en casa, abre el túnel SSH (conectar_tunel.ps1) primero.")
        host, port = h, p
    try:
        return psycopg2.connect(
            host=host, port=int(port), dbname=cfg["database"],
            user=cfg["user"], password=cfg["password"], connect_timeout=8,
        )
    except Exception as e:
        # Reintentar con el otro perfil si el directo falla
        if host == "20.7.15.40":
            if _alcanzable("127.0.0.1", 15432):
                return psycopg2.connect(
                    host="127.0.0.1", port=15432, dbname=cfg["database"],
                    user=cfg["user"], password=cfg["password"], connect_timeout=8,
                )
        raise RuntimeError(f"Error de conexión a {host}:{port}: {e}")


def asegurar_tabla(conn):
    with conn.cursor() as cur:
        cur.execute(DDL)
    conn.commit()


def upsert(conn, df):
    if df.empty:
        return 0
    cols = ["periodo", "numero_contrato", "asesor", "producto", "fecha_venta",
            "causal_gestion", "gestion_supervisor_tmk", "observacion",
            "resultado_re_auditoria", "observacion_re_auditoria", "estado_subsanacion",
            "solicitud", "reauditoria", "observaciones_reauditoria", "fecha_gestion",
            "gestor", "tiempo_subs_1", "tiempo_subs_2"]
    placeholders = ", ".join(["%s"] * len(cols))
    colnames = ", ".join(cols)
    update_cols = [c for c in cols if c not in ("periodo", "numero_contrato")]
    update_set = ", ".join(f"{c} = EXCLUDED.{c}" for c in update_cols) + ", actualizado_en = now()"
    query = (f"INSERT INTO como_vamos_televentas.canceladas_revision ({colnames}) "
             f"VALUES ({placeholders}) "
             f"ON CONFLICT (periodo, numero_contrato) DO UPDATE SET {update_set}")
    n = 0
    with conn.cursor() as cur:
        for _, r in df.iterrows():
            vals = []
            for c in cols:
                v = r.get(c)
                if isinstance(v, float) and v != v:
                    v = None
                if isinstance(v, (pd_timestamp() if False else None,)):
                    pass
                import pandas as pd
                if isinstance(v, (pd.Timestamp,)):
                    v = None if pd.isna(v) else v.date()
                if c in ("fecha_venta", "fecha_gestion") and not isinstance(v, (dt.date, type(None))):
                    v = None
                vals.append(v)
            cur.execute(query, vals)
            n += 1
        conn.commit()
    return n


# ---------- GUI ----------
try:
    import tkinter as tk
    from tkinter import ttk, filedialog, messagebox
except Exception as e:
    print("tkinter no disponible:", e)
    sys.exit(1)


def cargar_settings():
    if SETTINGS_FILE.exists():
        try:
            return json.loads(SETTINGS_FILE.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}


def guardar_settings(cfg):
    SETTINGS_FILE.write_text(json.dumps(cfg, indent=2, ensure_ascii=False), encoding="utf-8")


def check_deps():
    estado = {}
    # python
    estado["python"] = sys.version.split()[0]
    for lib in ["openpyxl", "pandas", "psycopg2", "dotenv"]:
        try:
            m = __import__(lib)
            estado[lib] = getattr(m, "__version__", "ok")
        except Exception:
            estado[lib] = None
    return estado


class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Actualizar auditoría — Canceladas (Xuma)")
        self.geometry("720x640")
        self.resizable(True, True)
        self.cfg = cargar_settings()
        self._build()
        self._refresh_deps()

    def _build(self):
        pad = {"padx": 8, "pady": 4}
        # --- Dependencias ---
        lf = ttk.LabelFrame(self, text="1. Dependencias")
        lf.pack(fill="x", **pad)
        self.dep_labels = {}
        for lib in ["python", "openpyxl", "pandas", "psycopg2", "dotenv"]:
            row = ttk.Frame(lf)
            row.pack(fill="x")
            ttk.Label(row, text=lib, width=14).pack(side="left")
            lbl = ttk.Label(row, text="...", width=20)
            lbl.pack(side="left")
            self.dep_labels[lib] = lbl
        ttk.Button(lf, text="Instalar dependencias faltantes", command=self.instalar_deps).pack(anchor="w", pady=4)

        # --- Configuración ---
        cf = ttk.LabelFrame(self, text="2. Configuración")
        cf.pack(fill="x", **pad)
        self._entry(cf, "Archivo Excel (ruta o URL):", "archivo", width=60)
        ttk.Button(cf, text="Examinar...", command=self.examinar).pack(anchor="w", pady=2)
        self._entry(cf, "Mes (YYYY-MM):", "periodo", width=12)
        ttk.Label(cf, text="Dejar vacío = mes en curso").pack(anchor="w")
        for lbl, key, show in [("Host BD:", "host", None), ("Puerto:", "port", None),
                               ("Base de datos:", "database", None), ("Usuario:", "user", None),
                               ("Contraseña:", "password", "*")]:
            self._entry(cf, lbl, key, width=30, show=show)
        ttk.Button(cf, text="Auto-detectar perfil (oficina/casa)", command=self.auto_detectar).pack(anchor="w", pady=2)
        ttk.Button(cf, text="Probar conexión", command=self.probar_conexion).pack(anchor="w", pady=2)
        ttk.Button(cf, text="Guardar configuración", command=self.guardar).pack(anchor="w", pady=2)

        # --- Acción ---
        af = ttk.LabelFrame(self, text="3. Ejecutar")
        af.pack(fill="x", **pad)
        ttk.Button(af, text="Actualizar auditoría (cargar canceladas)", command=self.ejecutar).pack(anchor="w", pady=4)

        # --- Log ---
        lf2 = ttk.LabelFrame(self, text="Log")
        lf2.pack(fill="both", expand=True, **pad)
        self.log = tk.Text(lf2, height=14, wrap="word")
        self.log.pack(fill="both", expand=True)
        sb = ttk.Scrollbar(self.log, command=self.log.yview)
        sb.pack(side="right", fill="y")
        self.log.config(yscrollcommand=sb.set)

    def _entry(self, parent, label, key, width=40, show=None):
        f = ttk.Frame(parent)
        f.pack(fill="x", pady=1)
        ttk.Label(f, text=label, width=26).pack(side="left")
        e = ttk.Entry(f, width=width, show=show or "")
        e.pack(side="left", fill="x", expand=True)
        val = self.cfg.get(key, "")
        if key == "periodo" and not val:
            val = dt.date.today().strftime("%Y-%m")
        if key == "port" and not val:
            val = "5432"
        e.insert(0, str(val))
        setattr(self, f"e_{key}", e)

    def _get(self, key):
        return getattr(self, f"e_{key}").get().strip()

    def _log(self, msg):
        self.log.insert("end", msg + "\n")
        self.log.see("end")
        self.update_idletasks()

    def _refresh_deps(self):
        st = check_deps()
        self.dep_labels["python"].config(text=st["python"])
        for lib in ["openpyxl", "pandas", "psycopg2", "dotenv"]:
            v = st[lib]
            self.dep_labels[lib].config(text=(v if v else "FALTA"))
        self._log("Dependencias: " + ", ".join(f"{k}={v}" for k, v in st.items()))

    def instalar_deps(self):
        self._log("Instalando dependencias...")
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", str(HERE / "requirements.txt")])
            self._log("Dependencias instaladas.")
        except Exception as e:
            self._log("Error instalando: " + str(e))
            messagebox.showerror("Error", str(e))
        self._refresh_deps()

    def examinar(self):
        p = filedialog.askopenfilename(
            title="Seleccionar Excel de canceladas",
            filetypes=[("Excel", "*.xlsx *.xls"), ("Todos", "*.*")],
        )
        if p:
            self.e_archivo.delete(0, "end")
            self.e_archivo.insert(0, p)

    def guardar(self):
        cfg = {
            "archivo": self._get("archivo"),
            "periodo": self._get("periodo"),
            "host": self._get("host"),
            "port": self._get("port"),
            "database": self._get("database"),
            "user": self._get("user"),
            "password": self._get("password"),
        }
        guardar_settings(cfg)
        self.cfg = cfg
        self._log("Configuración guardada.")

    def auto_detectar(self):
        perfil, host, port = _resolver_perfil()
        if host is None:
            messagebox.showwarning("Perfil", "No se alcanza ni la oficina (20.7.15.40:5432) ni el túnel (127.0.0.1:15432).\n"
                                            "Si estás en casa, abre el túnel SSH (conectar_tunel.ps1) primero.")
            self._log("Auto-detectar: sin conexión disponible.")
            return
        self.e_host.delete(0, "end"); self.e_host.insert(0, host)
        self.e_port.delete(0, "end"); self.e_port.insert(0, str(port))
        self._log(f"Auto-detectar: perfil {perfil} -> {host}:{port}")
        messagebox.showinfo("Perfil", f"Perfil detectado: {perfil} ({host}:{port})")

    def probar_conexion(self):
        cfg = self._cfg_actual()
        try:
            conn = conectar_db(cfg)
            conn.close()
            self._log("Conexión OK.")
            messagebox.showinfo("Conexión", "Conexión exitosa.")
        except Exception as e:
            self._log("Error de conexión: " + str(e))
            messagebox.showerror("Conexión", str(e))

    def _cfg_actual(self):
        return {
            "archivo": self._get("archivo"),
            "periodo": self._get("periodo"),
            "host": self._get("host"),
            "port": self._get("port"),
            "database": self._get("database"),
            "user": self._get("user"),
            "password": self._get("password"),
        }

    def ejecutar(self):
        cfg = self._cfg_actual()
        self.guardar()
        self._log("=== Iniciando carga ===")
        try:
            periodo_txt = cfg["periodo"] or dt.date.today().strftime("%Y-%m")
            periodo = dt.datetime.strptime(periodo_txt, "%Y-%m").date().replace(day=1)
            archivo = obtener_archivo(cfg["archivo"])
            self._log(f"Periodo: {periodo:%Y-%m}")
            self._log(f"Archivo: {cfg['archivo']}")
            self._log(f"Copia temporal: {archivo}")

            conn = conectar_db(cfg)
            asegurar_tabla(conn)

            df_canc, hoja_c = leer_canceladas(archivo, periodo)
            self._log(f"Hoja canceladas: {hoja_c} -> {len(df_canc)} válidas")
            df_sub, hoja_s = leer_subsanacion(archivo, periodo)
            self._log(f"Hoja subsanación: {hoja_s} -> {len(df_sub)} válidas")

            if df_canc.empty:
                self._log("Sin canceladas para cargar. Fin.")
                conn.close()
                return

            if not df_sub.empty:
                df = df_canc.merge(df_sub, on="numero_contrato", how="left", suffixes=("", "_sub"))
                for col in ("estado_subsanacion", "solicitud", "reauditoria",
                            "observaciones_reauditoria", "fecha_gestion", "gestor",
                            "tiempo_subs_1", "tiempo_subs_2"):
                    alt = col + "_sub"
                    if alt in df.columns:
                        df[col] = df[alt].combine_first(df.get(col))
                        df = df.drop(columns=[alt])
            else:
                df = df_canc.copy()
                for col in ("estado_subsanacion", "solicitud", "reauditoria",
                            "observaciones_reauditoria", "fecha_gestion", "gestor",
                            "tiempo_subs_1", "tiempo_subs_2"):
                    df[col] = None

            df["periodo"] = periodo
            cols = ["periodo", "numero_contrato", "asesor", "producto", "fecha_venta",
                    "causal_gestion", "gestion_supervisor_tmk", "observacion",
                    "resultado_re_auditoria", "observacion_re_auditoria", "estado_subsanacion",
                    "solicitud", "reauditoria", "observaciones_reauditoria", "fecha_gestion",
                    "gestor", "tiempo_subs_1", "tiempo_subs_2"]
            for c in cols:
                if c not in df.columns:
                    df[c] = None
            df = df[cols]

            self._log(f"Filas a escribir: {len(df)}")
            n = upsert(conn, df)
            conn.close()
            self._log(f"Filas escritas/actualizadas: {n}")
            self._log("OK")
            messagebox.showinfo("Listo", f"Carga completada: {n} filas.")
        except Exception as e:
            self._log("ERROR: " + str(e))
            messagebox.showerror("Error", str(e))


if __name__ == "__main__":
    app = App()
    app.mainloop()
