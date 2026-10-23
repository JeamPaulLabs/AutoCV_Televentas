# Cargar Canceladas — Interfaz gráfica

Herramienta para actualizar la información de auditoría (canceladas) en la base
de datos, desde cualquier PC, con un solo botón.

## Descargar ejecutable (.exe) — sin instalar Python

Si no quieres instalar Python, descarga el ejecutable standalone:

1. Ve a: https://github.com/JeamPaulLabs/AutoCV_Televentas/releases
2. Descarga `CargarCanceladas.exe` de la última versión.
3. Ejecútalo directamente (no requiere instalación).

> El .exe se genera automáticamente en GitHub Actions cuando se publica un tag
> `gui-v*`. Si no hay release aún, usa la opción de Python de abajo.

- Windows (probado en Windows 10/11)
- Python 3.10+ (https://www.python.org/downloads/) — marcar "Add python.exe to PATH"
- Acceso a la base de datos `DataCenter_Vanti` (host, puerto, usuario, contraseña)
- El archivo `REPORTE CANCELADAS 2026 CMK VANTI.xlsx` (local o URL)

## Conexión a la base de datos

- **En la oficina:** la app detecta automáticamente `20.7.15.40:5432`. Puedes dejar los campos de host/puerto vacíos y usar "Auto-detectar perfil".
- **En casa:** abre primero el túnel SSH:
  ```
  .\scripts\conectar_tunel.ps1
  ```
  (pide la contraseña SSH de la VM y expone `127.0.0.1:15432`). Luego en la app usa "Auto-detectar perfil" o pon host `127.0.0.1` / puerto `15432`.

Si la conexión falla, la app reintenta automáticamente con el otro perfil (oficina ↔ túnel).

## Uso

1. Descarga esta carpeta (`tools/canceladas_gui`) de GitHub.
2. Doble clic en **`run.bat`**. La primera vez crea un entorno virtual e instala
   las dependencias (openpyxl, pandas, psycopg2, python-dotenv).
3. En la ventana:
   - **Dependencias**: verifica que todo esté verde. Si falta algo, clic en
     "Instalar dependencias faltantes".
   - **Configuración**: pega la ruta o URL del Excel, el mes (YYYY-MM, vacío =
     mes en curso), y los datos de conexión a la BD. Clic en "Guardar configuración"
     (se guarda en `settings.json`, no se sube a git).
   - **Ejecutar**: "Actualizar auditoría (cargar canceladas)".
4. El log muestra filas leídas, válidas y escritas.

## Notas

- El archivo se copia a una ruta temporal antes de leer, así que puede estar
  abierto en Excel (bloqueado) sin problema.
- La carga es **upsert**: correr varias veces no duplica filas.
- Si la tabla no existe, se crea automáticamente.
- No se cargan datos personales del asegurado (documento, nombre, teléfono).
- La tipificación no se carga (decisión de negocio).