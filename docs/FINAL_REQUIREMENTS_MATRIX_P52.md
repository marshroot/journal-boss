# Jornal P52 — Requirements audit

This matrix distinguishes source presence from verified runtime behavior. A feature is not considered complete merely because a page or endpoint exists.

| # | Requirement | Status | Remaining acceptance work |
|---|---|---|---|
| 1 | Roles/users | Partial | Admin CRUD and real role-flow tests remain. Curator is exactly the Parent role; only linked-child read access is permitted. |
| 2 | Schedule | Partial | Browser acceptance of weekly schedule, lesson periods, teacher/subject/group assignment and conflict handling. |
| 3 | Teacher current lesson | Source present, runtime unverified | Verify attendance, grades, homework, materials, live lesson, chat, board and Code Lab against backend. |
| 4 | Homework lifecycle | Source present, runtime unverified | Execute teacher-create → student-submit → teacher-review with persisted records. |
| 6 | Materials/TipTap | Partial | Verify editing/publishing and safe attachment upload/download in browser. |
| 7 | Files | Source present, security unverified | Run file size/type/path traversal and cross-user IDOR tests against running API. |
| 8 | Code Lab/Judge0 | Configurable, unverified | Test compile/runtime failures, timeout, memory and network restrictions against configured Judge0. |
| 9 | Realtime collaboration | Partial | Multi-client presence/cursor/reconnect/persistence tests; confirm board collaboration path. |
| 10 | Online lessons/LiveKit | Configurable, unverified | Real teacher/student room, mic/camera, reconnect and end-session test. |
| 11 | Chat/SignalR | Source present, runtime unverified | Two-client history, timestamps, permissions, reconnect and spam tests. |
| 12 | Attendance | Source present, runtime unverified | Teacher write and student/parent read-only acceptance. |
| 13 | Grades | Source present, runtime unverified | Role-specific views and changed-ID IDOR regression run. |
| 14 | Security | **Blocking** | Legacy controllers still use `sessionToken` query/body authentication and are excluded from canonical JWT authorization reflection tests. P53 inventories 109 frontend `sessionToken` matches across 11 files; server/client migration and endpoint authorization tests remain blocking. Migrate or explicitly isolate/deprecate without breaking needed legacy integrations, then add endpoint-level auth tests. |
| 15 | Backup/restore | Source + static contract improved; runtime partial | Backup/restore smoke now exercises both POST endpoints and requires explicit disposable-instance confirmation. Still run it in an isolated environment and verify DB/files/collaboration state/keyring and restart. |
| 16 | Admin dashboard | Source present, runtime unverified | Verify all CRUD, schedule, audit and backup actions through UI. |
| 18 | Tests | Partial | Node/static audit tests pass 8/8; .NET, production frontend build, browser E2E need execution. |
| 19 | Docker/local | Config prepared, runtime unverified | `docker compose config --quiet`, build, health checks and runtime smoke on Docker Desktop. Default target is localhost, not public domain. |
| 20 | CI/CD | Source present, pipeline unverified | Confirm GitHub Actions green after current changes. |
| 21 | Documentation | Partial | Required docs exist; fill any feature-specific gaps after runtime acceptance. |
| 23 | Versioning | Implemented | Version and changelog updated to P52. |
| 24 | Final deployable portal | Not accepted | Do not release as complete until all blocking acceptance gates are satisfied. |

## P52 static checks

- Default Compose binds the frontend only to `127.0.0.1:3000`.
- Default Compose does not start a public Caddy proxy.
- CORS template defaults to `http://localhost:3000`.
- The dedicated Telegram registration bot and its Compose profile were removed in P52; unrelated backend notification integrations remain separate.
- Parent and curator are the same canonical `Parent` role.
- Legacy P45/P46 checks now validate the current local contract rather than old domain values.

## Blocking gates

1. Review/migrate legacy session-token endpoints and add authorization tests for every action. `scripts/legacy-session-token-audit.mjs` inventories server actions and `scripts/legacy-session-token-client-audit.mjs` inventories frontend references; both are detection only and do not resolve the authorization blocker.
2. Run .NET restore/build/test.
3. Run `npm ci`, lint, test and production build.
4. Run Compose build/health smoke in Docker Desktop/CI.
5. Run Playwright role and homework lifecycle scenarios.
6. Run real Judge0 and LiveKit acceptance tests.
7. Run two-client SignalR/Yjs/reconnect tests.
8. Run backup/restore and data verification on a disposable instance.
9. Run adversarial IDOR/file access regression tests.
10. Perform desktop/tablet/mobile UI acceptance.
