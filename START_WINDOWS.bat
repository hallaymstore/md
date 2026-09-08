@echo off
chcp 65001 >nul
title MD QDTU - APPROVAL WORKFLOW v2.5
cd /d "%~dp0"
echo ================================================
echo MD QDTU - APPROVAL WORKFLOW v2.5.0
echo ================================================
echo.
if not exist .env (
  copy /Y .env.example .env >nul
  echo [OK] .env yaratildi.
)
if not exist node_modules (
  echo [1/2] Paketlar o'rnatilmoqda...
  call npm install
  if errorlevel 1 goto :fail
)
echo [2/2] Server ishga tushmoqda: http://localhost:3001
echo UI build: 2.5.0-APPROVAL-WORKFLOW
call npm run dev
goto :end
:fail
echo.
echo [XATO] npm install bajarilmadi. Internet va Node.js ni tekshiring.
pause
:end
