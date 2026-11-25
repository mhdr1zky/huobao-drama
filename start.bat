@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"

:: Jalankan ulang file .bat ini dalam mode tersembunyi lalu tutup CMD awal
if /i not "%~1"=="--hidden" (
    powershell -NoProfile -WindowStyle Hidden -Command "Start-Process -FilePath 'cmd.exe' -ArgumentList '/c \"\"%~f0\" --hidden\"' -WindowStyle Hidden"
    exit /b 0
)

set "B_PORT=5679"
set "F_PORT=3013"

:: Cek apakah port 5679 atau 3013 sedang LISTENING
set "IS_RUNNING=0"
for /f "tokens=5" %%a in ('netstat -ano ^| findstr /R /C:":%B_PORT% .*LISTENING" /C:":%F_PORT% .*LISTENING"') do (
    if not "%%a"=="0" set "IS_RUNNING=1"
)

:: Jika SUDAH berjalan -> minta konfirmasi dulu sebelum menghentikan
if "%IS_RUNNING%"=="1" (
    for /f %%r in ('powershell -NoProfile -Command "Add-Type -AssemblyName PresentationFramework; $res = [System.Windows.MessageBox]::Show('Aplikasi Huobao Drama sedang berjalan. Apakah Anda ingin menghentikannya?', 'Konfirmasi - Huobao Drama', 'YesNo', 'Question'); if ($res -eq 'Yes') { 'YES' } else { 'NO' }"') do (
        set "CONFIRM=%%r"
    )

    if /i not "!CONFIRM!"=="YES" (
        exit /b 0
    )

    for /f "tokens=5" %%p in ('netstat -ano ^| findstr /R /C:":%B_PORT% .*LISTENING" /C:":%F_PORT% .*LISTENING"') do (
        if not "%%p"=="0" taskkill /F /T /PID %%p >nul 2>&1
    )
    powershell -NoProfile -WindowStyle Hidden -Command "Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show('Huobao Drama berhasil dihentikan.', 'Huobao Drama', 'OK', 'Information')"
    exit /b 0
)

:: Jika BELUM berjalan -> cek node_modules lalu jalankan di background
if not exist "backend\node_modules" (
    powershell -NoProfile -WindowStyle Hidden -Command "Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show('backend\node_modules belum terpasang.', 'Huobao Drama - Error', 'OK', 'Error')"
    exit /b 1
)

if not exist "frontend\node_modules" (
    powershell -NoProfile -WindowStyle Hidden -Command "Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show('frontend\node_modules belum terpasang.', 'Huobao Drama - Error', 'OK', 'Error')"
    exit /b 1
)

powershell -NoProfile -WindowStyle Hidden -Command "Start-Process -FilePath 'cmd.exe' -ArgumentList '/c cd /d \"\"%~dp0backend\"\" && npm run dev' -WindowStyle Hidden"
powershell -NoProfile -WindowStyle Hidden -Command "Start-Process -FilePath 'cmd.exe' -ArgumentList '/c cd /d \"\"%~dp0frontend\"\" && npm run dev' -WindowStyle Hidden"

:: Tunggu hingga http://localhost:3013 siap
powershell -NoProfile -WindowStyle Hidden -Command "for ($i=0; $i -lt 45; $i++) { try { $r = Invoke-WebRequest -Uri 'http://localhost:%F_PORT%' -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -lt 500) { break } } catch {} Start-Sleep -Seconds 1 }"

start "" "http://localhost:%F_PORT%"
endlocal