# Jornal — образовательный портал (электронный журнал)

Версия: **v23-P75**

Self-hosted электронный журнал для учебных центров и школ: расписание, ведение занятий,
оценки, домашние задания, материалы, чаты, онлайн-пары с видео, совместная доска и
лаборатория кода. Все данные остаются у вас — SQLite + файлы, Docker Compose одной командой.

## Возможности

- **Роли**: Admin / Teacher / Student / Parent — права проверяются на сервере в каждом эндпоинте.
- **Расписание**: автоматическая проверка пересечений у группы и преподавателя; перенос пары
  преподавателем с редактированием начала/окончания.
- **Текущая пара**: тема, посещаемость, оценки, ДЗ, материалы — на одном экране.
- **Онлайн-пара (LiveKit)**: видео/аудио, демонстрация экрана, управление участниками
  (mute, отключение), студенты подключаются со своей страницы.
- **Доска (tldraw)**: совместное рисование + режим «Показать доску всем» — рисунок
  преподавателя автоматически выводится на экраны студентов (обновление каждые 3 с).
- **Чаты (SignalR)**: чат пары, личные сообщения и групповые чаты — с изображениями
  (PNG/JPEG/WebP/GIF до 10 МБ), для всех сочетаний ролей учитель↔ученик↔родитель.
- **ДЗ**: создание → сдача → проверка → итоговая оценка; файлы заданий и работ.
- **Материалы**: черновик/публикация, файлы; студенты видят только опубликованное.
- **Code Lab**: Monaco + совместное редактирование (Yjs/Hocuspocus) + запуск кода в
  песочнице Judge0 (CPU 2 с, 128 МБ, без сети).
- **Платежи (демо)**: счета, статусы, история; модуль-пример под подключение реального
  провайдера (ЮKassa/Stripe).
- **Аудит и backup**: журнал действий, встроенное резервное копирование (БД + файлы + ключи).

## Быстрый старт

### Docker (рекомендуется)

```bash
cp .env.example .env        # заполнить JWT_KEY, ADMIN_LOGIN, ADMIN_PASSWORD
docker compose up --build   # интерфейс: http://localhost:3000
```

### Windows без Docker (разработка)

```bat
run.bat    -- проверит .NET 9 SDK + Node.js 22, создаст .env, запустит backend (5000) и frontend (3000)
```

Первый вход: логин/пароль из `ADMIN_LOGIN`/`ADMIN_PASSWORD` (создаётся при первом старте);
остальных пользователей заводит администратор. Подробно —
[docs/HOSTING_AND_ACCESS.md](docs/HOSTING_AND_ACCESS.md).

## Требования

- Сервер: Linux/Windows с Docker; от 2 vCPU / 2 ГБ RAM (комфортно 4 vCPU / 4–8 ГБ), SSD 20+ ГБ.
- Клиент: актуальный браузер с WebSocket/WebRTC.
- Опционально: LiveKit (для видео) входит в compose; Judge0 — внешний сервис для Code Lab.
- Полные требования (ОС, диск, канал, порты): [docs/HOSTING_AND_ACCESS.md](docs/HOSTING_AND_ACCESS.md),
  [docs/PROJECT_DOCUMENTATION.md](docs/PROJECT_DOCUMENTATION.md).

## Структура репозитория

```
backend/JournalBackend/       ASP.NET Core 9: REST API, SignalR, EF Core + SQLite
backend/JournalBackend.Tests/ xUnit-тесты
frontend/                     React 19 + TypeScript + Vite; e2e (Playwright), node-тесты
collab/                       Hocuspocus + Yjs (совместное редактирование Code Lab)
livekit/                      конфиг локального LiveKit (публичный devkey)
scripts/                      контрактные проверки, smoke-тесты, аудит релиза
docs/                         документация (docs/README.md — индекс)
docker-compose.yml            прод-контур: livekit, backend, collab, frontend
run.bat / start.bat           локальный запуск на Windows
Caddyfile                     пример TLS-прокси для публикации
CHANGELOG_P74.md, CHANGELOG_P75.md
```

## Документация

- [docs/PROJECT_DOCUMENTATION.md](docs/PROJECT_DOCUMENTATION.md) — обоснование, технические
  особенности, требования, инструкция по ролям.
- [docs/HOSTING_AND_ACCESS.md](docs/HOSTING_AND_ACCESS.md) — хостинг, URL, доступ, публикация репозитория.
- [docs/README.md](docs/README.md) — полный индекс: архитектура, API, БД, безопасность,
  установка, деплой, тесты, диагностика.

## Проверки

```bash
cd backend/JournalBackend        && dotnet build   # 0 ошибок
cd backend/JournalBackend.Tests  && dotnet test    # 17/17
cd frontend                      && npm ci && npm run lint && npm test && npm run build  # tsc чист, 32/32
node scripts/realtime-contract-check.mjs && node scripts/external-service-contract-check.mjs
node scripts/final-release-audit.mjs     # см. известные ограничения ниже
```

CI: `.github/workflows/ci.yml` — backend, frontend, docker-стек с e2e, контрактные проверки.

## Безопасность

- Локальный JWT (8 ч, ключ ≥ 32 символов), rate limiting (300 req/мин; логин 10/мин; чат 20 msg/мин).
- Файлы: белый список типов, размер ≤ 25 МБ (изображения чата ≤ 10 МБ), скачивание только
  через авторизованный API, защита от path traversal.
- **`.env` не коммитится** — только шаблон `.env.example`; реальные секреты задаются локально.
- Известное ограничение: 18 legacy-эндпоинтов Top Academy/Telegram работают по `sessionToken`
  и отключены без `APPLICATION_KEY` (см. [docs/SECURITY.md](docs/SECURITY.md));
  аудит релиза также требует CHANGELOG_P52–P73 (исторические фазы велись без ченджлогов).
