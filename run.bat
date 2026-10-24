@echo off
setlocal EnableExtensions
 title Jornal v23 - Local Development Launcher
cd /d "%~dp0"

 echo ======================================================
 echo   JORNAL v23 - LOCAL DEVELOPMENT
 echo ======================================================
 echo.

where node >nul 2>nul || (echo [ERROR] Node.js 22 LTS is required. Install it from https://nodejs.org/ and run this file again.& pause & exit /b 1)
where npm >nul 2>nul || (echo [ERROR] npm was not found. Reinstall Node.js LTS with npm included.& pause & exit /b 1)
where dotnet >nul 2>nul || (echo [ERROR] .NET SDK 9 is required. Install it from https://dotnet.microsoft.com/download/dotnet/9.0 and run this file again.& pause & exit /b 1)

if not exist "livekit\livekit-server.exe" (
  echo [WARNING] livekit-server.exe not found in livekit\ folder. LiveKit integration will be unavailable.
  set "SKIP_LIVEKIT=1"
) else (
  set "SKIP_LIVEKIT="
)

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

if not exist "frontend\node_modules\vite\bin\vite.js" (
  echo [INFO] Installing frontend dependencies with npm ci...
  pushd frontend
  call npm ci
  if errorlevel 1 (popd & echo [ERROR] npm ci failed. Check your network and package-lock.json.& pause & exit /b 1)
  popd
)

set "ASPNETCORE_ENVIRONMENT=Development"
set "ASPNETCORE_URLS=http://localhost:5000"
set "Jwt__Key=Jornal-LOCAL-ONLY-Development-Key-Replace-Before-Deployment-2026"
set "Jwt__Issuer=JournalBackend"
set "Jwt__Audience=JournalFrontend"
set "Admin__InitialLogin=admin"
if not defined ADMIN_INITIAL_PASSWORD set "ADMIN_INITIAL_PASSWORD=ChangeThisLocalPassword123!"
set "Admin__InitialPassword=%ADMIN_INITIAL_PASSWORD%"
set "ConnectionStrings__DefaultConnection=Data Source=%CD%\database\journal.db"
if not exist "database" mkdir database

 echo.
echo [INFO] Starting backend on http://localhost:5000 ...
if not defined SKIP_LIVEKIT (
  echo [INFO] Starting LiveKit server ...
  start "Jornal LiveKit" /D "%CD%\livekit" cmd /k "livekit-server.exe --config config.yaml"

  echo [INFO] Waiting for LiveKit health endpoint ...
  set "LIVEKIT_HEALTHY="
  for /l %%I in (1,1,30) do (
    powershell -NoProfile -Command "try { $r=Invoke-WebRequest -UseBasicParsing http://localhost:7880/ -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>nul
    if not errorlevel 1 (set "LIVEKIT_HEALTHY=1" & goto livekit_ready)
    ping -n 3 127.0.0.1 >nul
  )
:livekit_ready
  if not defined LIVEKIT_HEALTHY (
    echo [WARNING] LiveKit did not report healthy within 60 seconds. LiveKit integration may not work.
  ) else (
    echo [OK] LiveKit health endpoint responded.
  )
)

set "LIVEKIT_URL=ws://localhost:7880"
set "LIVEKIT_PUBLIC_URL=ws://localhost:7880"
set "LIVEKIT_SERVER_URL=http://localhost:7880"
rem Matches the public LiveKit development key in livekit\config.yaml (devkey/secret).
rem Generate your own key pair before exposing the environment to a network.
set "LIVEKIT_API_KEY=devkey"
set "LIVEKIT_API_SECRET=secret"
set "LIVEKIT_TOKEN_TTL_SECONDS=7200"

start "Jornal Backend" /D "%CD%\backend\JournalBackend" cmd /k "dotnet run --no-launch-profile"

 echo [INFO] Waiting for backend health endpoint ...
set "HEALTHY="
for /l %%I in (1,1,45) do (
  powershell -NoProfile -Command "try { $r=Invoke-WebRequest -UseBasicParsing http://localhost:5000/health -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>nul
  if not errorlevel 1 (set "HEALTHY=1" & goto backend_ready)
  ping -n 3 127.0.0.1 >nul
)
:backend_ready
if not defined HEALTHY (
  echo [WARNING] Backend did not report healthy within 90 seconds.
  echo Check the Jornal Backend console for errors. Frontend will still be started.
) else (
  echo [OK] Backend health endpoint responded.
)

 echo [INFO] Starting frontend on http://localhost:3000 ...
start "Jornal Frontend" /D "%CD%\frontend" cmd /k "npm run dev"

set "FRONTEND_READY="
for /l %%I in (1,1,45) do (
  powershell -NoProfile -Command "try { $r=Invoke-WebRequest -UseBasicParsing http://localhost:3000/ -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>nul
  if not errorlevel 1 (set "FRONTEND_READY=1" & goto frontend_ready)
  ping -n 3 127.0.0.1 >nul
)
:frontend_ready
if not defined FRONTEND_READY (
  echo [WARNING] Frontend did not respond within 90 seconds.
  echo Check the Jornal Frontend console for errors.
) else (
  echo [OK] Frontend is responding on http://localhost:3000
)

start "" http://localhost:3000
 echo.
 echo The backend and frontend run in separate console windows.
 echo Close those windows to stop the services.
 echo Local development admin login: admin
 echo Initial local password: %ADMIN_INITIAL_PASSWORD%
 echo Change the password immediately if you expose this environment to a network.
 echo This launcher does not start the removed Telegram login/bot flow.
 echo.
pause
endlocal
