@echo off
setlocal
cd /d "%~dp0"
echo ============================================
echo   Cargar Canceladas - Actualizacion de auditoria
echo ============================================
echo.

REM --- Buscar Python (py launcher o python) ---
set PY=
where py >nul 2>&1
if not errorlevel 1 set PY=py
if "%PY%"=="" (
    where python >nul 2>&1
    if not errorlevel 1 (
        python --version >nul 2>&1
        if not errorlevel 1 set PY=python
    )
)

if "%PY%"=="" (
    echo [ERROR] Python no esta instalado o no esta en el PATH.
    echo.
    echo Instalalo desde https://www.python.org/downloads/
    echo IMPORTANTE: marca la casilla "Add python.exe to PATH" durante la instalacion.
    echo.
    echo Si ya esta instalado, desactiva el alias de la Microsoft Store:
    echo   Configuracion ^> Aplicaciones ^> Configuracion avanzada de aplicaciones ^> Alias de ejecucion de aplicaciones
    echo   Desactiva "python.exe" y "python3.exe".
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('%PY% --version') do echo Python detectado: %%i
echo.

if not exist ".venv\Scripts\python.exe" (
    echo [1/3] Creando entorno virtual...
    %PY% -m venv .venv
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