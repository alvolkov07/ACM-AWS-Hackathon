#!/usr/bin/env bash
# Stop local Docker Compose services (MongoDB).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker was not found. Install Docker Desktop for Mac and open it first."
  exit 1
fi

echo "Stopping Docker Compose services..."
docker compose down
echo "Stopped."
