$ErrorActionPreference = 'Stop'
$toolDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $toolDir
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host 'Node.js is required. Install Node.js 20 or newer, then run this again.' -ForegroundColor Yellow
  Read-Host 'Press Enter to close'
  exit 1
}
node server.mjs
Read-Host 'CoachKtool stopped. Press Enter to close'
