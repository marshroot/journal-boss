@echo off
setlocal EnableExtensions EnableDelayedExpansion
title myJournal - Local Development Launcher
cd /d "%~dp0"

echo ======================================================
echo   myJournal - LOCAL DEVELOPMENT
echo ======================================================
echo.

REM --- Prerequisites check ---
where node >nul 2>nul || (echo [ERROR] Node.js 22 LTS is required. Install it from https://nodejs.org/ and run this file again.& pause & exit /b 1)
where npm >nul 2>nul || (echo [ERROR] npm was not found. Reinstall Node.js LTS with npm included.& pause & exit /b 1)
where dotnet >nul 2>nul || (echo [ERROR] .NET SDK 9 is required. Install it from https://dotnet.microsoft.com/download/dotnet/9.0 and run this file again.& pause & exit /b 1)

set "HAS_NET9="
for /f "tokens=1" %%V in ('dotnet --list-sdks') do if "%%V"=="9.0.0" set "HAS_NET9=1"
if not defined HAS_NET9 (
  for /f "tokens=1 delims=." %%V in ('dotnet --list-sdks') do if "%%V"=="9" set "HAS_NET9=1"
)
if not defined HAS_NET9 (
  echo [ERROR] .NET SDK 9.x was not found. The backend targets net9.0.
  echo Install .NET SDK 9.x and retry.
  pause
  exit /b 1
)

REM --- Ensure .env exists ---
if not exist ".env" (
  if exist ".env.example" (
    copy /y ".env.example" ".env" >nul
    echo [INFO] Created .env from .env.example. Review it before production deployment.
  ) else (
    echo [ERROR] .env.example is missing.
    pause
    exit /b 1
  )
)

REM --- Load LIVEKIT vars from .env ---
for /f "usebackq tokens=1,* delims==" %%A in (".env") do (
  set "KEY=%%A"
  set "VAL=%%B"
  if "!KEY!"=="LIVEKIT_URL" set "LIVEKIT_URL=!VAL!"
  if "!KEY!"=="LIVEKIT_API_KEY" set "LIVEKIT_API_KEY=!VAL!"
  if "!KEY!"=="LIVEKIT_API_SECRET" set "LIVEKIT_API_SECRET=!VAL!"
)

REM --- Install frontend deps if needed ---
if not exist "frontend\node_modules\vite\bin\vite.js" (
  echo [INFO] Installing frontend dependencies with npm ci...
  pushd frontend
  call npm ci
  if errorlevel 1 (popd & echo [ERROR] npm ci failed. Check your network and package-lock.json.& pause & exit /b 1)
  popd
)

REM --- Ensure database directory exists ---
if not exist "database" mkdir database

REM --- Common env vars ---
set "ASPNETCORE_ENVIRONMENT=Development"
set "ASPNETCORE_URLS=http://localhost:5000"
set "Jwt__Key=Jornal-LOCAL-ONLY-Development-Key-Replace-Before-Deployment-2026"
set "Jwt__Issuer=JournalBackend"
set "Jwt__Audience=JournalFrontend"
set "Admin__InitialLogin=admin"
if not defined ADMIN_INITIAL_PASSWORD set "ADMIN_INITIAL_PASSWORD=ChangeThisLocalPassword123!"
set "Admin__InitialPassword=%ADMIN_INITIAL_PASSWORD%"
set "ConnectionStrings__DefaultConnection=Data Source=%CD%\database\journal.db"

echo.
echo ======================================================
echo   Starting LiveKit, Backend and Frontend
echo ======================================================
echo.

REM --- Start LiveKit server ---
if exist "livekit\livekit-server.exe" (
  echo [INFO] Starting LiveKit server on %LIVEKIT_URL% ...
  start "myJournal LiveKit" /D "%CD%\livekit" cmd /k "livekit-server.exe --config config.yaml"
  timeout /t 2 /nobreak >nul
) else (
  echo [WARNING] livekit\livekit-server.exe not found. Skipping LiveKit start.
  echo            Online lessons require LiveKit. Download it from https://livekit.io/download
)

REM --- Start backend ---
echo [INFO] Starting backend on http://localhost:5000 ...
start "myJournal Backend" /D "%CD%\backend\JournalBackend" cmd /k "set ASPNETCORE_ENVIRONMENT=Development ^&^& set ASPNETCORE_URLS=http://localhost:5000 ^&^& set Jwt__Key=Jornal-LOCAL-ONLY-Development-Key-Replace-Before-Deployment-2026 ^&^& set Jwt__Issuer=JournalBackend ^&^& set Jwt__Audience=JournalFrontend ^&^& set Admin__InitialLogin=admin ^&^& set Admin__InitialPassword=%ADMIN_INITIAL_PASSWORD% ^&^& set ConnectionStrings__DefaultConnection=Data Source=../../database/journal.db ^&^& dotnet run --no-launch-profile"

REM --- Wait for backend health ---
echo [INFO] Waiting for backend health endpoint ...
set "HEALTHY="
for /l %%I in (1,1,45) do (
  powershell -NoProfile -Command "try { $r=Invoke-WebRequest -UseBasicParsing http://localhost:5000/health -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>nul
  if not errorlevel 1 (set "HEALTHY=1" & goto backend_ready)
  timeout /t 2 /nobreak >nul
)
:backend_ready
if not defined HEALTHY (
  echo [WARNING] Backend did not report healthy within 90 seconds.
  echo Check the myJournal Backend console for errors. Frontend will still be started.
) else (
  echo [OK] Backend health endpoint responded.
)

REM --- Start frontend ---
echo [INFO] Starting frontend at http://localhost:3000 ...
start "myJournal Frontend" cmd /k "cd /d "%CD%\frontend" ^&^& npm run dev"
timeout /t 3 /nobreak >nul
start "" http://localhost:3000

echo.
echo ======================================================
echo   All services launched
echo ======================================================
echo   LiveKit : %LIVEKIT_URL%
echo   Backend : http://localhost:5000
echo   Frontend: http://localhost:3000
echo.
echo   Close the console windows to stop the services.
echo   Local development admin login: admin
echo   Initial local password: %ADMIN_INITIAL_PASSWORD%
echo   Change the password immediately if you expose this environment to a network.
echo ======================================================
echo.
pause
endlocal
