@echo off
setlocal EnableExtensions
cd /d "%~dp0"

set "PYTHON_EXE="
set "PYTHON_ARGS="

if defined CCTV_PYTHON (
  call :probe "%CCTV_PYTHON%" ""
)

if not defined PYTHON_EXE call :probe "python" ""
if not defined PYTHON_EXE call :probe "python3" ""
if not defined PYTHON_EXE call :probe "py" "-3"

if not defined PYTHON_EXE (
  echo Python 3.8 or newer was not found.
  echo Install Python, tick "Add python.exe to PATH", then run install.bat again.
  exit /b 1
)

echo Using Python:
"%PYTHON_EXE%" %PYTHON_ARGS% --version

if exist ".venv\Scripts\python.exe" (
  ".venv\Scripts\python.exe" -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 8) else 1)" >nul 2>&1
  if errorlevel 1 (
    echo Existing .venv is broken or uses a missing Python. Recreating it...
    rmdir /s /q ".venv"
    if errorlevel 1 exit /b 1
  )
)

if not exist ".venv\Scripts\python.exe" (
  "%PYTHON_EXE%" %PYTHON_ARGS% -m venv .venv
  if errorlevel 1 (
    echo Could not create the virtual environment.
    exit /b 1
  )
)

call ".venv\Scripts\activate.bat"
python -m pip install --upgrade pip
if errorlevel 1 exit /b 1

python -m pip install -r requirements.txt
if errorlevel 1 exit /b 1

echo.
echo Install complete.
echo Run old cameras: run.bat --source old --list
echo Run new cameras: run.bat --source new --list
echo Run all cameras: run.bat --source all --list
exit /b 0

:probe
set "CANDIDATE_EXE=%~1"
set "CANDIDATE_ARGS=%~2"
if "%CANDIDATE_EXE%"=="" exit /b 1
"%CANDIDATE_EXE%" %CANDIDATE_ARGS% -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 8) else 1)" >nul 2>&1
if errorlevel 1 exit /b 1
set "PYTHON_EXE=%CANDIDATE_EXE%"
set "PYTHON_ARGS=%CANDIDATE_ARGS%"
exit /b 0
