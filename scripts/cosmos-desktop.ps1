# Cosmos-Pi Windows desktop bootstrap: verifies prerequisites; launches existing Pi in studio.
# This script intentionally makes no installations, service changes or secret modifications.
[CmdletBinding()]
param(
    [switch]$Launch,
    [string]$StudioRoot = (Split-Path -Parent $PSScriptRoot)
)
$ErrorActionPreference = "Stop"
$StudioRoot = (Resolve-Path $StudioRoot).Path

function Probe-File([string]$RelativePath) {
    $path = Join-Path $StudioRoot $RelativePath
    $present = Test-Path -LiteralPath $path -PathType Leaf
    Write-Host ("[{0}] {1}" -f $(if ($present) {"OK"} else {"MISSING"}), $RelativePath)
    return $present
}

Write-Host "Cosmos-Pi desktop diagnostic (read-only)"
Write-Host "Studio: $StudioRoot"
$required = @(
    "AGENTS.md",
    ".pi\APPEND_SYSTEM.md",
    "pauli-effect\AGENTS.md",
    "pauli-effect\CONTEXT.md",
    "pauli-effect\agents\cosmos-pi\CONTEXT.md",
    "pauli-effect\guardrails\HARD_BLOCKS.md",
    "pauli-effect\library\skills-icm\catalog.json"
)
$valid = $true
foreach ($relative in $required) {
    if (-not (Probe-File $relative)) { $valid = $false }
}

$pi = Get-Command pi -ErrorAction SilentlyContinue
$git = Get-Command git -ErrorAction SilentlyContinue
$bash = Get-Command bash -ErrorAction SilentlyContinue
foreach ($item in @(@("Pi CLI",$pi),@("Git",$git),@("Bash",$bash))) {
    Write-Host ("[{0}] {1}" -f $(if ($null -ne $item[1]) {"OK"} else {"MISSING"}),$item[0])
    if ($null -eq $item[1]) { $valid = $false }
}

$frameworkCompany = Join-Path (Split-Path -Parent $StudioRoot) "pauli-pi-agent\company"
$heart = Join-Path $frameworkCompany "HEART.md"
$soul = Join-Path $frameworkCompany "SOUL.md"
Write-Host ("[{0}] Pi framework HEART.md" -f $(if (Test-Path $heart) {"OK"} else {"OPTIONAL / NOT LOADED"}))
Write-Host ("[{0}] Pi framework SOUL.md" -f $(if (Test-Path $soul) {"OK"} else {"OPTIONAL / NOT LOADED"}))

if (-not $valid) {
    Write-Error "Prerequisite failure. Install Pi CLI/Git Bash and clone the studio repository before launching."
    exit 1
}
& pi --version
if ($LASTEXITCODE -ne 0) { throw "Pi version check failed" }
if ($Launch) {
    Push-Location $StudioRoot
    try { & pi } finally { Pop-Location }
} else {
    Write-Host "Ready to start Pi: .\scripts\cosmos-desktop.ps1 -Launch"
}
