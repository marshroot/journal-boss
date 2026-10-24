# Final development progress

## v14 — Student online lesson + Parent attendance

### Implemented
- Student endpoint for detecting the current lesson by study group.
- Student access to an active LiveKit room only when the lesson is running.
- Server-side LiveKit token authorization for the student.
- Student page `/online-lesson` with automatic polling and join button.
- Parent endpoint for linked children.
- Parent endpoint for attendance of a selected linked child.
- Parent attendance UI with read-only status.
- Role-specific navigation entries.

### Not claimed as verified
- Frontend TypeScript build was not completed in this environment because dependency installation timed out.
- .NET build was not available because the dotnet SDK is not installed in this environment.

### Next development blocks
1. Parent consolidated dashboard (grades + homework + attendance + children).
3. File attachments for homework/materials with secure storage.
4. Production-grade LiveKit deployment configuration.
5. Audit log and security hardening.
6. Automated tests and CI/CD.

## v23 — Files for homework and materials

### Implemented
- Direct attachments for `StudyMaterial`.
- Direct attachments for `LocalHomework`.
- Secure authenticated download endpoints.
- Teacher/admin upload and delete permissions.
- Student/parent read access follows material publication and child/group membership.
- 25 MB limit and extension/content-type allowlist.
- Audit events for upload/delete/download.
- Frontend upload/download/delete for materials and teacher homework management.
- Student/parent homework page shows downloadable homework files.

### Verification status
- Source changes completed.
- Frontend build could not be completed in the working environment because `npm ci` timed out and `node_modules` was not available.
- .NET build is still not available in the working environment because the .NET SDK is unavailable.
- Manual Docker verification remains required.

## v23 — LiveKit/realtime preparation

### Implemented
- Configurable LiveKit token TTL via `LIVEKIT_TOKEN_TTL_SECONDS`.
- Safe TTL bounds (5 minutes–24 hours), default 2 hours.
- Docker/.env propagation for the TTL setting.
- Added `scripts/smoke-test.ps1` for health, JWT login, `/api/auth/me`, materials API and SignalR negotiate checks.

### Not yet claimed as verified
- A real external/self-hosted LiveKit server has not been exercised from this archive.
- Multi-browser SignalR/LiveKit manual test is still required.


### P9 — Yjs / Hocuspocus

- [x] Hocuspocus self-hosted сервис
- [x] SQLite persistence отдельным volume
- [x] короткоживущий collaboration JWT
- [x] проверка доступа к конкретному CodeExercise
- [x] Yjs document для кода
- [x] синхронизация Monaco ↔ Y.Text
- [x] Docker Compose integration
- [ ] многопользовательские cursors/awareness
- [ ] совместная Excalidraw-доска


## P10 — collaborative Excalidraw board

- [x] Board collaboration JWT endpoint with lesson/group authorization
- [x] Excalidraw state synchronized through Yjs/Hocuspocus
- [x] SQLite persistence via `collab_data`
- [x] Awareness names/participant list
- [x] nginx `/collab` WebSocket proxy for Docker
- [x] Vite `/collab` WebSocket proxy for local development
- [ ] End-to-end multi-browser verification on a running Docker stack


## P12 — финальная интеграционная подготовка

- [x] Docker Hocuspocus больше не публикуется напрямую на host port; доступ из браузера идёт через nginx `/collab`.
- [x] Vite WebSocket proxy использует HTTP target + `ws: true`, что соответствует обычной схеме Vite proxy.
- [x] nginx `/collab` получил forwarded headers и увеличенный WebSocket timeout.
- [x] Добавлен `docs/FINAL_INTEGRATION.md` с пошаговым smoke/integration checklist.
- [ ] Фактический `dotnet build` на машине разработчика.
- [ ] Фактический `npm ci && npm run lint && npm run build`.
- [ ] Фактический `docker compose up --build`.
- [ ] Реальный LiveKit multi-user test.
- [ ] Реальный Judge0 execution test.
- [ ] Multi-browser SignalR/Yjs/Excalidraw test.
- [ ] Fabric.js editor: отдельный модуль ещё не реализован в текущем архиве.

## P13 — SQLite startup migration hardening

### Найдено и исправлено после последнего Docker-прогона

- В `Program.cs` блок проверки `subjects.TeacherId` выполнялся **после `conn.Close()`** предыдущего migration-блока.
- Из-за этого на старой/частично обновлённой базе возникала вторичная ошибка вида `ExecuteReader can only be called when the connection is open`.
- Блок теперь явно открывает SQLite connection перед `PRAGMA table_info(subjects)`.
- Это не заменяет проверку миграции на реальной v22 базе: после изменения необходимо один раз прогнать backend на копии старой БД и убедиться, что в логах отсутствуют `[DB Migration ERROR]`.

### Следующая обязательная проверка

```powershell
docker compose down
docker compose up --build -d
docker compose ps
docker compose logs backend --tail=200
```

Для существующей базы сначала сделать резервную копию volume/`journal.db`.
