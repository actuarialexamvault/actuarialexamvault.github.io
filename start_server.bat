@echo off
REM Batch script to start the Actuarial Exam Book web server

echo ====================================================================
echo ACTUARIAL EXAM BOOK - Starting Local Web Server
echo ====================================================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Python is not installed or not in PATH
    echo.
    echo Please install Python from: https://www.python.org/downloads/
    echo Make sure to check "Add Python to PATH" during installation
    echo.
    pause
    exit /b 1
)

echo Python found! Starting server...
echo.

REM Start the Python server
python start_server.py

pause
