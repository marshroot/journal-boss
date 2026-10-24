# Testing

## Backend regression tests

`backend/JournalBackend.Tests/SecurityTests.cs` currently covers:

- successful local login;
- wrong-password rejection;
- parent cannot read an unlinked child's attendance;
- student cannot submit homework belonging to another group;
- teacher cannot grade a foreign lesson;
- final homework grade is blocked without the completed 3-question teacher quiz;
- student cannot see an unpublished material.

CI runs:

```bash
dotnet test backend/JournalBackend.Tests/JournalBackend.Tests.csproj --configuration Release --no-restore
```

## Frontend

Current CI runs TypeScript lint and production build. Dedicated component-test infrastructure has not yet been added.

## E2E still required

The following should be automated with real service dependencies:

1. Admin/Teacher/Student/Parent login.
3. Teacher starts LiveKit → student joins.
4. Attendance update → student/parent read.
5. Material upload → student read.
6. Code Lab → Judge0 execution result.
7. SignalR two-client realtime messaging.
8. Yjs Code Lab and Excalidraw two-client collaboration + reconnect.
9. Backup → destructive change → restore.

## Current local limitation

The current development runtime does not have the .NET SDK or Docker, so backend/Docker execution cannot be truthfully marked as locally verified. The source, CI configuration and YAML structure have been checked locally.

## P33 frontend regression checks

The frontend now has a dependency-free Node.js test suite under `frontend/tests/`. It is executed by `npm test` and CI. Current checks cover:

- exact application roles (`Admin`, `Teacher`, `Student`, `Parent`);
- rejection of unknown/missing roles;
- presence of JWT `Authorization` handling;
- prevention of backend secret names from being embedded in frontend auth/API modules;
- presence of current-user role handling in role-sensitive pages.

These are regression/source-contract tests, not a replacement for browser E2E or React component tests.

## P34 browser E2E

Playwright smoke tests live in `frontend/e2e/` and use `frontend/playwright.config.mjs`.

Required for Admin E2E:

- `E2E_BASE_URL` (defaults to `http://127.0.0.1:3000`)
- `E2E_ADMIN_LOGIN`
- `E2E_ADMIN_PASSWORD`

Optional role credentials:

- `E2E_TEACHER_LOGIN` / `E2E_TEACHER_PASSWORD`
- `E2E_STUDENT_LOGIN` / `E2E_STUDENT_PASSWORD`
- `E2E_PARENT_LOGIN` / `E2E_PARENT_PASSWORD`

The role tests are skipped when optional credentials are absent. They are not treated as passed in that case.

The CI Docker job runs Chromium smoke tests against the actual compose stack after health checks succeed.

## P35 — Core business workflow E2E

`frontend/e2e/business-workflow.spec.mjs` covers the real API/UI workflow when an Admin test account is configured:

1. Admin creates group, teacher, student and parent.
2. Admin creates subject and assigns the teacher.
3. Admin links parent to student.
4. Admin creates a scheduled lesson.
5. Teacher creates homework.
6. Student sees and submits homework.
7. Teacher sees the submission.
8. Server rejects a final grade before the mandatory 3-question verification (`409`).
9. Parent sees the child's homework/submission state.
10. Browser UI routes are opened for Teacher, Student and Parent.

Environment:

```text
E2E_ADMIN_LOGIN
E2E_ADMIN_PASSWORD
E2E_TEST_PASSWORD       # optional, defaults to an isolated test password
E2E_API_BASE_URL        # optional, defaults to http://127.0.0.1:5000
E2E_BASE_URL            # optional, defaults to http://127.0.0.1:3000
```

The test creates uniquely named temporary records and cleans them up in `finally`.


## P37 realtime contract checks

`npm run integration:contracts` performs dependency-free source/config checks for the realtime boundary:

- Hocuspocus requires the dedicated `JournalCollab` audience.
- Collaboration JWTs are bound to a document via `collab_room`.
- `exp` and `nbf` are enforced by the collaboration service.
- Hocuspocus is not published directly to the host.
- Collaboration persistence uses the named `collab_data` volume.
- Backup contains `collab.sqlite` and the current release manifest.

These checks do not replace two-browser realtime tests. Those still require a running stack and real browser clients.

## P37 production restore check

Before a release is declared production-ready, run the following on a disposable environment:

1. Create an admin backup.
2. Record `manifest.txt`, SQLite integrity and the presence of `database/journal.db`, `collab/collab.sqlite` and attachments.
3. Make a destructive database/content change.
4. Restore the backup.
5. Restart backend and Hocuspocus.
6. Verify the restored academic data, attachments and collaborative documents.
7. Verify the audit log contains both `backup.create` and `backup.restore`.

## P38 production smoke

After `docker compose up -d`, run:

```bash
./scripts/compose-production-smoke.sh
```

The check deliberately executes backend/frontend/collab health checks from inside the Compose network because those services are not published directly to the host.

For backup creation on a disposable test instance:

```bash
BACKUP_SMOKE_CONFIRM=I_UNDERSTAND_THIS_IS_A_TEST_INSTANCE \
BACKUP_SMOKE_ADMIN_LOGIN=... \
BACKUP_SMOKE_ADMIN_PASSWORD=... \
BACKUP_SMOKE_ARCHIVE=/tmp/jornal-backup.zip \
node scripts/backup-restore-smoke.mjs
```

A restore must still be performed only against the disposable instance, followed by service restart and data verification. The script intentionally refuses to perform a destructive restore automatically.

## P39 realtime and external integrations

Deterministic contracts:

```bash
npm run integration:contracts --prefix frontend
npm run integration:external --prefix frontend
```

Real two-client verification is opt-in and requires a staging instance:

```bash
REALTIME_E2E=1 JORNAL_BASE_URL=https://staging.example \
E2E_LESSON_ID=123 E2E_TOKEN_A=... E2E_TOKEN_B=... \
E2E_COLLAB_TOKEN_A=... E2E_COLLAB_TOKEN_B=... \
E2E_COLLAB_ROOM=lesson-123 E2E_COLLAB_URL=wss://staging.example/collab \
npm run integration:realtime --prefix frontend
```

The test verifies SignalR delivery from client A to client B and Yjs synchronization between two Hocuspocus clients. It is intentionally not enabled in ordinary CI because it requires real authenticated staging data.
