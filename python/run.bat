@echo off
setlocal EnableExtensions
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
  echo Virtual environment not found. Creating it now...
  call install.bat
  if errorlevel 1 exit /b 1
)

".venv\Scripts\python.exe" -c "import sys" >nul 2>&1
if errorlevel 1 (
  echo Existing .venv is broken or points to a missing Python. Recreating it...
  call install.bat
  if errorlevel 1 exit /b 1
)

set PYTHONDONTWRITEBYTECODE=1
".venv\Scripts\python.exe" cctv_viewer.py %*
