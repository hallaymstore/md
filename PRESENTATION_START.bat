@echo off
chcp 65001 >nul
title MD - Taqdimot
cd /d "%~dp0"
where node >nul 2>nul || (echo [XATO] Kerakli komponent topilmadi. Mas'ul texnik xodimga murojaat qiling. & pause & exit /b 1)
if not exist node_modules\ejs\package.json (
  echo Platforma tayyorlanmoqda...
  call npm install >nul 2>&1 || (echo [XATO] Tayyorlash yakunlanmadi. & pause & exit /b 1)
)
start "" cmd /c "timeout /t 4 /nobreak >nul & start http://localhost:3001/login"
echo Taqdimot rejimi ishga tushmoqda...
node server.js
pause
