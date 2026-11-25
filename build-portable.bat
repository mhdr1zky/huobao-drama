@echo off
:: --- AUTO ELEVATE TO ADMINISTRATOR ---
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Meminta hak akses Administrator...
    powershell -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)
:: -------------------------------------

cd /d "%~dp0"
title Huobao Drama - Portable Builder (Administrator)

set "LOG_FILE=%~dp0build-log.txt"
echo === LOG BUILD HUOBAO DRAMA (%date% %time%) === > "%LOG_FILE%"

echo ========================================================
echo   MEMBANGUN HUOBAO DRAMA PORTABLE (ADMINISTRATOR)
echo ========================================================
echo Proses berjalan otomatis dan tercatat di build-log.txt.
echo Jangan tutup jendela ini sampai File Explorer terbuka.
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js belum terinstal! >> "%LOG_FILE%"
    goto gagal
)

if not exist "package.json" (
    echo [ERROR] File package.json tidak ditemukan di: %cd% >> "%LOG_FILE%"
    goto gagal
)

echo [0/5] Membersihkan konfigurasi npm dan memperbaiki package.json...
echo --- [0/5] FIX REGISTRY & PACKAGE.JSON --- >> "%LOG_FILE%"
set "REG_URL=https://registry.npmjs.org/"
set "NPM_CONFIG_REGISTRY=%REG_URL%"
set "npm_config_registry=%REG_URL%"
set "npm_config_ignore_scripts=false"

:: Hapus konfigurasi registry/proxy lama yang mungkin nyangkut di user/global
call npm config delete registry --location=user >> "%LOG_FILE%" 2>&1
call npm config delete registry --location=global >> "%LOG_FILE%" 2>&1
call npm config delete proxy --location=user >> "%LOG_FILE%" 2>&1
call npm config delete https-proxy --location=user >> "%LOG_FILE%" 2>&1
call npm config set registry https://registry.npmjs.org/ --location=user >> "%LOG_FILE%" 2>&1
call npm config set ignore-scripts false --location=user >> "%LOG_FILE%" 2>&1

:: Perbaiki package.json: ubah nilai versi yang berupa URL npmjs/aliyun/registry menjadi "*"
powershell -Command "Get-ChildItem -Recurse -Filter 'package.json' -Exclude 'node_modules' | ForEach-Object { $c = Get-Content $_.FullName -Raw; $c = $c -replace '\"https?://(www\.|registry\.)?npmjs\.(com|org)/[^\"]+\"', '\"*\"' -replace '\"https?://packages\.aliyun\.com/[^\"]+\"', '\"*\"'; Set-Content $_.FullName $c -NoNewline }" >> "%LOG_FILE%" 2>&1

call npm cache clean --force >> "%LOG_FILE%" 2>&1

echo [1/5] Membersihkan sisa instalasi lama & menginstal dependensi...
echo --- [1/5] INSTALASI DEPENDENSI --- >> "%LOG_FILE%"

for %%F in (.npmrc package-lock.json yarn.lock pnpm-lock.yaml) do (
    if exist "%%F" del /f /q "%%F"
    if exist "backend\%%F" del /f /q "backend\%%F"
    if exist "frontend\%%F" del /f /q "frontend\%%F"
    if exist "desktop\%%F" del /f /q "desktop\%%F"
)

for %%D in ("node_modules" "backend\node_modules" "frontend\node_modules" "desktop\node_modules") do (
    if exist %%D (
        echo   - Menghapus %%~D lama...
        rmdir /s /q %%D
    )
)

echo - [1a] Menginstal root...
call npm install --registry=%REG_URL% --legacy-peer-deps --ignore-scripts=false --no-audit --no-fund >> "%LOG_FILE%" 2>&1
if errorlevel 1 (
    echo [ERROR] Gagal di tahap: npm install ROOT >> "%LOG_FILE%"
    goto gagal
)

echo - [1b] Menginstal backend...
cd /d "%~dp0backend"
call npm install --registry=%REG_URL% --legacy-peer-deps --ignore-scripts=false --no-audit --no-fund >> "%LOG_FILE%" 2>&1
if errorlevel 1 (
    echo [ERROR] Gagal di tahap: npm install BACKEND >> "%LOG_FILE%"
    goto gagal
)
if exist "node_modules\esbuild\install.js" node "node_modules\esbuild\install.js" >> "%LOG_FILE%" 2>&1
if exist "node_modules\ffmpeg-static\install.js" node "node_modules\ffmpeg-static\install.js" >> "%LOG_FILE%" 2>&1
if exist "node_modules\sharp\install\check.js" node "node_modules\sharp\install\check.js" >> "%LOG_FILE%" 2>&1
if exist "node_modules\better-sqlite3" (
    pushd "node_modules\better-sqlite3"
    call npx prebuild-install || call npx node-gyp rebuild >> "%LOG_FILE%" 2>&1
    popd
)

echo - [1c] Menginstal frontend...
cd /d "%~dp0frontend"
call npm install --registry=%REG_URL% --legacy-peer-deps --ignore-scripts=false --no-audit --no-fund >> "%LOG_FILE%" 2>&1
if errorlevel 1 (
    echo [ERROR] Gagal di tahap: npm install FRONTEND >> "%LOG_FILE%"
    goto gagal
)

echo - [1d] Menginstal desktop (Electron)...
cd /d "%~dp0desktop"
call npm install --registry=%REG_URL% --legacy-peer-deps --ignore-scripts=false --no-audit --no-fund >> "%LOG_FILE%" 2>&1
if errorlevel 1 (
    echo [ERROR] Gagal di tahap: npm install DESKTOP >> "%LOG_FILE%"
    goto gagal
)
if exist "node_modules\electron\install.js" node "node_modules\electron\install.js" >> "%LOG_FILE%" 2>&1
if exist "node_modules\esbuild\install.js" node "node_modules\esbuild\install.js" >> "%LOG_FILE%" 2>&1

echo [2/5] Build Frontend (Nuxt 3 SPA)...
echo --- [2/5] BUILD FRONTEND --- >> "%LOG_FILE%"
cd /d "%~dp0frontend"
call npm run generate >> "%LOG_FILE%" 2>&1
if errorlevel 1 (
    echo [ERROR] Gagal di tahap: npm run generate FRONTEND >> "%LOG_FILE%"
    goto gagal
)
if exist "dist" rmdir /s /q "dist"
xcopy /E /I /Y ".output\public" "dist" >nul

echo [3/5] Build Desktop dan Backend Bundle...
echo --- [3/5] BUILD DESKTOP --- >> "%LOG_FILE%"
cd /d "%~dp0desktop"
call npm run build >> "%LOG_FILE%" 2>&1
if errorlevel 1 (
    echo [ERROR] Gagal di tahap: npm run build DESKTOP >> "%LOG_FILE%"
    goto gagal
)

echo [4/5] Packaging Portable Windows...
echo --- [4/5] ELECTRON-BUILDER --- >> "%LOG_FILE%"
call npx electron-builder --win dir --x64 >> "%LOG_FILE%" 2>&1
if errorlevel 1 (
    echo [ERROR] Gagal di tahap: electron-builder >> "%LOG_FILE%"
    goto gagal
)

echo [5/5] Menyusun folder HuobaoDrama-Portable...
echo --- [5/5] MENYUSUN FOLDER PORTABLE --- >> "%LOG_FILE%"
cd /d "%~dp0"
set "OUT_DIR=HuobaoDrama-Portable"
if exist "%OUT_DIR%" rmdir /s /q "%OUT_DIR%"
mkdir "%OUT_DIR%\app"
mkdir "%OUT_DIR%\HuobaoData"

xcopy /E /I /Y "desktop\release\win-unpacked\*" "%OUT_DIR%\app\" >nul

echo @echo off > "%OUT_DIR%\Jalankan-HuobaoDrama.bat"
echo cd /d "%%~dp0" >> "%OUT_DIR%\Jalankan-HuobaoDrama.bat"
echo if not exist "HuobaoData" mkdir "HuobaoData" >> "%OUT_DIR%\Jalankan-HuobaoDrama.bat"
echo start "" "%%~dp0app\HuobaoDrama.exe" --user-data-dir="%%~dp0HuobaoData" >> "%OUT_DIR%\Jalankan-HuobaoDrama.bat"
echo exit >> "%OUT_DIR%\Jalankan-HuobaoDrama.bat"

echo === BUILD SELESAI SUKSES === >> "%LOG_FILE%"
explorer "%OUT_DIR%"
exit

:gagal
echo.
echo [ERROR] Proses terhenti! Membuka build-log.txt untuk melihat penyebabnya...
start "" notepad "%LOG_FILE%"
timeout /t 3 >nul
exit
