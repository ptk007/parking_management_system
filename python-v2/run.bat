@echo off
setlocal EnableExtensions
cd /d "%~dp0"

set "VENV_PATH=C:\py_venv\.venv"

if not exist "%VENV_PATH%\Scripts\python.exe" (
  echo Virtual environment not found at %VENV_PATH%.
  echo Run install.bat to set up C:\py_venv first.
  pause
  exit /b 1
)

"%VENV_PATH%\Scripts\python.exe" -c "import cv2, easyocr, numpy, torch, ultralytics" >nul 2>&1
if errorlevel 1 (
  echo Dependencies missing. Run C:\py_venv setup first.
  pause
  exit /b 1
)

"%VENV_PATH%\Scripts\python.exe" check_gpu.py
if errorlevel 1 (
  echo.
  echo [FAIL] Parking CCTV was NOT started because CUDA is unavailable.
  echo Verify NVIDIA driver and PyTorch setup at C:\py_venv.
  pause
  exit /b 1
)

set "PARKING_DEVICE=cuda:0"
set "PARKING_ALLOW_CPU=0"
set "PYTHONDONTWRITEBYTECODE=1"

"%VENV_PATH%\Scripts\python.exe" launcher.py
exit /b %errorlevel%
