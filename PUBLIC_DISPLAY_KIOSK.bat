@echo off
chcp 65001 >nul
set URL=http://localhost:3001/display?kiosk=1&theme=light
where msedge >nul 2>nul
if %errorlevel%==0 (
  start "" msedge --kiosk "%URL%" --edge-kiosk-type=fullscreen
  exit /b 0
)
where chrome >nul 2>nul
if %errorlevel%==0 (
  start "" chrome --kiosk "%URL%"
  exit /b 0
)
start "" "%URL%"
