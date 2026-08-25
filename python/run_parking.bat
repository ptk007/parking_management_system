@echo off
setlocal EnableExtensions
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
  echo Virtual environment not found. Creating it now...
  call install.bat
  if errorlevel 1 exit /b 1
)

".venv\Scripts\python.exe" -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 8) else 1)" >nul 2>&1
if errorlevel 1 (
  echo Existing .venv is broken or uses an unsupported Python version.
  echo Run install.bat again to recreate it.
  exit /b 1
)

set PYTHONDONTWRITEBYTECODE=1
".venv\Scripts\python.exe" parkng_model.py %*
