param(
  [switch]$BuildFrontend,
  [switch]$BuildDocker
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host 'JV23 source verification' -ForegroundColor Cyan

$required = @(
  'docker-compose.yml',
  'backend/JournalBackend/JournalBackend.csproj',
  'backend/JournalBackend/Program.cs',
  'backend/JournalBackend/Database/SqliteSchemaUpgrades.cs',
  'frontend/package.json',
  'frontend/vite.config.ts',
  'frontend/nginx.conf',
  'collab/server.js',
  'docs/FINAL_INTEGRATION.md'
)
foreach ($file in $required) {
  if (-not (Test-Path (Join-Path $root $file))) { throw "Missing required file: $file" }
}
Write-Host '[OK] required files' -ForegroundColor Green

$frontendSource = Get-ChildItem "$root/frontend/src" -Recurse -File -Include *.ts,*.tsx | Get-Content -Raw
if ($frontendSource -match 'http://localhost:5000|http://127\.0\.0\.1:5000|http://localhost:8080|http://127\.0\.0\.1:8080') {
  throw 'Frontend source still contains a hard-coded backend localhost URL.'
}
Write-Host '[OK] frontend API URLs are same-origin/configured' -ForegroundColor Green

$program = Get-Content "$root/backend/JournalBackend/Program.cs" -Raw
if ($program -notmatch 'if \(conn\.State != System\.Data\.ConnectionState\.Open\) conn\.Open\(\);') {
  throw 'SQLite subject-teacher migration does not reopen the connection.'
}
Write-Host '[OK] SQLite migration connection reopen guard' -ForegroundColor Green

$compose = Get-Content "$root/docker-compose.yml" -Raw
if ($compose -match '"1234:1234"') { throw 'Collab service is still published directly to host.' }
Write-Host '[OK] collab is not directly published to host' -ForegroundColor Green

if ($BuildFrontend) {
  Push-Location "$root/frontend"
  try {
    npm run lint
    npm run build
  } finally { Pop-Location }
  Write-Host '[OK] frontend lint/build' -ForegroundColor Green
}

if ($BuildDocker) {
  docker compose config | Out-Null
  docker compose build
  Write-Host '[OK] docker compose build' -ForegroundColor Green
}

Write-Host 'Source verification completed.' -ForegroundColor Cyan
