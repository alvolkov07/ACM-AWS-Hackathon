# Docker scripts (local MongoDB)

These helpers start and stop the local MongoDB container defined in the repo-root [`docker-compose.yml`](../docker-compose.yml). The database runs as a **single-node replica set** (same idea as DocumentDB later) on port **27017**.

You need [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and **running** before any of these commands.

From the **repository root** you can also use `make up` / `make down` if you have Make. The scripts below work without Make.

---

## macOS

### 1. Install and open Docker

1. Install Docker Desktop for Mac from the official site.
2. Open **Docker Desktop** from Applications and wait until it says Docker is running.
3. Confirm in Terminal:

```bash
docker version
docker compose version
```

### 2. Start MongoDB

```bash
cd /path/to/Eagle
chmod +x scripts/macos/*.sh
./scripts/macos/up.sh
```

This runs `docker compose up -d --wait` and blocks until the container is **healthy**.

### 3. Stop MongoDB

```bash
./scripts/macos/down.sh
```

### 4. Optional: open a Mongo shell

```bash
docker compose exec mongo mongosh
```

Then try:

```javascript
use agri_supply
db.companies.countDocuments()
```

(Seed data first with `make seed` or `npm --prefix web run seed` after copying `.env.example`.)

---

## Windows

Use **PowerShell** (or Windows Terminal). Git Bash also works if you prefer Unix-style commands and call the `.sh` scripts via Git Bash.

### 1. Install and open Docker

1. Install Docker Desktop for Windows from the official site.
2. Start **Docker Desktop** and wait until the engine is running (whale icon steady in the system tray).
3. Confirm in PowerShell:

```powershell
docker version
docker compose version
```

If `docker` is not found, restart the terminal after installing Docker Desktop, and ensure “Use the WSL 2 based engine” is enabled in Docker settings when prompted.

### 2. Start MongoDB

```powershell
cd C:\path\to\Eagle
.\scripts\windows\up.ps1
```

If PowerShell blocks the script, run once:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

Or start without a script:

```powershell
docker compose up -d --wait
```

### 3. Stop MongoDB

```powershell
.\scripts\windows\down.ps1
```

### 4. Optional: open a Mongo shell

```powershell
docker compose exec mongo mongosh
```

---

## Common checks

| Check | Command |
| --- | --- |
| Is the container up? | `docker compose ps` |
| Container logs | `docker compose logs -f mongo` |
| Remove container **and** delete DB volume | `docker compose down -v` (wipes local data) |

Default connection string (also in `.env.example`):

```text
mongodb://localhost:27017/?replicaSet=rs0
```

Database name example: `agri_supply`.
