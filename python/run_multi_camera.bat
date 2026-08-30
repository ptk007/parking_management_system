@echo off
setlocal EnableExtensions
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
  echo Virtual environment not found. Creating it now...
  call install.bat
  if errorlevel 1 exit /b 1
)

".venv\Scripts\python.exe" -c "import cv2, easyocr, numpy, torch, ultralytics" >nul 2>&1
if errorlevel 1 (
  echo Required parking-model packages are missing. Installing them now...
  call install.bat
  if errorlevel 1 exit /b 1
)

".venv\Scripts\python.exe" -c "import cv2, easyocr, numpy, torch, ultralytics" >nul 2>&1
if errorlevel 1 (
  echo Parking-model dependencies are still unavailable in .venv.
  echo Check the installation errors above, then run install.bat manually.
  exit /b 1
)

".venv\Scripts\python.exe" -c "import torch; raise SystemExit(0 if torch.cuda.is_available() else 1)" >nul 2>&1
if errorlevel 1 (
  echo CUDA is unavailable in this venv. Multi-camera mode will use CPU fallback.
  echo For better performance, install CUDA-enabled PyTorch in .venv.
  set "PARKING_ALLOW_CPU=1"
)

set PYTHONDONTWRITEBYTECODE=1
".venv\Scripts\python.exe" multi_camera.py %*
