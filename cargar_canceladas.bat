@echo off
setlocal
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
    echo No se encontro .venv. Usando python del PATH.
    set PY=python
) else (
    set PY=.venv\Scripts\python.exe
)
%PY% src\cargar_canceladas.py %*
echo.
pause