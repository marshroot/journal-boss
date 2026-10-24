# Deployment and local runtime

## Current default: local-only P50

The active Compose configuration is intentionally local-only. It does not start Caddy or require DNS/HTTPS.

```text
Browser -> http://localhost:3000 -> frontend nginx -> ASP.NET backend
                                             -> Hocuspocus collaboration service
```

### Required environment

- `JWT_KEY` — random secret, at least 32 characters.
- `ADMIN_LOGIN`, `ADMIN_PASSWORD` — initial admin bootstrap values.
- `CORS_ORIGIN` — defaults to `http://localhost:3000`.
- `JUDGE0_URL` — optional Judge0 endpoint for Code Lab.
- `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` — optional LiveKit integration.

Never commit `.env`. The release archive contains `.env.example`, not the real environment file.

### Start and verify

```powershell
Copy-Item .env.example .env
# Edit .env and set JWT_KEY, ADMIN_LOGIN and ADMIN_PASSWORD
docker compose config --quiet
docker compose up -d --build
docker compose ps
docker compose logs --tail=100
```

Open `http://localhost:3000`. The frontend binds to loopback only. Stop containers with `docker compose down`; named volumes retain database and uploaded data. Do not add `-v` unless you intentionally want to remove persistent volumes.

### Optional Telegram bot

Set `TELEGRAM_BOT_TOKEN` in `.env` and start it with:

```powershell
docker compose --profile telegram up -d --build
```

### External services

Judge0 and LiveKit require their own service credentials/configuration. The presence of a setting does not itself prove the external service is reachable; verify the service and check application logs.

## Historical public-domain deployment

Earlier P44–P47 releases used Caddy and the public domain `journalmod.dpdns.org`. That configuration is not part of the current default Compose stack because the project has been returned to localhost as requested. Historical scripts and matrices remain for traceability and should not be used as current release checks.
