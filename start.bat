@echo off
setlocal

:: Admin-Rechte anfordern falls noetig
net session >nul 2>&1
if %errorlevel% neq 0 (
    powershell -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

cd /d "%~dp0"

:: _app Ordner verstecken
attrib +h +s "%~dp0_app" >nul 2>&1

:: Firewall-Regel fuer Port 3000 einrichten (einmalig)
netsh advfirewall firewall show rule name="Block Drop Arcade" >nul 2>&1
if %errorlevel% neq 0 (
    netsh advfirewall firewall add rule name="Block Drop Arcade" dir=in action=allow protocol=TCP localport=3000 >nul 2>&1
)

:: Server starten
start "" powershell.exe -ExecutionPolicy Bypass -NoProfile -File "%~dp0_app\server.ps1"

:: Kurz warten, dann Browser oeffnen
timeout /t 2 /nobreak > nul
start "" "http://localhost:3000"

endlocal
