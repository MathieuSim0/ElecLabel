@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

echo ##############################################################
echo #   ElecLabel - Build complet : APK Android + EXE Windows    #
echo ##############################################################
echo.

REM ============ 1) APK Android ============
echo ------------------------------------------------------------
echo  ETAPE 1/2 : APK Android
echo ------------------------------------------------------------
call "eleclabel-mobile\build-apk.bat"
if errorlevel 1 (
  echo [ATTENTION] Le build APK a echoue. On continue avec le .exe.
)

echo.
REM ============ 2) EXE Windows ============
echo ------------------------------------------------------------
echo  ETAPE 2/2 : EXE Windows (installateur)
echo ------------------------------------------------------------
echo.
echo Le .exe a besoin de Rust + Visual Studio Build Tools C++.
echo Si tu ne les as pas, laisse plutot GitHub Actions le faire
echo (push d'un tag : git tag v1.0.1 ^&^& git push --tags).
echo.
choice /C ON /M "Lancer le build EXE local maintenant (O=oui, N=non) "
if errorlevel 2 goto :skipexe

cd eleclabel
where cargo >nul 2>nul
if errorlevel 1 (
  echo [ERREUR] Rust introuvable. Installe-le depuis https://rustup.rs
  cd ..
  goto :end
)
call npm run tauri build
if errorlevel 1 (
  echo [ERREUR] Build EXE echoue ^(souvent : Build Tools C++ manquants^).
  echo Voir eleclabel\BUILD-WINDOWS.md, ou utilise GitHub Actions.
) else (
  echo.
  echo EXE genere : eleclabel\src-tauri\target\release\bundle\nsis\
  start "" "eleclabel\src-tauri\target\release\bundle\nsis"
)
cd ..
goto :end

:skipexe
echo Build EXE ignore. Pour le produire automatiquement : push un tag git.

:end
echo.
echo ##############################################################
echo #   Termine.                                                 #
echo ##############################################################
pause
