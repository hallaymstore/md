@echo off
chcp 65001 >nul
title MD
cd /d "%~dp0"
echo =====================================================
echo        MD
echo        Magistratura boshqaruv tizimi
echo =====================================================
where node >nul 2>nul || (
  echo [XATO] Platformani ishga tushirish uchun kerakli komponent topilmadi.
  echo Mas'ul texnik xodimga murojaat qiling.
  pause
  exit /b 1
)
if not exist .env (
  echo [XATO] Platformaning ulanish sozlamalari topilmadi.
  echo Mas'ul texnik xodimga murojaat qiling.
  pause
  exit /b 1
)
if not exist node_modules\ejs\package.json (
  echo Platforma birinchi ishga tushirish uchun tayyorlanmoqda...
  call npm install >nul 2>&1 || (
    echo [XATO] Platformani tayyorlash yakunlanmadi. Internet aloqasini tekshiring yoki mas'ul xodimga murojaat qiling.
    pause
    exit /b 1
  )
)
echo Platforma ishga tushmoqda...
echo.
echo Kirish oynasi: http://localhost:3001/login
echo Katta ekran:   http://localhost:3001/display?kiosk=1
echo.
node server.js
if errorlevel 1 (
  echo.
  echo [XATO] Platforma bilan bog'lanib bo'lmadi. Internet va ma'lumotlar bazasi ulanishini tekshiring.
)
pause
