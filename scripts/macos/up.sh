#!/usr/bin/env bash
# Start local MongoDB (replica set) and wait until healthy.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker was not found. Install Docker Desktop for Mac and open it first."
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker is installed but not running. Open Docker Desktop and try again."
  exit 1
fi

echo "Starting MongoDB via docker compose..."
docker compose up -d --wait
echo "MongoDB is up (healthy). URI: mongodb://localhost:27017/?replicaSet=rs0"
