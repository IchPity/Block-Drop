@echo off
rem ── Block Games per Doppelklick starten ─────────────────────────────
rem Startet Electron direkt aus node_modules — npm wird nur gebraucht,
rem falls die Abhaengigkeiten noch fehlen (erster Start auf neuem PC).
cd /d "%~dp0"

rem Portables Node liegt auf D:\ (siehe DOKUMENTATION.md)
set "PATH=D:\;%PATH%"

if not exist "node_modules\electron\dist\electron.exe" (
    echo Abhaengigkeiten fehlen, installiere einmalig... bitte warten.
    call npm install
    if errorlevel 1 (
        echo.
        echo FEHLER: npm install fehlgeschlagen. Ist Node unter D:\ vorhanden?
        pause
        exit /b 1
    )
)

start "" "node_modules\electron\dist\electron.exe" .
