#Requires -Version 5.1
<#
.SYNOPSIS
  HostelGhar one-shot check: static quality + build + live health + performance.
  4 phases, PASS/FAIL/SKIP summary + exit code (0 = no FAIL):
    1. Static - lint, typecheck, tests, build
    2. Live   - /health, /health/live, /health/ready, /metrics (+latency)
    3. Bench  - api health, redis PING, postgres SELECT 1 (p50/p95/p99 vs budget)
    4. Summary table + JSON report in performance/reports/
  Live/bench SKIP (not FAIL) when server/deps unreachable, unless -RequireLive.
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts/check-all.ps1
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts/check-all.ps1 -Requests 500
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts/check-all.ps1 -SkipLive
#>
[CmdletBinding()]
param(
  [string]$BaseUrl = '',
  [int]$Requests = 100,
  [double]$ApiP95BudgetMs = 500,
  [double]$DbP95BudgetMs = 100,
  [double]$RedisP95BudgetMs = 50,
  [double]$LiveBudgetMs = 1000,
  [switch]$SkipStatic,
  [switch]$SkipLive,
  [switch]$RequireLive,
  [switch]$IncludeFormat
)

$ErrorActionPreference = 'Continue'
if ([string]::IsNullOrWhiteSpace($BaseUrl)) {
  if ([string]::IsNullOrWhiteSpace($env:API_URL)) { $BaseUrl = 'http://localhost:8000' }
  else { $BaseUrl = $env:API_URL }
}
$BaseUrl = $BaseUrl.TrimEnd('/')
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot
$script:results = @()

function Add-Result {
  param([string]$Name, [string]$Status, [string]$Detail, [double]$Ms = 0)
  $script:results += [pscustomobject]@{
    Check = $Name; Status = $Status; Detail = $Detail; Ms = [math]::Round($Ms, 1)
  }
  $color = @{ PASS = 'Green'; FAIL = 'Red'; SKIP = 'Yellow' }[$Status]
  Write-Host ("  [{0}] {1}  {2}" -f $Status, $Name, $Detail) -ForegroundColor $color
}

function Invoke-NpmStep {
  param([string]$Name, [string]$Command)
  Write-Host ""
  Write-Host "== $Name ==" -ForegroundColor Cyan
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  $out = & cmd /c "$Command 2>&1"
  $code = $LASTEXITCODE
  $sw.Stop()
  if ($code -eq 0) { Add-Result $Name 'PASS' 'exit 0' $sw.Elapsed.TotalMilliseconds }
  else { Add-Result $Name 'FAIL' ("exit {0}: {1}" -f $code, (($out | Select-Object -Last 5) -join ' | ')) $sw.Elapsed.TotalMilliseconds }
}

function Test-Endpoint {
  param([string]$Name, [string]$Url, [int[]]$OkCodes = @(200), [double]$BudgetMs = 1000)
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  try {
    $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 15
    $sw.Stop()
    $ms = $sw.Elapsed.TotalMilliseconds
    if (($OkCodes -contains $r.StatusCode) -and ($ms -le $BudgetMs)) {
      Add-Result $Name 'PASS' ("{0} in {1}ms" -f $r.StatusCode, [math]::Round($ms, 1)) $ms
    } elseif ($OkCodes -contains $r.StatusCode) {
      Add-Result $Name 'FAIL' ("{0} but {1}ms over budget {2}ms" -f $r.StatusCode, [math]::Round($ms, 1), $BudgetMs) $ms
    } else {
      Add-Result $Name 'FAIL' ("HTTP {0}" -f $r.StatusCode) $ms
    }
    return $r.Content
  } catch {
    $sw.Stop()
    $msg = $_.Exception.Message
    $m = [regex]::Match($msg, '\((\d{3})\)')
    if ($m.Success) {
      $code = [int]$m.Groups[1].Value
      if ($OkCodes -contains $code) { Add-Result $Name 'PASS' ("HTTP {0} (accepted)" -f $code) $sw.Elapsed.TotalMilliseconds; return '' }
      Add-Result $Name 'FAIL' ("HTTP {0}" -f $code) $sw.Elapsed.TotalMilliseconds; return $null
    }
    if ($RequireLive) { Add-Result $Name 'FAIL' $msg $sw.Elapsed.TotalMilliseconds }
    else { Add-Result $Name 'SKIP' "unreachable: $msg" $sw.Elapsed.TotalMilliseconds }
    return $null
  }
}
function Invoke-Bench {
  param([string]$Name, [string]$File, [double]$P95Budget)
  Write-Host ""
  Write-Host "== $Name ==" -ForegroundColor Cyan
  if (-not (Test-Path $File)) { Add-Result $Name 'SKIP' "missing $File"; return }
  if ((-not $script:serverUp) -and ($Name -like 'bench:api*')) {
    if ($RequireLive) { Add-Result $Name 'FAIL' 'server down' }
    else { Add-Result $Name 'SKIP' 'server down - start with npm run dev' }
    return
  }
  $env:BENCHMARK_REQUESTS = "$Requests"
  $env:API_URL = $BaseUrl
  # Benchmarks need live infra: redis bench needs REDIS_URL, db bench needs
  # DATABASE_URL. Inherit from .env when the caller did not export them, so
  # `npm run bench` works out of the box in dev.
  if ([string]::IsNullOrWhiteSpace($env:REDIS_URL)) { $env:REDIS_URL = 'redis://127.0.0.1:6379' }
  if ([string]::IsNullOrWhiteSpace($env:DATABASE_URL)) { $env:DATABASE_URL = 'postgresql://hostelghar:hostelghar_dev_pass@127.0.0.1:5432/hostelghar_dev' }
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  # NOTE: node writes errors to stderr -> PowerShell wraps those lines as
  # ErrorRecord/RemoteException. Stringify first so matching sees real text.
  $raw = & node $File 2>&1 | ForEach-Object {
    if ($_ -is [System.Management.Automation.ErrorRecord]) { $_.Exception.Message }
    else { "$_" }
  }
  $ec = $LASTEXITCODE
  $sw.Stop()
  if ($ec -ne 0) {
    $full = ($raw -join "`n")
    $firstErr = ($raw | Where-Object { $_ -match 'Error:\s|SASL|ECONNREFUSED|ENOTFOUND|ClientClosedError|getaddrinfo|writeable|password must be' } | Select-Object -First 1)
    if ([string]::IsNullOrWhiteSpace($firstErr)) { $firstErr = ($raw | Select-Object -Last 3) -join ' | ' }
    $firstErr = "$firstErr".Trim()
    if ($firstErr.Length -gt 220) { $firstErr = $firstErr.Substring(0, 220) + '...' }
    if ($full -match 'ECONNREFUSED|ENOTFOUND|ClientClosedError|getaddrinfo|writeable|password must be|password authentication failed|SASL|Redis|timeout|TIMEDOUT') {
      if ($RequireLive) { Add-Result $Name 'FAIL' "dependency down: $firstErr" }
      else { Add-Result $Name 'SKIP' "dependency down: $firstErr" }
    } else { Add-Result $Name 'FAIL' $firstErr }
    return
  }
  try {
    $json = ($raw | Where-Object { $_ -match '^\s*\{' }) -join "`n" | ConvertFrom-Json
    $p50 = [math]::Round([double]$json.p50_ms, 1)
    $p95 = [math]::Round([double]$json.p95_ms, 1)
    $p99 = [math]::Round([double]$json.p99_ms, 1)
    $detail = "p50={0}ms p95={1}ms p99={2}ms (n={3})" -f $p50, $p95, $p99, $Requests
    if ([double]$json.p95_ms -le $P95Budget) { Add-Result $Name 'PASS' "$detail | budget p95<=$P95Budget ms" $sw.Elapsed.TotalMilliseconds }
    else { Add-Result $Name 'FAIL' "$detail | budget p95<=$P95Budget ms EXCEEDED" $sw.Elapsed.TotalMilliseconds }
  } catch { Add-Result $Name 'FAIL' (($raw | Select-Object -Last 3) -join ' | ') }
}

Write-Host ""
Write-Host "HostelGhar check-all | $BaseUrl" -ForegroundColor White

if (-not $SkipStatic) {
  Invoke-NpmStep 'lint' 'npm run lint'
  Invoke-NpmStep 'typecheck' 'npm run typecheck'
  if ($IncludeFormat) { Invoke-NpmStep 'format:check' 'npm run format:check' }
  Invoke-NpmStep 'tests' 'npm test -- --run'
  Invoke-NpmStep 'build' 'npm run build'
} else {
  Write-Host ""
  Write-Host "== static skipped ==" -ForegroundColor Yellow
}

$script:serverUp = $false
if (-not $SkipLive) {
  Write-Host ""
  Write-Host "== live endpoints ==" -ForegroundColor Cyan
  $health = Test-Endpoint 'GET /health' "$BaseUrl/health" @(200) $LiveBudgetMs
  if ($null -ne $health) { $script:serverUp = $true }
  [void](Test-Endpoint 'GET /health/live' "$BaseUrl/health/live" @(200) $LiveBudgetMs)
  $readyBody = Test-Endpoint 'GET /health/ready' "$BaseUrl/health/ready" @(200, 503) $LiveBudgetMs
  if ($readyBody) {
    try {
      $ready = $readyBody | ConvertFrom-Json
      Write-Host ("      deps: postgres={0} redis={1}" -f $ready.dependencies.postgres, $ready.dependencies.redis) -ForegroundColor Gray
    } catch { }
  }
  [void](Test-Endpoint 'GET /metrics' "$BaseUrl/metrics" @(200) $LiveBudgetMs)
  Invoke-Bench 'bench:api/health' 'performance/benchmarks/api/health.benchmark.mjs' $ApiP95BudgetMs
  Invoke-Bench 'bench:redis/ping' 'performance/benchmarks/cache/redis-ping.benchmark.mjs' $RedisP95BudgetMs
  Invoke-Bench 'bench:db/select-1' 'performance/benchmarks/database/select-one.benchmark.mjs' $DbP95BudgetMs
} else {
  Write-Host ""
  Write-Host "== live + benchmarks skipped ==" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "================ SUMMARY ================" -ForegroundColor White
$script:results | Format-Table -AutoSize Status, Check, @{ Label = 'Time(ms)'; Expression = { $_.Ms } }, Detail | Out-String | Write-Host
$pass = @($script:results | Where-Object { $_.Status -eq 'PASS' }).Count
$fail = @($script:results | Where-Object { $_.Status -eq 'FAIL' }).Count
$skip = @($script:results | Where-Object { $_.Status -eq 'SKIP' }).Count
$summaryColor = 'Green'
if ($fail -gt 0) { $summaryColor = 'Red' } elseif ($skip -gt 0) { $summaryColor = 'Yellow' }
Write-Host ("Result: {0} PASS / {1} FAIL / {2} SKIP" -f $pass, $fail, $skip) -ForegroundColor $summaryColor

$reportDir = Join-Path $RepoRoot 'performance/reports'
New-Item -ItemType Directory -Force -Path $reportDir | Out-Null
$reportFile = Join-Path $reportDir ("check-all-{0}.json" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
[pscustomobject]@{
  timestamp = (Get-Date).ToUniversalTime().ToString('o')
  baseUrl   = $BaseUrl
  requests  = $Requests
  budgets   = @{ apiP95Ms = $ApiP95BudgetMs; dbP95Ms = $DbP95BudgetMs; redisP95Ms = $RedisP95BudgetMs; liveMs = $LiveBudgetMs }
  results   = $script:results
  totals    = @{ pass = $pass; fail = $fail; skip = $skip }
} | ConvertTo-Json -Depth 6 | Set-Content -Path $reportFile -Encoding utf8
Write-Host "Report: $reportFile" -ForegroundColor Gray

if ($fail -gt 0) { exit 1 } else { exit 0 }

