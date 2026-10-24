# Jornal P49 — Requirements audit

Status definitions: **Implemented in source** means code/API/UI is present; it does not mean the full live scenario has been executed. **Partial** means at least one explicit requirement remains incomplete. **Not verified** means the runtime requires an environment unavailable in this audit.

| # | Area | Current status | Remaining work / acceptance evidence |
|---|---|---|---|
| 1 | Users and roles | Partial | Admin/teacher/student/parent exist. Curator is intentionally the same canonical `Parent` role, with no extra permissions. Verify admin CRUD and linked-child isolation through real API tests. |
| 2 | Schedule | Partial | Schedule APIs and current lesson exist; a complete weekly schedule/lesson-period administration workflow needs browser acceptance. |
| 3 | Teacher current lesson | Implemented in source; not fully verified | Current lesson page exists. Verify all required actions (attendance, grades, homework, material, online lesson, chat, board, Code Lab) against real backend. |
| 4 | Homework lifecycle | Implemented in source; not fully verified | Local homework/submissions and teacher review exist. Run complete teacher→student→teacher scenario. |
| 6 | Study materials / TipTap | Partial | Materials API/editor exists. Confirm image upload pipeline, publish/edit permissions and attachment download in browser. |
| 7 | Files | Implemented in source; not fully verified | Attachment endpoints and access checks exist. Run adversarial IDOR, path traversal, MIME/size and ownership tests. |
| 8 | Code Lab / Judge0 | Configurable; not verified | Judge0 integration exists. Run compile error, runtime error, timeout, memory and resource-limit tests against a configured Judge0. |
| 9 | Realtime collaboration | Partial / not verified | Hocuspocus/Yjs exists. Verify multi-client cursors/presence, reconnect and state persistence; confirm all required Excalidraw board paths. |
| 10 | Online lessons / LiveKit | Configurable; not verified | Token/room code exists. Run teacher+student camera, microphone, reconnect and end-session scenario with real credentials. |
| 11 | SignalR chat | Implemented in source; not fully verified | Run two-client history, authorization, timestamps, reconnect and anti-spam tests. |
| 12 | Attendance | Implemented in source; not fully verified | Verify teacher changes and student/parent read-only views with real data. |
| 13 | Grades | Implemented in source; not fully verified | Ownership tests exist. Run API IDOR checks and role-specific UI acceptance. |
| 14 | Security | Partial | Security tests exist, but legacy auth surface remains and full penetration/IDOR review is not complete. Review all user-controlled IDs and secrets. |
| 15 | Backup/restore | Partial | Backup/restore code and smoke script exist. Run restore into a disposable environment and verify DB, files, collaboration data and keys. |
| 16 | Admin dashboard | Implemented in source; not fully verified | User and academic admin pages exist. Verify all CRUD, schedule, audit and backup actions. |
| 17 | UI/UX | Partial | Main role pages exist. Desktop/tablet/mobile visual QA, loading/error/empty states and destructive confirmations remain. |
| 18 | Testing | Partial | Frontend source tests pass 3/3; backend tests and E2E harness exist. .NET, frontend build and E2E need execution in CI or a complete toolchain. |
| 19 | Docker / production | Local configuration prepared; build not verified here | Compose is local-only by request. Run `docker compose config`, build, health checks and runtime smoke on Docker Desktop. Public HTTPS is intentionally not the current target. |
| 20 | CI/CD | Implemented in source; not verified in this environment | GitHub Actions includes backend, frontend, Docker and E2E stages. Confirm latest pipeline is green after changes. |
| 21 | Documentation | Partial | Required docs and diagrams exist; update gaps and ensure instructions match the current localhost deployment. |
| 22 | Real integration (not mock UI) | Partial | Many features are API-backed; every named external-service and end-to-end flow still needs evidence. |
| 23 | Versioning | Implemented | VERSION and changelogs updated for P48/P49. Release archive remains withheld until acceptance gate passes. |
| 24 | Final deployable portal | Not accepted yet | Do not mark complete until build/test, E2E, external integrations, backup restore and security acceptance gates pass. |

## P49 changes verified statically

- Localhost-only default compose configuration and CORS.
- Optional Telegram profile.
- SQLite migration for `announcements.is_published`, preserving existing rows.
- Parent/curator permission equivalence documented.
- Real `.env` excluded from the release source.
- Frontend source tests: 3/3 pass.
- SQLite migration simulation: pass.

## Blocking acceptance gates

1. `dotnet restore`, `dotnet build -c Release`, `dotnet test`.
2. `npm ci --ignore-scripts`, `npm run lint`, `npm test`, `npm run build`.
3. `docker compose config --quiet`, `docker compose up -d --build`, health and backend logs.
4. Playwright role and homework flow.
5. Real LiveKit and Judge0 tests.
6. Two-client SignalR/Yjs/reconnect tests.
7. Backup → restore → restart → data verification on a disposable test instance.
8. Security/IDOR/file access regression run.
9. Desktop/tablet/mobile UI smoke.

This matrix deliberately does not treat source presence as proof that a feature is production-ready.
