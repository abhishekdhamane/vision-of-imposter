@echo off
REM Vision of Imposter - Multi-server startup script for Windows

echo.
echo ====================================
echo Vision of Imposter - Startup Script
echo ====================================
echo.

REM Check if uv is installed
uv --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: uv is not installed or not in PATH
    echo Install uv from: https://astral.sh/blog/uv
    echo Then add it to your PATH
    pause
    exit /b 1
)

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js 16+ and add it to your PATH
    pause
    exit /b 1
)

echo uv and Node.js detected. Starting services...
echo.

REM Install frontend dependencies if node_modules doesn't exist
if not exist "frontend\node_modules" (
    echo Installing Node.js dependencies...
    cd frontend
    npm install
    cd ..
)

echo.
echo Starting Backend (Port 8000) with uv...
start "Vision of Imposter - Backend" cmd /k "cd backend && uv run --with fastapi --with uvicorn --with websockets --with pydantic python -m app.main"

echo Starting Frontend (Port 5173)...
start "Vision of Imposter - Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo Both services are starting...
echo Frontend: http://localhost:5173
echo Backend:  http://localhost:8000
echo.
echo Close the command windows to stop the services.
pause
