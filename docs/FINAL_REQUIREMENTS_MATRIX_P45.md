# Jornal P45 — Final Requirements Matrix

This release continues P44 and adds the production Docker wiring needed for the Telegram registration bot and legacy MyStat configuration.

| Area | P45 status | Notes |
|---|---|---|
| Domain `journalmod.dpdns.org` | DONE | Caddy + CORS + same-origin collaboration defaults |
| Backend container | DONE | Production ASP.NET container |
| Frontend container | DONE | Loopback-only host debug port |
| Caddy HTTPS | READY | Requires public DNS + TCP 80/443 on deployment host |
| SignalR | READY | Same-origin `/hubs` through proxy |
| Hocuspocus/Yjs | READY | Same-origin `/collab/` through frontend proxy |
| Telegram bot | DONE | Dedicated Compose service; internal backend URL |
| MyStat `APPLICATION_KEY` | DONE | Passed into backend container |
| MyStat rate limit | DONE | Passed into backend container |
| Judge0 | CONFIGURABLE | Default targets `host.docker.internal:2358`; override if Judge0 is remote/containerized |
| LiveKit | CONFIGURABLE | Credentials supplied through `.env` |
| Admin bootstrap | DONE | `ADMIN_LOGIN` / `ADMIN_PASSWORD` passed to backend |
| Data Protection keys | DONE | Persistent `/data/keys` volume |
| Backup/restore | READY | Runtime validation still requires Docker/staging |
| Real browser E2E | STAGING | Requires a running deployment and real credentials |

## Deployment-only checks

The repository cannot truthfully mark the following as runtime-passed until Docker Desktop/staging is available:

- `docker compose up -d --build`
- real HTTPS certificate issuance
- Telegram polling against Bot API
- LiveKit camera/microphone/reconnect
- Judge0 execution limits
- two-client SignalR/Yjs browser synchronization
- destructive backup → restore validation
