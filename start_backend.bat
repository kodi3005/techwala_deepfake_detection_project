@echo off
title DeepGuard – Backend
echo.
echo  ██████╗ ███████╗███████╗██████╗  ██████╗ ██╗   ██╗ █████╗ ██████╗ ██████╗
echo  ██╔══██╗██╔════╝██╔════╝██╔══██╗██╔════╝ ██║   ██║██╔══██╗██╔══██╗██╔══██╗
echo  ██║  ██║█████╗  █████╗  ██████╔╝██║  ███╗██║   ██║███████║██████╔╝██║  ██║
echo  ██║  ██║██╔══╝  ██╔══╝  ██╔═══╝ ██║   ██║██║   ██║██╔══██║██╔══██╗██║  ██║
echo  ██████╔╝███████╗███████╗██║     ╚██████╔╝╚██████╔╝██║  ██║██║  ██║██████╔╝
echo  ╚═════╝ ╚══════╝╚══════╝╚═╝      ╚═════╝  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝
echo.
echo  [DeepGuard] Starting FastAPI backend on http://localhost:8000
echo.

cd /d "%~dp0backend"

:: Create virtual environment if missing
if not exist venv\ (
    echo  [Setup] Creating Python virtual environment...
    python -m venv venv
)

:: Activate venv
call venv\Scripts\activate.bat

:: Install dependencies
echo  [Setup] Installing Python dependencies...
pip install -r requirements.txt --quiet

:: Run server
echo  [Server] Launching uvicorn...
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
