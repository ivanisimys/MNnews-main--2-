@echo off
setlocal

set SCRIPT_DIR=%~dp0
set ROOT_DIR=%SCRIPT_DIR%..

cd /d "%SCRIPT_DIR%"

if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    if errorlevel 1 exit /b 1
)

if not exist "%ROOT_DIR%\data" (
    mkdir "%ROOT_DIR%\data"
)

echo Starting MNnews server...
node index.js
