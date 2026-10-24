# Jornal P40 — Final Release Audit

P40 is the final release-candidate audit, not a claim that every external integration has been exercised on a live production account.

## Status matrix

| Area | Status | Evidence |
|---|---|---|
| Roles/authentication | PASS | JWT + role authorization + backend security tests |
| Ownership/IDOR | PASS | Security/authorization regression tests and canonical controllers |
| Schedule | PASS* | Admin academic API + teacher current lesson; weekly calendar remains list-based |
| Current lesson | PASS* | Teacher current lesson API/UI; chat/board/code lab are dedicated routes |
| Homework lifecycle | PASS | AssessmentController + business E2E harness |
| Materials/TipTap | PASS* | Material API/UI + attachments |
| Files/ACL | PASS | Authorized attachment endpoints + audit |
| Code Lab | PASS* | Queue + Judge0 client + resource contracts; live Judge0 required for runtime E2E |
| Collaboration | PASS* | Yjs/Hocuspocus contracts + two-client harness; live browser E2E requires running service |
| LiveKit | PASS* | Token/permission contracts; live media E2E requires credentials |
| Chat | PASS* | SignalR hub + reconnect harness; two-browser run requires live environment |
| Attendance | PASS | Canonical assessment/current lesson APIs |
| Grades | PASS | Ownership checks + final-grade workflow |
| Security | PASS* | JWT, hashing, rate limiting, CORS, HSTS, file/path checks; legacy session-token APIs remain isolated |
| Backup/restore | PASS* | DB + attachments + collaboration backup, integrity validation, restore smoke harness |
| Admin dashboard | PASS | `/admin` dashboard plus users/academic/operations |
| UI/UX | PASS* | Responsive UI and error/loading states; final manual device QA remains environment-dependent |
| Automated tests | PASS* | backend xUnit, frontend regression tests, Playwright harness, integration contracts |
| Docker/production | PASS* | compose, Caddy, health checks, production smoke scripts |
| CI/CD | PASS | GitHub Actions restore/build/test/frontend/Docker/E2E stages |
| Documentation | PASS | Required docs and diagrams present |
| Versioning | PASS | P40 + changelog |

`*` means the implementation and deterministic contract checks exist, while a real external-service/browser run still requires a staging environment with the corresponding credentials/services.

## Important release corrections in P40

1. Removed `RequireRateLimiting("api")` from `MapControllers()`. The application already uses a global limiter; the named policy did not exist and could prevent startup.
2. Changed frontend Docker host publishing from `3000:80` to `127.0.0.1:3000:80`. Public production traffic is expected to enter through Caddy on ports 80/443.
3. Removed the empty `CodeLabController.cs.tmp` artifact.
4. Backup manifest version is now read from `VERSION.txt` instead of a stale hard-coded release number.

## Known limitations before declaring a production deployment

- Run the full compose stack on a real Docker host.
- Run Playwright Chromium E2E against the deployed stack.
- Run two-client SignalR and Hocuspocus browser scenarios.
- Configure and exercise real Judge0 and LiveKit services.
- Run a destructive backup/restore test on a disposable staging database.
- Perform final manual desktop/tablet/mobile QA.
- Review and migrate legacy `sessionToken` controllers before removing them; they are intentionally retained for compatibility in P40.
