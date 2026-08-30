@echo off
setlocal EnableExtensions
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
  echo Virtual environment not found. Creating it now...
  call install.bat
  if errorlevel 1 exit /b 1
)

".venv\Scripts\python.exe" parking_profiles.py %*
