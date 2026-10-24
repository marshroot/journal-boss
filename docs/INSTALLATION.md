# Installation

## Requirements

- .NET 9 SDK for the current Docker/CI target.
- Node.js 22 and npm.
- Docker + Docker Compose for the full stack.
- Optional: Judge0 and LiveKit credentials.

## Windows: quick local start

1. Install **Node.js 22 LTS** and **.NET SDK 9.x**.
2. Extract the archive into a folder whose path does not require administrator permissions.
3. Double-click `run.bat`. On first launch it creates `.env` from `.env.example`, installs frontend packages with `npm ci`, starts the backend and frontend in separate console windows, and opens `http://localhost:3000`.
4. The local initial administrator login is `admin`; the default local-only password is `ChangeThisLocalPassword123!`. Change it immediately after first login. If the database already contains users, the seed credentials are not recreated.
5. If the backend health check fails, read the **Jornal Backend** console first. Keep both service windows open while testing.

`run.bat` is for local development only. It uses a development JWT key and does not start a Telegram bot. Never expose this configuration to a public network or use it for production.

## Local backend

From `backend/JournalBackend`:

```powershell
$env:Jwt__Key="replace-with-at-least-32-random-characters"
$env:Admin__InitialLogin="admin"
$env:Admin__InitialPassword="change-this-password"
dotnet run
```

The default local backend URL is `http://localhost:5000` when `ASPNETCORE_URLS` is not supplied.

## Local frontend

```bash
cd frontend
npm ci
npm run lint
npm run build
npm run dev
```

## Docker

Create `.env` from `.env.example`, set at least `JWT_KEY`, `ADMIN_LOGIN`, `ADMIN_PASSWORD`, then:

```bash
docker compose config --quiet
docker compose build
docker compose up -d
```

The local compatibility frontend remains available on port 3000. The current requested setup is localhost-only. Do not configure Caddy, DNS, or public ports for this release.

## Current Docker local setup (P50)

1. Copy `.env.example` to `.env`.
2. Set a unique `JWT_KEY` (at least 32 characters), `ADMIN_LOGIN`, and a strong `ADMIN_PASSWORD`.
3. Run `docker compose config --quiet`.
4. Run `docker compose up -d --build`.
5. Open `http://localhost:3000`.
6. Use `docker compose ps` and `docker compose logs --tail=100` to diagnose startup.

The default compose stack does not start Caddy or require a public domain. The Telegram bot is optional: configure `TELEGRAM_BOT_TOKEN`, then run `docker compose --profile telegram up -d --build`.
