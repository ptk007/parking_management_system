@echo off
setlocal
cd /d "%~dp0"

python --version >nul 2>&1
if errorlevel 1 (
  echo Python was not found. Install Python and tick "Add python.exe to PATH".
  exit /b 1
)

python -m venv .venv
call .venv\Scripts\activate.bat
python -m pip install --upgrade pip
python -m pip install -r requirements.txt

echo.
echo Install complete.
echo Run: run.bat --list
echo Run: run.bat --camera 1
