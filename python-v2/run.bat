@echo off
setlocal EnableExtensions
cd /d "%~dp0"

if not defined PARKING_MODEL_VENV set "PARKING_MODEL_VENV=C:\py_venv\.venv"
set "MODEL_PYTHON=%PARKING_MODEL_VENV%\Scripts\python.exe"

if not exist "%MODEL_PYTHON%" (
  echo Virtual environment not found at "%PARKING_MODEL_VENV%".
  echo Run install.bat to set up the Detection environment first.
  if not defined PARKING_LAUNCHED_BY_BACKEND pause
  exit /b 1
)

"%MODEL_PYTHON%" -c "import cv2, easyocr, lap, numpy, torch, ultralytics"
if errorlevel 1 (
  echo Detection dependencies could not be loaded. Run install.bat to repair the environment.
  if not defined PARKING_LAUNCHED_BY_BACKEND pause
  exit /b 1
)

"%MODEL_PYTHON%" check_gpu.py
if errorlevel 1 (
  echo.
  echo [FAIL] Parking CCTV was NOT started because CUDA is unavailable.
  echo Verify the NVIDIA driver and CUDA-enabled PyTorch in "%PARKING_MODEL_VENV%".
  if not defined PARKING_LAUNCHED_BY_BACKEND pause
  exit /b 1
)

set "PARKING_DEVICE=cuda:0"
set "PARKING_ALLOW_CPU=0"
set "PYTHONDONTWRITEBYTECODE=1"

"%MODEL_PYTHON%" launcher.py
if errorlevel 1 (
  echo.
  echo [FAIL] Backend CCTV startup failed. Check the backend, API key, and preset setup above.
  if not defined PARKING_LAUNCHED_BY_BACKEND pause
  exit /b 1
)
exit /b 0
