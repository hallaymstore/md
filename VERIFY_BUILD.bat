@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo =============================================
echo MD QDTU - v2.5 BUILD TEKSHIRUV
echo =============================================
type VERSION.txt
echo.
echo package.json:
findstr /C:"\"version\"" package.json
echo.
echo UI cache key:
findstr /C:"2.5.0-approval-workflow" views\partials\head.ejs
echo.
echo Theme toggle:
findstr /C:"data-theme-toggle" views\partials\topbar.ejs
echo.
echo Node syntax check:
node scripts\check.js
echo.
echo Build standart ravishda http://localhost:3001 da ishlaydi.
pause
