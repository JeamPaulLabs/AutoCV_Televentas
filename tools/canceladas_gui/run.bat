@echo off
setlocal
cd /d "%~dp0"
echo ============================================
echo   Cargar Canceladas - Actualizacion de auditoria
echo ============================================
echo.
where python >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python no esta instalado.
    echo Descargalo de https://www.python.org/downloads/ y vuelve a intentar.
    echo Recuerda marcar "Add python.exe to PATH".
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('python --version') do echo Python detectado: %%i
echo.
if not exist ".venv\Scripts\python.exe" (
    echo [1/3] Creando entorno virtual...
    python -m venv .venv
    if errorlevel 1 (
        echo [ERROR] No se pudo crear el entorno virtual.
        pause
        exit /b 1
    )
    echo Entorno virtual creado.
) else (
    echo [1/3] Entorno virtual ya existe.
)
echo.
echo [2/3] Instalando dependencias (puede tardar la primera vez)...
.venv\Scripts\python.exe -m pip install --upgrade pip
.venv\Scripts\python.exe -m pip install -r requirements.txt
if errorlevel 1 (
    echo [ERROR] Fallo la instalacion de dependencias.
    pause
    exit /b 1
)
echo Dependencias listas.
echo.
echo [3/3] Abriendo la aplicacion...
.venv\Scripts\python.exe app.py
echo.
echo Aplicacion cerrada.
pause