@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

echo ============================================================
echo   ElecLabel - Construction de l'installateur Windows (.exe)
echo ============================================================
echo.

REM --- Verification Node.js ---
where node >nul 2>nul
if errorlevel 1 (
  echo [ERREUR] Node.js introuvable.
  echo Installe-le depuis https://nodejs.org puis relance ce script.
  pause
  exit /b 1
)
echo [OK] Node.js detecte

REM --- Verification Rust / cargo ---
where cargo >nul 2>nul
if errorlevel 1 (
  echo [ERREUR] Rust introuvable.
  echo Installe-le depuis https://rustup.rs puis relance ce script.
  echo Voir BUILD-WINDOWS.md section Prerequis.
  pause
  exit /b 1
)
echo [OK] Rust detecte

REM --- Dependances npm ---
if not exist node_modules (
  echo.
  echo Installation des dependances npm...
  call npm install
  if errorlevel 1 (
    echo [ERREUR] npm install a echoue.
    pause
    exit /b 1
  )
)
echo [OK] Dependances npm pretes

REM --- Verification du fichier .env (cles API) ---
if not exist .env (
  echo.
  echo [ATTENTION] Fichier .env absent.
  echo Les cles API OpenAI / Supabase ne seront PAS incluses dans le .exe.
  echo L'analyse photo et la synchro cloud ne fonctionneront pas.
  echo Cree le fichier .env avant de continuer si tu veux ces fonctions.
  echo.
  pause
)

echo.
echo Construction en cours...
echo (5 a 15 minutes la premiere fois - Rust compile tout)
echo.

call npm run tauri build
if errorlevel 1 (
  echo.
  echo [ERREUR] La construction a echoue.
  echo Cause la plus frequente : Visual Studio Build Tools C++ manquant.
  echo Lis BUILD-WINDOWS.md - section Prerequis.
  pause
  exit /b 1
)

echo.
echo ============================================================
echo   TERMINE !
echo ============================================================
echo.
echo Installateur cree dans :
echo   src-tauri\target\release\bundle\nsis\
echo.
echo Fichier : ElecLabel_1.0.0_x64-setup.exe
echo.
echo Copie ce fichier sur n'importe quel PC Windows pour installer.
echo.
explorer "src-tauri\target\release\bundle\nsis"
pause
