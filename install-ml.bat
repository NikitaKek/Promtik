@echo off
setlocal

cd /d "%~dp0"

set "PIP_DISABLE_PIP_VERSION_CHECK=1"
set "PIP_NO_INPUT=1"
set "PIP_FLAGS=--retries 2 --timeout 60"

echo Promptik ML setup
echo =================
echo.

if not exist "python\requirements.txt" (
  echo python\requirements.txt was not found next to the app.
  echo Reinstall Promptik or download the full release package.
  pause
  exit /b 1
)

set "PYTHON_EXE="

where py >nul 2>nul
if %errorlevel%==0 (
  if "%PYTHON_EXE%"=="" (
    py -3.14 -c "import sys" >nul 2>nul
    if not errorlevel 1 set "PYTHON_EXE=py -3.14"
  )
  if "%PYTHON_EXE%"=="" (
    py -3.13 -c "import sys" >nul 2>nul
    if not errorlevel 1 set "PYTHON_EXE=py -3.13"
  )
  if "%PYTHON_EXE%"=="" (
    py -3.12 -c "import sys" >nul 2>nul
    if not errorlevel 1 set "PYTHON_EXE=py -3.12"
  )
  if "%PYTHON_EXE%"=="" (
    py -3.11 -c "import sys" >nul 2>nul
    if not errorlevel 1 set "PYTHON_EXE=py -3.11"
  )
)

if "%PYTHON_EXE%"=="" (
  where python >nul 2>nul
  if %errorlevel%==0 set "PYTHON_EXE=python"
)

if "%PYTHON_EXE%"=="" (
  echo Python was not found.
  echo Install Python 3.11+ from https://www.python.org/downloads/
  echo Then run this file again.
  pause
  exit /b 1
)

if not exist "python\.venv\Scripts\python.exe" (
  echo Creating virtual environment...
  %PYTHON_EXE% -m venv python\.venv
  if errorlevel 1 (
    echo Could not create python\.venv.
    pause
    exit /b 1
  )
)

python\.venv\Scripts\python.exe -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 11) else 1)" >nul 2>nul
if errorlevel 1 (
  echo Python 3.11 or newer is required.
  echo Install Python 3.11+ from https://www.python.org/downloads/
  pause
  exit /b 1
)

echo Checking pip...
python\.venv\Scripts\python.exe -m pip --version >nul 2>nul
if errorlevel 1 (
  echo Bootstrapping pip...
  python\.venv\Scripts\python.exe -m ensurepip --upgrade
  if errorlevel 1 (
    echo Could not bootstrap pip.
    pause
    exit /b 1
  )
)

if exist "python\wheelhouse\" (
  echo Installing dependencies from local wheelhouse...
  python\.venv\Scripts\python.exe -m pip install %PIP_FLAGS% --no-index --find-links python\wheelhouse -r python\requirements.txt
  if not errorlevel 1 goto success
  echo Local wheelhouse install failed. Falling back to online install.
  echo.
)

echo Installing faster-whisper dependencies online...
python\.venv\Scripts\python.exe -m pip install %PIP_FLAGS% -r python\requirements.txt
if not errorlevel 1 goto success

echo.
echo Standard pip install failed.
echo Clearing pip download cache...
python\.venv\Scripts\python.exe -m pip cache purge >nul 2>nul
echo Retrying without proxy environment variables...
set "HTTP_PROXY="
set "HTTPS_PROXY="
set "ALL_PROXY="
set "http_proxy="
set "https_proxy="
set "all_proxy="
python\.venv\Scripts\python.exe -m pip install %PIP_FLAGS% --no-cache-dir -r python\requirements.txt
if not errorlevel 1 goto success

echo.
echo No-proxy install failed.
echo Retrying without proxy and with trusted PyPI hosts. Use this only on a network you trust.
python\.venv\Scripts\python.exe -m pip install %PIP_FLAGS% --no-cache-dir -r python\requirements.txt --trusted-host pypi.org --trusted-host files.pythonhosted.org --trusted-host pypi.python.org
if errorlevel 1 (
  echo Dependency installation failed.
  echo Check internet connection, proxy, antivirus HTTPS inspection, corporate certificates, or use a release with python\wheelhouse.
  echo You can also try manually:
  echo python\.venv\Scripts\python.exe -m pip cache purge
  echo set HTTP_PROXY=
  echo set HTTPS_PROXY=
  echo set ALL_PROXY=
  echo python\.venv\Scripts\python.exe -m pip install --no-cache-dir -r python\requirements.txt --trusted-host pypi.org --trusted-host files.pythonhosted.org --trusted-host pypi.python.org
  pause
  exit /b 1
)

:success

echo.
echo Done. You can start Promptik.
pause
