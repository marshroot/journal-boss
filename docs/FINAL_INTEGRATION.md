# JV23 — финальный интеграционный прогон

Дата контрольного прогона: 2026-10-03.

Этот документ фиксирует не только реализованные компоненты, но и границу между **исправлено в исходниках** и **фактически проверено на машине разработчика**.

## 1. Backend build

### Требуется на машине разработчика

```powershell
cd backend\JournalBackend
dotnet restore
dotnet build
```

### Ожидаемый результат

- 0 ошибок компиляции.
- предупреждение `NU1510` по `Microsoft.Extensions.Identity.Core` можно убрать отдельным cleanup, если пакет больше не используется напрямую.
- при старой SQLite-базе не должно быть `[DB Migration ERROR]`.

В текущей среде .NET SDK отсутствует, поэтому этот пункт не считается фактически подтверждённым.

## 2. Frontend build

```powershell
cd frontend
npm ci
npm run lint
npm run build
```

`vite`/TypeScript должны собрать production bundle без ошибок. В текущей среде `npm ci` не завершился из-за ограничения времени сетевой установки, поэтому build не считается подтверждённым.

## 3. Docker

Перед запуском создать `.env` из `.env.example` и обязательно задать минимум:

```text
JWT_KEY=<случайная строка >= 32 символов>
ADMIN_LOGIN=admin
ADMIN_PASSWORD=<пароль>
```

Для реальных интеграций дополнительно:

```text
LIVEKIT_URL=...
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
JUDGE0_URL=...
```

Запуск:

```powershell
docker compose down
docker compose up --build -d
docker compose ps
```

Ожидается:

- `backend` — `healthy`;
- `collab` — `healthy`;
- `frontend` — `Up`;
- UI — `http://localhost:3000`.

Hocuspocus больше не публикуется отдельным host-портом в Compose: браузер Docker-окружения использует same-origin `/collab`, который проксируется nginx. Это уменьшает количество внешних точек входа.

## 4. Базовый smoke test

```powershell
$env:ADMIN_LOGIN='admin'
$env:ADMIN_PASSWORD='<пароль>'
.\scripts\smoke-test.ps1
```

Проверяются:

1. `/health`;
2. JWT login;
3. `/api/auth/me`;
4. `/api/materials`;
5. SignalR negotiate.

## 5. ДЗ и AI

### Базовый поток

1. Преподаватель создаёт ДЗ.
2. Студент своей группы видит его.
3. Студент сдаёт работу.
4. Повторная сдача после `TeacherScore` получает `409`.
5. Преподаватель выставляет итоговую оценку.

## 6. LiveKit

Проверить:

- преподаватель своей пары получает token;
- студент своей группы получает token;
- пользователь другой группы получает `403`;
- до запуска комнаты token не выдаётся;
- после завершения комнаты новый token не выдаётся;
- camera/microphone/screen sharing работают через реальный LiveKit server.

Без трёх `LIVEKIT_*` backend должен вернуть `503`, а не падать.

## 7. SignalR

Открыть чат одной пары в двух браузерах:

- сообщение появляется у обоих;
- переподключение восстанавливает соединение;
- пользователь другой пары не может присоединиться;
- rate limit не позволяет бесконечно спамить сообщениями.

## 8. Code Lab / Judge0

Проверить:

- student/teacher/admin access;
- создание exercise только teacher/admin;
- collaborative token только для пользователей пары;
- два браузера видят общий Y.Text;
- перезапуск `collab` сохраняет документ;
- Judge0 запускает разрешённые языки;
- network отключён;
- CPU = 2 секунды;
- wall time = 5 секунд;
- memory = 128 MB;
- вывод ограничивается 20 000 символами;
- неразрешённый язык отклоняется.

Judge0 не входит в текущий Compose как встроенный сервис: `JUDGE0_URL` указывает на внешний/self-hosted Judge0 endpoint. Это сделано намеренно, поскольку полноценный Judge0 требует отдельного sandbox-инфраструктурного контура.

## 9. Excalidraw

Проверить:

- `/lesson-board?lessonId=<id>`;
- два пользователя одной пары видят изменения;
- awareness показывает участников;
- перезапуск `collab` сохраняет доску;
- другой учебной группе выдача board token возвращает `403`.

## 10. Права пользователей

Минимальная матрица:

| Ресурс | Admin | Teacher своей пары | Student своей группы | Student другой группы | Parent связанного ребёнка |
|---|---|---|---|---|---|
| ДЗ | полный | полный | своё | 403 | ребёнок |
| Материалы | полный | свои | опубликованные | 403/404 | опубликованные |
| Chat | да | своя пара | своя пара | отказ | не входит |
| LiveKit | да | своя пара | своя группа | 403 | нет |
| Code Lab | полный | своя пара | своя группа | 403 | нет |
| Board | да | своя пара | своя группа | 403 | нет |

Особенно проверить, что знание числового `lessonId`, `homeworkId` или `exerciseId` само по себе не раскрывает данные другой группы.

## 11. Старые SQLite-базы

Сначала сделать копию старой БД. Затем проверить upgrade на копии.

```powershell
# путь зависит от вашей локальной конфигурации
# database\journal.db -> резервная копия
```

Ожидается:

- существующие данные сохраняются;
- старые snake_case колонки переименовываются в EF-имена;
- новые таблицы/индексы создаются;
- нет `no such column: schedule_entry_id`;
- нет `connection is open` cascade error после первой migration error;
- после перезапуска backend база открывается повторно без повторного разрушительного DDL.

## 12. Что сейчас не следует помечать как полностью проверенное

- backend `dotnet build` — нужен установленный .NET SDK;
- frontend `npm ci/lint/build` — нужен завершённый install;
- реальный LiveKit — нужен доступный сервер и credentials;
- реальный Judge0 — нужен доступный endpoint;
- multi-browser SignalR/Yjs/Excalidraw — требует двух клиентских сессий;
- Fabric.js — в текущем архиве нет отдельного реализованного Fabric.js editor-модуля; не считать его выполненным только по наличию общего плана.

## 13. Текущий статус

**Исходники:** основные P1–P11 изменения присутствуют.

**Docker routing:** backend/frontend/SignalR/Hocuspocus routing подготовлен.

**Security:** collaboration JWT, group/lesson ownership реализованы на серверной стороне.

**Финальная проверка:** требует запуска на машине с Docker + .NET SDK + установленными frontend dependencies и, для внешних функций, реальными LiveKit/Judge0 credentials.

## 14. P13 — исправление вторичной ошибки SQLite migration

В ходе разбора реального лога Docker была найдена отдельная проблема, не связанная с Hocuspocus: после основного блока SQLite migration `conn.Close()` закрывал соединение, а следующий блок `PRAGMA table_info(subjects)` использовал тот же connection без повторного `Open()`.

Это объясняло сообщение:

```text
Subject teacher schema update failed: ExecuteReader can only be called when the connection is open.
```

Исправление внесено в `backend/JournalBackend/Program.cs`: перед `PRAGMA table_info(subjects)` выполняется проверка состояния и `conn.Open()` при необходимости.

### После исправления ожидаемая последовательность

1. `EnsureCreated()` создаёт новую БД/недостающие EF-таблицы.
2. `SqliteSchemaUpgrades.Apply()` приводит старые snake_case-колонки к именам EF.
3. Legacy migration выполняет необходимые совместимые обновления.
4. Блок `subjects.TeacherId` работает на открытом connection.
5. Backend продолжает запуск без вторичной ошибки `connection is open`.

### Важное ограничение

Исправление статически проверено по исходнику, но фактический запуск backend здесь не подтверждён: в рабочей среде отсутствует `dotnet` SDK. Финальное подтверждение выполняется командой:

```powershell
docker compose up --build -d
docker compose logs backend --tail=200
```

На старой базе в логе не должно быть `[DB Migration ERROR]`.

## 15. P14 — финальный integration hardening

### Judge0

`JUDGE0_URL` больше не указывает на несуществующий контейнер по умолчанию. Если Judge0 не задан, Code Lab получает понятный ответ о ненастроенном Judge0; сетевые ошибки Judge0 возвращаются как `503`, а таймаут — как `504`, вместо необработанного исключения.

### Frontend health

Frontend теперь имеет Docker healthcheck через `/health`. Это не заменяет backend healthcheck: `/health` на nginx проксируется в backend.

### Автоматическая проверка

Добавлен:

```powershell
.\scripts\integration-check.ps1
```

Он проверяет backend через nginx, login, `/api/auth/me` и SignalR negotiate. Реальные LiveKit/Judge0/Yjs/Excalidraw сценарии требуют пользовательских сессий и внешних сервисов и поэтому перечислены как ручные integration checks.

### Реальные критерии завершения

Считать этап полностью пройденным только после:

- `docker compose ps` показывает `backend`, `collab`, `frontend` как healthy;
- `integration-check.ps1` проходит;
- LiveKit: teacher start → student join → media;
- SignalR: два клиента получают один и тот же message;
- Code Lab: два клиента видят общий Yjs document и Judge0 возвращает execution result;
- Excalidraw: два клиента синхронизируют элементы, а после restart `collab` данные остаются;
- другая группа получает `403` на board/chat/Code Lab/LiveKit;
- копия старой SQLite базы проходит upgrade без `[DB Migration ERROR]`.
