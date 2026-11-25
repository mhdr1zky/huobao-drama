@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"

:: Jika belum relaunched secara hidden, jalankan ulang file .bat ini dalam mode tersembunyi lalu keluar
if /i not "%~1"=="--hidden" (
    powershell -NoProfile -WindowStyle Hidden -Command "Start-Process -FilePath 'cmd.exe' -ArgumentList '/c \"\"%~f0\" --hidden\"' -WindowStyle Hidden"
    exit /b 0
)

set "B_PORT=5679"
set "F_PORT=3013"

:: Jika port sudah berjalan, hentikan proses lama lalu lanjutkan start bersih
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /R /C:":%B_PORT% .*LISTENING" /C:":%F_PORT% .*LISTENING"') do (
    if not "%%p"=="0" taskkill /F /T /PID %%p >nul 2>&1
)

if not exist "backend\node_modules" exit /b 1
if not exist "frontend\node_modules" exit /b 1

:: Jalankan backend dan frontend secara tersembunyi
powershell -NoProfile -WindowStyle Hidden -Command "Start-Process -FilePath 'cmd.exe' -ArgumentList '/c cd /d \"\"%~dp0backend\"\" && npm run dev' -WindowStyle Hidden"
powershell -NoProfile -WindowStyle Hidden -Command "Start-Process -FilePath 'cmd.exe' -ArgumentList '/c cd /d \"\"%~dp0frontend\"\" && npm run dev' -WindowStyle Hidden"

:: Tunggu sampai http://localhost:3013 siap
powershell -NoProfile -WindowStyle Hidden -Command "for ($i=0; $i -lt 45; $i++) { try { $r = Invoke-WebRequest -Uri 'http://localhost:%F_PORT%' -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -lt 500) { break } } catch {} Start-Sleep -Seconds 1 }"

start "" "http://localhost:%F_PORT%"
endlocal