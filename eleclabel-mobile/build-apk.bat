@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
cd /d "%~dp0"

echo ============================================================
echo   ElecLabel - Build APK Android (sans ouvrir Android Studio)
echo ============================================================
echo.

REM ---- Node.js ----
where node >nul 2>nul
if errorlevel 1 (
  echo [ERREUR] Node.js introuvable. Installe-le depuis https://nodejs.org
  pause & exit /b 1
)
echo [OK] Node.js

REM ---- JAVA_HOME : sinon, utilise le JDK livre avec Android Studio ----
if "%JAVA_HOME%"=="" (
  if exist "%ProgramFiles%\Android\Android Studio\jbr\bin\java.exe" (
    set "JAVA_HOME=%ProgramFiles%\Android\Android Studio\jbr"
    echo [OK] JAVA_HOME = JDK d'Android Studio
  ) else (
    echo [ATTENTION] JAVA_HOME non defini. Si le build echoue, installe un JDK 17
    echo             ou ouvre Android Studio une fois.
  )
) else (
  echo [OK] JAVA_HOME deja defini
)

REM ---- Fichier .env ----
if not exist .env (
  echo [ERREUR] Fichier .env manquant ^(cles Supabase^). Cree-le avant de builder.
  pause & exit /b 1
)
echo [OK] .env present

REM ---- Dependances npm ----
if not exist node_modules (
  echo Installation des dependances npm...
  call npm install || goto :err
)
echo [OK] Dependances npm

REM ---- Scaffold du projet Android si absent ----
if not exist android (
  echo Premiere fois : creation du projet Android...
  call npx cap add android || goto :err
)

REM ---- SDK Android : ecrit local.properties si besoin ----
if not exist android\local.properties (
  if not "%ANDROID_HOME%"=="" (
    set "SDKP=%ANDROID_HOME:\=/%"
    > android\local.properties echo sdk.dir=!SDKP!
  ) else if exist "%LOCALAPPDATA%\Android\Sdk" (
    set "SDKP=%LOCALAPPDATA:\=/%/Android/Sdk"
    > android\local.properties echo sdk.dir=!SDKP!
    echo [OK] SDK detecte: %LOCALAPPDATA%\Android\Sdk
  ) else (
    echo [ATTENTION] SDK Android introuvable. Ouvre Android Studio une fois pour l'installer.
  )
)

echo.
echo [1/3] Build du frontend...
call npm run build || goto :err

echo [2/3] Synchronisation Capacitor...
call npx cap sync android || goto :err
call node scripts\patch-android-manifest.mjs

echo [3/3] Build de l'APK (Gradle)... (peut prendre quelques minutes)
cd android
call gradlew.bat assembleDebug
if errorlevel 1 ( cd .. & goto :err )
cd ..

echo.
echo ============================================================
echo   TERMINE !
echo ============================================================
echo APK genere :
echo   eleclabel-mobile\android\app\build\outputs\apk\debug\app-debug.apk
echo.
echo Copie ce fichier sur ton telephone pour l'installer.
start "" "android\app\build\outputs\apk\debug"
pause
exit /b 0

:err
echo.
echo [ERREUR] Le build a echoue. Lis les messages ci-dessus.
echo Causes frequentes : JAVA_HOME absent, ou SDK Android non installe.
pause
exit /b 1
