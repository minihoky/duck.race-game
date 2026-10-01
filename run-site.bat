@echo off
setlocal
cd /d "%~dp0"
title Duck Race - dev server

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install version 20.12 or newer from https://nodejs.org and run this file again.
  pause
  exit /b 1
)

if not exist "node_modules\vite\bin\vite.js" (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
)

set PORT=5173
set URL=http://127.0.0.1:%PORT%/

echo Starting the site at %URL%
echo Close this window or press Ctrl+C to stop it.
echo.

start "" /min cmd /c "timeout /t 3 /nobreak >nul && start %URL%"

node node_modules\vite\bin\vite.js --host 127.0.0.1 --port %PORT% --strictPort
if errorlevel 1 (
  echo.
  echo The server stopped. If port %PORT% is busy, close the other server and try again.
  pause
)
endlocal
