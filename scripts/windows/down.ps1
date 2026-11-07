# Stop local Docker Compose services (MongoDB).
$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $Root

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Write-Error "Docker was not found. Install Docker Desktop for Windows and open it first."
}

Write-Host "Stopping Docker Compose services..."
docker compose down
Write-Host "Stopped."
