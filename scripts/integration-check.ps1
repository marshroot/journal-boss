param(
  [string]$BaseUrl = 'http://localhost:3000',
  [string]$Login = $env:ADMIN_LOGIN,
  [string]$Password = $env:ADMIN_PASSWORD
)
$ErrorActionPreference = 'Stop'

function Get-Json([string]$Uri, [hashtable]$Headers=@{}) {
  Invoke-RestMethod -Uri $Uri -Headers $Headers -Method Get
}
function Post-Json([string]$Uri, [hashtable]$Headers=@{}, $Body=$null) {
  if ($null -eq $Body) { Invoke-RestMethod -Uri $Uri -Headers $Headers -Method Post }
  else { Invoke-RestMethod -Uri $Uri -Headers $Headers -Method Post -ContentType 'application/json' -Body ($Body | ConvertTo-Json -Depth 10) }
}

Write-Host "JV23 integration check: $BaseUrl" -ForegroundColor Cyan
$health = Invoke-WebRequest -Uri "$BaseUrl/health" -UseBasicParsing
if ($health.StatusCode -ne 200 -or $health.Content.Trim() -ne 'Healthy') { throw "Backend health failed: $($health.StatusCode) $($health.Content)" }
Write-Host '[OK] backend health through nginx' -ForegroundColor Green

if ([string]::IsNullOrWhiteSpace($Login) -or [string]::IsNullOrWhiteSpace($Password)) {
  Write-Host '[SKIP] Admin API checks: set ADMIN_LOGIN and ADMIN_PASSWORD.' -ForegroundColor Yellow
  exit 0
}

$auth = Post-Json "$BaseUrl/api/auth/login" @{} @{ login=$Login; password=$Password }
if ([string]::IsNullOrWhiteSpace($auth.accessToken)) { throw 'No accessToken from login.' }
$h = @{ Authorization = "Bearer $($auth.accessToken)" }
$me = Get-Json "$BaseUrl/api/auth/me" $h
Write-Host "[OK] auth/me role=$($me.role)" -ForegroundColor Green

# SignalR negotiate must work through the same-origin nginx proxy.
$neg = Invoke-WebRequest -Method Post -Uri "$BaseUrl/hubs/lesson-chat/negotiate?negotiateVersion=1" -Headers $h -ContentType 'application/json' -Body '{}' -UseBasicParsing
if ($neg.StatusCode -ne 200) { throw "SignalR negotiate failed: $($neg.StatusCode)" }
Write-Host '[OK] SignalR negotiate' -ForegroundColor Green

# The collab endpoint is authenticated and must not be directly exposed by the frontend container.
try {
  $collab = Invoke-WebRequest -Uri "$BaseUrl/collab/" -UseBasicParsing -TimeoutSec 10
  Write-Host "[INFO] /collab/ HTTP $($collab.StatusCode) (WebSocket endpoint; HTTP response is implementation-dependent)" -ForegroundColor DarkCyan
} catch {
  Write-Host '[INFO] /collab/ HTTP probe did not return a normal page; test Yjs from two browser sessions.' -ForegroundColor DarkCyan
}

Write-Host ''
Write-Host 'Manual integration checks:' -ForegroundColor Cyan
Write-Host '  1. Teacher: start online lesson -> student joins -> audio/video.'
Write-Host '  2. Two users: lesson chat messages appear in both sessions.'
Write-Host '  3. Two users: Code Lab edits synchronize; run code returns Judge0 result.'
Write-Host '  4. Two users: Excalidraw board edits synchronize and survive collab restart.'
Write-Host '  5. Other group: board/chat/LiveKit/Code Lab requests return 403.'
Write-Host '  6. Old SQLite copy: start backend and verify no [DB Migration ERROR].'
