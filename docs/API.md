# API

The canonical application API uses `Authorization: Bearer <JWT>`.

## Authentication

- `POST /api/auth/login`
- `GET /api/auth/me`

## Admin

- `/api/admin/users`
- `/api/admin/academic/groups`
- `/api/admin/academic/subjects`
- `/api/admin/academic/teachers`
- `/api/admin/academic/schedule`
- `/api/admin/overview`
- `/api/admin/audit`
- `/api/admin/backups`

## Lessons / assessment

- `/api/teacher/current-lesson`
- `/api/lessons/*`
- `/api/assessment/*`
- `/api/student/*`
- `/api/schedule/personal`
- `/api/parent/*`

## Materials/files

- `/api/materials`
- `/api/documents`
- `/api/attachments`

## Realtime/classroom

- `/hubs/lesson-chat`
- `/api/code-lab/*`
- `/api/collaboration/*`
- `/api/lessons/{lessonId}/online/*`

## Authorization rule

Numeric IDs in routes are never considered proof of ownership. Controllers must validate the authenticated user's role plus relationship to the referenced lesson/group/student/homework/submission/file.

## Legacy API

`AuthController`, `ScheduleController`, `HomeworkController`, and `LeaderboardController` expose the compatibility `sessionToken` flow. They are intentionally documented separately from the JWT API until migration is approved.
