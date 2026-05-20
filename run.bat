@echo off
setlocal

cd /d "%~dp0"

if not exist "node_modules" (
  echo Node.js dependencies are not installed.
  echo Run:
  echo   npm install
  exit /b 1
)

if not exist "python\.venv" (
  echo Python virtual environment is not created.
  echo Run:
  echo   cd python
  echo   python -m venv .venv
  echo   .venv\Scripts\activate
  echo   pip install -r requirements.txt
  exit /b 1
)

npm run dev
