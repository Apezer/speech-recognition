@echo off
cd /d "%~dp0"
call npm.cmd run build
if errorlevel 1 goto failed
call npm.cmd start
if errorlevel 1 goto failed
exit /b 0
:failed
echo Startup failed. See README.md for setup instructions.
pause
exit /b 1
