# Start local MongoDB (replica set) and wait until healthy.
$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $Root

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Write-Error "Docker was not found. Install Docker Desktop for Windows and open it first."
}

try {
  docker info | Out-Null
} catch {
  Write-Error "Docker is installed but not running. Open Docker Desktop and try again."
}

Write-Host "Starting MongoDB via docker compose..."
docker compose up -d --wait
Write-Host "MongoDB is up (healthy). URI: mongodb://localhost:27017/?replicaSet=rs0"
