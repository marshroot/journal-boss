param(
  [string]$BaseUrl = 'http://localhost:3000',
  [string]$Login = $env:ADMIN_LOGIN,
  [string]$Password = $env:ADMIN_PASSWORD
)

$ErrorActionPreference = 'Stop'

function Assert-Ok($Response, [string]$Name) {
  if (-not $Response) { throw "$Name: empty response" }
  Write-Host "[OK] $Name" -ForegroundColor Green
}

Write-Host "JV23 smoke test: $BaseUrl"

$health = Invoke-WebRequest -Uri "$BaseUrl/health" -UseBasicParsing
if ($health.StatusCode -ne 200 -or $health.Content.Trim() -ne 'Healthy') {
  throw "Health check failed: HTTP $($health.StatusCode), body='$($health.Content)'"
}
Write-Host '[OK] /health' -ForegroundColor Green

if ([string]::IsNullOrWhiteSpace($Login) -or [string]::IsNullOrWhiteSpace($Password)) {
  Write-Host '[SKIP] Auth checks: ADMIN_LOGIN/ADMIN_PASSWORD are not set.' -ForegroundColor Yellow
  exit 0
}

$body = @{ login = $Login; password = $Password } | ConvertTo-Json
$auth = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/auth/login" -ContentType 'application/json' -Body $body
if ([string]::IsNullOrWhiteSpace($auth.accessToken)) { throw 'Login succeeded without accessToken.' }
Assert-Ok $auth 'POST /api/auth/login'

$headers = @{ Authorization = "Bearer $($auth.accessToken)" }
$me = Invoke-RestMethod -Method Get -Uri "$BaseUrl/api/auth/me" -Headers $headers
if (-not $me.id -or -not $me.role) { throw '/api/auth/me returned incomplete user data.' }
Write-Host "[OK] GET /api/auth/me ($($me.role))" -ForegroundColor Green

$materials = Invoke-WebRequest -Method Get -Uri "$BaseUrl/api/materials" -Headers $headers -UseBasicParsing
if ($materials.StatusCode -ne 200) { throw "/api/materials returned HTTP $($materials.StatusCode)." }
Write-Host '[OK] GET /api/materials' -ForegroundColor Green

$negotiate = Invoke-WebRequest -Method Post -Uri "$BaseUrl/hubs/lesson-chat/negotiate?negotiateVersion=1" -Headers $headers -ContentType 'application/json' -Body '{}' -UseBasicParsing
if ($negotiate.StatusCode -ne 200) { throw "SignalR negotiate returned HTTP $($negotiate.StatusCode)." }
Write-Host '[OK] SignalR negotiate /hubs/lesson-chat' -ForegroundColor Green

Write-Host 'Smoke test completed.' -ForegroundColor Cyan
