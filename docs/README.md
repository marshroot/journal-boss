# Jornal documentation

Jornal — образовательный портал с локальной JWT-аутентификацией, ролями Admin/Teacher/Student/Parent, расписанием, ДЗ, материалами, файлами, Code Lab, realtime collaboration, SignalR chat и LiveKit lessons.

## Документы

- [PROJECT_DOCUMENTATION](PROJECT_DOCUMENTATION.md) — обоснование, технические особенности, требования к хостингу/ОС и инструкция по ролям.
- [HOSTING_AND_ACCESS](HOSTING_AND_ACCESS.md) — требования к хостингу, URL-адреса, данные для входа, исходный код и публикация репозитория.
- [ARCHITECTURE](ARCHITECTURE.md) — компоненты и потоки данных.
- [INSTALLATION](INSTALLATION.md) — локальный запуск.
- [DEPLOYMENT](DEPLOYMENT.md) — Docker/Caddy production deployment.
- [API](API.md) — основной JWT API.
- [DATABASE](DATABASE.md) — SQLite и доменная модель.
- [SECURITY](SECURITY.md) — security boundary и известные legacy-исключения.
- [CODE_LAB](CODE_LAB.md) — Monaco/Yjs/Judge0.
- [ONLINE_LESSONS](ONLINE_LESSONS.md) — LiveKit.
- [FILES](FILES.md) — storage и ACL.
- [BACKUPS](BACKUPS.md) — backup/restore.
- [TESTING](TESTING.md) — автоматические и ручные проверки.
- [TROUBLESHOOTING](TROUBLESHOOTING.md) — типовые проблемы.
- [DIAGRAMS](DIAGRAMS.md) — Mermaid-диаграммы ключевых потоков.

## Версия

v23-P75. Изменения P74 (перенос пар и конфликты расписания, платёжная система-пример, картинки
в чатах, доступ студентов к чатам) — `CHANGELOG_P74.md`; P75 (трансляция доски пары на экраны
участников) — `CHANGELOG_P75.md`.

## Важное ограничение

В проекте сохранены legacy Top Academy/Telegram API с `sessionToken`. Они не являются частью основной JWT security boundary и требуют отдельной миграции, чтобы не сломать существующие интеграции.

- `FINAL_REQUIREMENTS_MATRIX_P43.md` — final requirement-by-requirement acceptance matrix and release gate.
