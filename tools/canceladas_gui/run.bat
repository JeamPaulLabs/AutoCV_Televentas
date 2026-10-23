@echo off
setlocal
cd /d "%~dp0"
where python >nul 2>&1
if errorlevel 1 (
    echo Python no esta instalado. Descargalo de https://www.python.org/downloads/ y vuelve a intentar.
    pause
    exit /b 1
)
if not exist ".venv\Scripts\python.exe" (
    echo Creando entorno virtual...
    python -m venv .venv
)
.venv\Scripts\python.exe -m pip install --quiet --upgrade pip
.venv\Scripts\python.exe -m pip install --quiet -r requirements.txt
.venv\Scripts\python.exe app.py
pause