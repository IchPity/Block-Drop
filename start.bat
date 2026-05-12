@echo off
echo Block Drop wird gestartet...
start "" powershell.exe -ExecutionPolicy Bypass -NoProfile -File "%~dp0server.ps1"
timeout /t 2 /nobreak > nul
start "" "http://localhost:3000"
