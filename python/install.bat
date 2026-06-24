@echo off
setlocal
cd /d "%~dp0"

python --version >nul 2>&1
if errorlevel 1 (
  echo Python was not found. Install Python and tick "Add python.exe to PATH".
  exit /b 1
)

python -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 8) else 1)"
if errorlevel 1 (
  echo Python 3.8 or newer is required.
  exit /b 1
)

if not exist ".venv\Scripts\python.exe" (
  python -m venv .venv
)

call .venv\Scripts\activate.bat
python -m pip install --upgrade pip
if errorlevel 1 exit /b 1

python -m pip install -r requirements.txt
if errorlevel 1 exit /b 1

echo.
echo Install complete.
echo Run old cameras: run.bat --source old --list
echo Run new cameras: run.bat --source new --list
echo Run all cameras: run.bat --source all --list
