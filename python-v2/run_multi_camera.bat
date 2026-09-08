@echo off
setlocal EnableExtensions
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
  echo Virtual environment not found. Installing...
  call install.bat
  if errorlevel 1 exit /b 1
)

".venv\Scripts\python.exe" check_gpu.py
if errorlevel 1 (
  echo.
  echo [FAIL] CUDA is required for realtime CCTV. Workers were not started.
  exit /b 1
)

set "PARKING_DEVICE=cuda:0"
set "PARKING_ALLOW_CPU=0"
set "PYTHONDONTWRITEBYTECODE=1"

if "%~1"=="" (
  ".venv\Scripts\python.exe" multi_camera.py --active
) else (
  ".venv\Scripts\python.exe" multi_camera.py %*
)
exit /b %errorlevel%
