# Jornal v23-P75 — трансляция доски пары на экраны участников

## Что добавлено

Преподаватель может **включить доску и вывести её на экраны остальных участников пары**:
у студентов группы доска открывается автоматически и обновляется почти в реальном времени.

### Backend

- `LessonBoard`: новые поля `IsBroadcast`, `BroadcastStartedAt` (миграция существующей БД —
  автоматически через `SqliteSchemaUpgrades.EnsureLessonBoardBroadcastColumns`).
- `LessonBoardController`:
  - `POST /api/lessons/{id}/board/broadcast/start` — включить показ (владелец пары/админ;
    завершённую пару показать нельзя); при первой трансляции доска создаётся в режиме «только просмотр»;
  - `POST /api/lessons/{id}/board/broadcast/stop` — остановить показ;
  - `GET /api/lessons/{id}/board` теперь отдаёт `isBroadcast`/`broadcastStartedAt`/`updatedAt`;
  - **исправлена авторизация чтения**: раньше содержимое доски мог получить любой
    аутентифицированный пользователь по любому lessonId; теперь только участники пары
    (админ / преподаватель-владелец / студенты группы);
  - аудит: `board.broadcast_start`, `board.broadcast_stop`, `board.mode`.
- Статус доски добавлен в payload текущей пары: `GET /api/teacher/current-lesson`,
  `GET /api/lessons/teacher/current`, `GET /api/lessons/student/current` (`board.isBroadcast`).
- Завершение пары (`POST /api/lessons/{id}/complete`) теперь останавливает и трансляцию доски.

### Frontend

- Новый общий компонент `components/LessonBoardCanvas.tsx`: доска tldraw с автосохранением
  (дебаунс 1.5 с) у редактирующих и **живым обновлением каждые 3 с** у смотрящих
  (снимок применяется при изменении `updatedAt` — проекция рисунка преподавателя).
- `LessonBoardPage`: студентам доска открыта (раньше — заглушка); преподавателю — кнопка
  «Показать доску всем» / «Остановить показ» и бейдж «Транслируется всем»; панель «Права»
  (только просмотр / рисуют все / рисуют выбранные) сохранена.
- `TeacherCurrentLessonPage`: новый блок «Доска пары — показ на экраны участников»:
  «Включить доску и показать всем» (сразу открывает доску в новой вкладке), «Остановить показ»,
  индикатор «Доска транслируется» в шапке. Страница опрашивает статус каждые 30 с.
- `StudentOnlineLessonPage`: когда преподаватель включает доску, секция
  «Преподаватель показывает доску» появляется автоматически (опрос каждые 8 с вместо 15 с),
  разворачивается сама, доска можно свернуть; у дисплей-режима — только просмотр
  (если преподаватель не разрешил рисование через «Права»).

## Как это работает

1. Преподаватель на «Текущая пара» (или на самой доске) нажимает «Показать доску всем».
2. Backend ставит `IsBroadcast=true` и пишет аудит.
3. Студенты группы на странице «Текущая пара» (опрос 8 с) получают `board.isBroadcast=true`
   — доска открывается автоматически на их экране.
4. Рисунок преподавателя автосохраняется (1.5 с после последнего штриха); студенческие
   копии подтягивают снимок каждые 3 с — проекция почти live.
5. «Остановить показ» или завершение пары снимает флаг — панели студентов закрываются.

## Проверено

- `dotnet build` — 0 ошибок/0 предупреждений; `dotnet test` — 17/17.
- `tsc --noEmit` — чисто; `npm test` — 32/32; `vite build` — успешно.
- Контракт-скрипты (`realtime`, `external-service`) — PASS.
- Не проверено вручную: реальный показ в двух браузерах в работающем Docker.

## Изменённые файлы

Backend: `Models/AcademicModels.cs`, `Database/SqliteSchemaUpgrades.cs`,
`Controllers/{LessonBoardController, TeacherCurrentLessonController, OnlineLessonsController, LessonsController}.cs`.

Frontend: `components/LessonBoardCanvas.tsx` (новый), `pages/{LessonBoardPage,
StudentOnlineLessonPage, TeacherCurrentLessonPage}.tsx`.

Прочее: `VERSION` → v23-P75, `docker-compose.yml`, `.env.example`, `CHANGELOG_P75.md`.
