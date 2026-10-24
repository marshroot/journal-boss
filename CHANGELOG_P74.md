# Jornal v23-P74 — перенос пар, платежи (демо), картинки в чатах

## 1. Перенос урока и редактирование времени

- Новый эндпоинт `PUT /api/lessons/{id}/reschedule` (`LessonsController`): преподаватель-владелец
  или администратор может изменить начало/окончание пары, номер и аудиторию.
  - Завершённую пару перенести нельзя (409); начатую — только изменить окончание.
  - Аудит: `schedule.reschedule` (старое → новое время).
- UI: `TeacherLessonsPage` — блок «Время проведения» с кнопкой «Перенести пару»
  (datetime-local начало/конец + аудитория).
- Администратор по-прежнему редактирует пару целиком через `PUT /api/admin/academic/schedule/{id}`.

## 2. Проверка пересечений расписания

- Новый общий сервис `Services/ScheduleConflictChecker.cs`: пара не может пересекаться
  с другой парой той же группы или того же преподавателя.
- Используется в трёх местах: создание пары (админ), редактирование пары (админ),
  перенос пары (преподаватель).
- 409 теперь возвращает подробности конфликта: предмет, группа, преподаватель и время
  мешающей пары (`message` + `conflict`), UI показывает их как есть.

## 3. Платёжная система (пример)

- Модель `Payment` (таблица `payments`, создаётся автоматически, миграция существующей БД —
  через `SqliteSchemaUpgrades`).
- Новый `PaymentsController`:
  - `POST /api/payments` — создать счёт (название, сумма, комментарий, необязательный студент;
    родитель может платить только за связанного ребёнка);
  - `GET /api/payments/my` — свои счета;
  - `GET /api/payments` — все платежи (только Admin);
  - `POST /api/payments/{id}/pay` — **демо-оплата** без реального провайдера
    (провайдер `example`, `ExternalRef=demo-…`);
  - `POST /api/payments/{id}/cancel` — отмена неоплаченного;
  - `POST /api/payments/{id}/refund` — возврат (только Admin).
- Аудит: `payment.create/paid/cancel/refund`.
- UI: страница `/payments` (создание счёта, статусы, итоги, у админа — вкладка «Все пользователи»
  и возвраты), пункт меню «Платежи (демо)».
- Для боевой интеграции достаточно заменить обработчик `pay` на webhook провайдера
  (ЮKassa/Stripe) — модель и статусы уже готовы.

## 4. Картинки в чатах (учитель ↔ ученик и любые направления)

- Модель `ChatAttachment` (таблица `chat_attachments`) + колонка `AttachmentId`
  в `lesson_chat_messages`, `chat_group_messages`, `direct_messages`
  (для существующей БД добавляется автоматически через `SqliteSchemaUpgrades`).
- Новый `ChatAttachmentsController`:
  - `POST /api/chat/attachments/upload` — загрузка изображения (PNG/JPEG/WebP/GIF, до 10 MB,
    проверка расширения по Content-Type, имя очищается);
  - `GET /api/chat/attachments/{id}/download` — доступ проверяется по чату, в котором
    использована картинка: участники пары / участники группового чата / стороны личного
    сообщения; неотправленная картинка видна только загрузившему.
- `LessonChatHub`: `SendMessage`, `SendDirectMessage`, `SendGroupMessage` принимают
  третий аргумент `attachmentId` (можно отправить только картинку без текста);
  история всех трёх чатов отдаёт вложение. Прикрепить можно только свою картинку.
- UI (`LessonChatPage`, `MessagesPage`): кнопка-скрепка, превью ждущей отправки картинки,
  отображение картинок в сообщениях (загрузка через авторизованный fetch → object URL,
  клик открывает оригинал).
- **Студентам открыт доступ к чатам** (раньше страницы показывали заглушку, хотя backend
  разрешал): теперь ученики участвуют в чате пары, личных сообщениях и групповых чатах
  наравне с преподавателями.

## 5. Онлайн-пара через LiveKit

Контур уже реализован (start/end, токены с проверкой ролей, студенческая страница
`/online-lesson`, панель преподавателя в «Мои занятия»: mute/удаление участников,
демо экрана) и не менялся; проверено, что поток согласован с новой логикой переноса
(завершённая пара закрывает комнату).

## Сопутствующие исправления

- `JournalLayout`: пункты «Оценки (локальные)» и «ДЗ (локальные)» вели на /dashboard — добавлены
  в список реализованных страниц; добавлен маршрут `/payments`.
- Починена сборка тестов бэкенда (`JournalBackend.Tests`): отсутствующий `IExternalCredentialProtector`
  в конструкторе `LocalAuthController`, `HttpMethodAttribute`, `SetApplicationName`, устаревший
  тест миграции `announcements` (конфликтовал с EF-моделью) и тест квиза из 3 вопросов
  (гейт давно удалён) — обновлены под текущий контракт.
- `scripts/realtime-contract-check.mjs`, `scripts/external-service-contract-check.mjs`:
  исправлен Windows-путь (`fileURLToPath` вместо `URL.pathname`), версия в compose
  сверяется с `VERSION`, устаревшие строки (`LIVEKIT_URL`, `isTeacher`) заменены на актуальные
  (`LIVEKIT_SERVER_URL`, `isModerator`).
- Устранены 3 давние ошибки типов фронтенда (`tsc --noEmit` чист): `RequestInit` в
  `HomeworkWidget`, `editor.loadSnapshot` в `LessonBoardPage` (актуальный API tldraw).
- `VERSION` → `v23-P74`, дефолт в `docker-compose.yml` и `.env.example` синхронизированы.

## Проверено

- `dotnet build` — без ошибок и предупреждений; `dotnet test` — 17/17.
- `tsc --noEmit` — чисто; `npm test` — 32/32; `vite build` — успешно.
- `integration:contracts` — все проверки PASS.
- Не проверено вручную: реальная загрузка картинок и демо-оплата в работающем Docker
  (нужен прогон `docker compose up --build`).

## Изменённые файлы

Backend: `Models/PaymentModels.cs` (новый), `Models/AcademicModels.cs`, `Database/AppDbContext.cs`,
`Database/SqliteSchemaUpgrades.cs`, `Services/ScheduleConflictChecker.cs` (новый),
`Controllers/{PaymentsController (новый), ChatAttachmentsController (новый), AdminAcademicController,
LessonsController}.cs`, `Hubs/LessonChatHub.cs`, `JournalBackend.Tests/{SecurityTests,
AuthorizationSurfaceTests}.cs`.

Frontend: `lib/api.ts`, `components/ChatImage.tsx` (новый), `pages/{LessonChatPage, MessagesPage,
PaymentsPage (новый), TeacherLessonsPage, LessonBoardPage}.tsx`,
`components/journal/{JournalSidebar, JournalLayout, HomeworkWidget}.tsx`, `journal.css`, `App.tsx`.

Прочее: `VERSION`, `docker-compose.yml`, `.env.example`, `scripts/{realtime-contract-check,
external-service-contract-check}.mjs`, `CHANGELOG_P74.md`.
