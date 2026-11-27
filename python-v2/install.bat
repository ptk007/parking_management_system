@echo off
setlocal EnableExtensions
cd /d "%~dp0"
if not defined PARKING_MODEL_VENV set "PARKING_MODEL_VENV=C:\py_venv\.venv"
set "MODEL_PYTHON=%PARKING_MODEL_VENV%\Scripts\python.exe"
echo.
echo Setting up Detection environment at "%PARKING_MODEL_VENV%" (one-time setup)...
echo.

if not exist "%MODEL_PYTHON%" (
  py -m venv "%PARKING_MODEL_VENV%"
  if errorlevel 1 (
    echo [FAIL] Could not create venv at "%PARKING_MODEL_VENV%".
    exit /b 1
  )
)

echo Upgrading pip...
"%MODEL_PYTHON%" -m pip install --upgrade pip
if errorlevel 1 exit /b 1

where nvidia-smi >nul 2>&1
if errorlevel 1 (
  echo [FAIL] NVIDIA driver / nvidia-smi was not found.
  echo This realtime parking build is GPU-first and will not silently install CPU PyTorch.
  exit /b 1
)

if not defined PARKING_TORCH_INDEX_URL set "PARKING_TORCH_INDEX_URL=https://download.pytorch.org/whl/cu126"
echo Installing CUDA-enabled PyTorch from:
echo   %PARKING_TORCH_INDEX_URL%
"%MODEL_PYTHON%" -m pip install --upgrade torch torchvision --index-url "%PARKING_TORCH_INDEX_URL%"
if errorlevel 1 exit /b 1

echo.
echo Installing application dependencies...
"%MODEL_PYTHON%" -m pip install -r requirements.txt
if errorlevel 1 exit /b 1

echo.
echo Removing conflicting OpenCV packages...
"%MODEL_PYTHON%" -m pip uninstall -y opencv-python-headless >nul 2>&1
"%MODEL_PYTHON%" -m pip install --force-reinstall --no-deps "opencv-python>=4.10,<5"
if errorlevel 1 exit /b 1

echo.
echo Verifying CUDA availability...
"%MODEL_PYTHON%" check_gpu.py
if errorlevel 1 (
  echo.
  echo [FAIL] CUDA verification failed. Do not run the CCTV workers on CPU.
  echo If your NVIDIA driver does not support the default wheel, set for example:
  echo   set PARKING_TORCH_INDEX_URL=https://download.pytorch.org/whl/cu130
  echo then run install.bat again.
  exit /b 1
)

echo.
echo Setup complete. Start with: run.bat
exit /b 0

:probe
set "CANDIDATE_EXE=%~1"
set "CANDIDATE_ARGS=%~2"
if "%CANDIDATE_EXE%"=="" exit /b 1
"%CANDIDATE_EXE%" %CANDIDATE_ARGS% -c "import sys; raise SystemExit(0 if sys.version_info >= (3,10) else 1)" >nul 2>&1
if errorlevel 1 exit /b 1
set "PYTHON_EXE=%CANDIDATE_EXE%"
set "PYTHON_ARGS=%CANDIDATE_ARGS%"
exit /b 0
