# P18 — завершение Code Lab и canonical API

## Что добавлено

- Мультифайловый запуск через Judge0: рабочая область может передавать дополнительные файлы как `additional_files` (ZIP/base64), не выполняя пользовательский код внутри ASP.NET Core.
- Ограничения Judge0 сохранены: CPU 2s, wall time 5s, RAM 128 MB, размер файла 1 KB на стороне Judge0; очередь ASP.NET Core остаётся bounded.
- Для `CodeSubmission` добавлены оценка 0–100, комментарий преподавателя и время проверки.
- Добавлен backend endpoint `PUT /api/code-lab/submission/{submissionId}/review` с проверкой владельца занятия.
- В Code Lab для Teacher/Admin появился блок «Проверка работ».
- Добавлен canonical `GET /api/documents/{documentId}` и `PUT /api/documents/{documentId}` поверх существующей сущности `StudyMaterial`; отдельное хранилище документов не создаётся.
- Добавлен GET-алиас `/api/lessons/{lessonId}/board-token` наряду с существующим POST для совместимости с ТЗ.
- SQLite schema upgrade автоматически добавляет новые поля проверки к существующим `code_submissions` без удаления данных.

## Безопасность

- Запуск по-прежнему выполняется только через внешний Judge0.
- Доступ к проверке кода ограничен Teacher/Admin и проверяется на backend по владельцу занятия.
- Доступ к документу проверяется по роли, группе и публикации.
