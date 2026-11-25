@echo off
setlocal
cd /d "%~dp0"

if not exist "backend\node_modules" (
  echo [ERROR] backend\node_modules belum terpasang. Jalankan "cd backend && npm install" terlebih dahulu.
  pause
  exit /b 1
)

if not exist "frontend\node_modules" (
  echo [ERROR] frontend\node_modules belum terpasang. Jalankan "cd frontend && npm install" terlebih dahulu.
  pause
  exit /b 1
)

echo Memulai Huobao Drama Backend (port 5679)...
start "Huobao Drama - Backend" cmd /k "cd /d "%~dp0backend" && npm run dev"

echo Memulai Huobao Drama Frontend (port 3013)...
start "Huobao Drama - Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo Menunggu server siap di http://localhost:3013 ...
powershell -NoProfile -Command "for ($i=0; $i -lt 30; $i++) { try { $r = Invoke-WebRequest -Uri 'http://localhost:3013' -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -lt 500) { break } } catch {} Start-Sleep -Seconds 1 }"

echo Membuka http://localhost:3013 di browser...
start "" "http://localhost:3013"
endlocal
