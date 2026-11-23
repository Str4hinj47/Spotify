@echo off
setlocal
cd /d "%~dp0overtake"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Please install Node.js 18+ from https://nodejs.org/
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
)

echo.
echo Starting Overtake local server at http://localhost:3000
echo Press [O] in-game or in the garage to open/close the car doors!
echo.

start "" http://localhost:3000
call npm run dev
pause
