# Jornal P43 — Final Requirements Acceptance Matrix

Status meanings:
- **DONE** — implemented in source and represented by UI/API where required.
- **PARTIAL** — implementation exists but an explicit requirement remains incomplete or needs staging verification.
- **STAGING** — code/configuration is present, but real external/runtime verification is required.

| # | Requirement | P43 status | Remaining action |
|---|---|---|---|
| 1 | Users and 4 roles | DONE | Verify negative ownership cases in CI/staging |
| 2 | Schedule | PARTIAL | Weekly calendar/lesson-period directory is not a dedicated subsystem |
| 3 | Teacher current lesson | DONE | Chat/board/Code Lab remain linked pages rather than embedded widgets |
| 4 | Homework lifecycle | DONE | Run full browser flow on staging |
| 6 | Materials / TipTap | PARTIAL | Image upload is URL-based rather than a dedicated upload pipeline |
| 7 | Files | DONE | Run full ACL/path traversal tests on staging |
| 8 | Code Lab / Judge0 | STAGING | Requires live Judge0 |
| 9 | Realtime collaboration | STAGING | Requires two real clients + reconnect |
| 10 | LiveKit lessons | STAGING | Requires live LiveKit credentials and two clients |
| 11 | SignalR chat | STAGING | Requires two real clients/reconnect |
| 12 | Attendance | DONE | Staging smoke |
| 13 | Grades | DONE | Staging smoke |
| 14 | Security | PARTIAL | Legacy session-token migration remains; production penetration/IDOR run required |
| 15 | Backup/restore | PARTIAL | Code supports DB/files/collab/key ring; destructive restore must be exercised on staging |
| 16 | Admin Dashboard | DONE | Staging UI smoke |
| 17 | UI/UX | PARTIAL | Final mobile/tablet visual QA remains |
| 18 | Testing | PARTIAL | Unit/regression/E2E harness exists; .NET/Docker and full browser execution depend on CI/staging |
| 19 | Docker / production | STAGING | Must run full compose + HTTPS deployment on a real host |
| 20 | CI/CD | DONE | CI pipeline includes backend/frontend/Docker/E2E stages |
| 21 | Documentation | DONE | Final docs set exists |
| 22 | Real implementation, not mock UI | DONE | Main P1-P27 modules are wired through API/backend/storage/external services |
| 23 | Versioning | DONE | P18-P43 changelogs and release artifacts maintained |
| 24 | Final deployable portal | PARTIAL | P43 is release candidate; production acceptance requires staging execution above |

## Final acceptance gate

A production release should be marked **RELEASED** only after the following are green on a real staging host:

1. `dotnet test`
2. `dotnet build --configuration Release`
3. `npm ci && npm run lint && npm test && npm run build`
4. Docker Compose health checks
5. Playwright business workflow
6. SignalR two-client test
7. Hocuspocus/Yjs two-client + reconnect test
8. LiveKit teacher/student test
9. Judge0 compile/runtime/timeout/memory test
10. Backup → destructive test instance change → restore → restart → data verification
11. Mobile/tablet visual smoke
12. Security/IDOR regression suite

This matrix intentionally does **not** claim those environment-dependent checks have passed merely because the corresponding harnesses exist.
